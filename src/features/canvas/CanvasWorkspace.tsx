import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ellipse, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from 'react-konva';

import { getMessages, type Locale } from '../../app/i18n';
import { Drawer } from '../../app/studio/Drawer';
import { Button, IconButton } from '../../app/studio/ui';
import { getDesktopApi } from '../../platform/runtime';
import { Inspector } from './Inspector';
import { LayerList } from './LayerList';
import {
  createScene,
  applyAssetToScene,
  fitViewport,
  isLayerInteractive,
  moveLayer,
  replaceSceneLayer,
  renameLayer,
  reorderLayers,
  resizeLayer,
  selectLayerIds,
  type DesignScene,
  type SceneLayer,
  type ViewportState,
} from './scene';

export type CanvasAssetAction = {
  id: string;
  assetId: string;
  mode: 'place' | 'reference' | 'replace';
};

export type CanvasWorkspaceProps = {
  locale: Locale;
  scene: DesignScene;
  onSceneChange?: (scene: DesignScene) => void;
  workspaceId?: string;
  projectId?: string;
  documentId?: string;
  readOnly?: boolean;
  assetAction?: CanvasAssetAction;
  onAssetActionHandled?: (actionId: string) => void;
  embedded?: boolean;
  layersOpen?: boolean;
  onLayersClose?: () => void;
  inspectorRequestId?: number;
  selectionRequest?: { id: number; type: SceneLayer['type'] };
  zoomPercent?: number;
  overlayHost?: HTMLElement | null;
};

const initialViewport: ViewportState = { zoom: 1, offsetX: 0, offsetY: 0 };

const stageDimensions = { width: 900, height: 620 };

const canRenderCanvas = (): boolean => {
  if (typeof document === 'undefined') return false;
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return false;
  try {
    return Boolean(document.createElement('canvas').getContext('2d'));
  } catch {
    return false;
  }
};

const renderLayer = (layer: SceneLayer, selected: boolean, onSelect: () => void, onMove: (next: SceneLayer) => void, image?: HTMLImageElement) => {
  const common = {
    key: layer.id,
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    rotation: layer.rotation,
    opacity: layer.opacity,
    visible: layer.visible,
    draggable: isLayerInteractive(layer),
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (event: { target: { x: () => number; y: () => number } }) => onMove(moveLayer(layer, { x: event.target.x(), y: event.target.y() })),
    stroke: selected ? '#2f7cf6' : layer.type === 'shape' ? layer.stroke : '#6f7682',
    strokeWidth: selected ? 2 : layer.type === 'shape' ? layer.strokeWidth : 1,
  };
  if (layer.type === 'text') return <Text {...common} text={layer.text} fontFamily={layer.fontFamily} fontSize={layer.fontSize} fontStyle={layer.fontWeight} align={layer.align} fill={layer.color} />;
  if (layer.type === 'shape' && layer.kind === 'ellipse') return <Ellipse {...common} radiusX={layer.width / 2} radiusY={layer.height / 2} x={layer.x + layer.width / 2} y={layer.y + layer.height / 2} fill={layer.fill} />;
  if (layer.type === 'shape' && layer.kind === 'line') return <Line {...common} points={[0, 0, layer.width, layer.height]} stroke={selected ? '#2f7cf6' : layer.stroke} />;
  if (layer.type === 'image' && image) return <KonvaImage {...common} image={image} />;
  return <Rect {...common} fill={layer.type === 'shape' ? layer.fill : '#d7dce5'} dash={layer.type === 'image' ? [8, 6] : undefined} />;
};

export const CanvasWorkspace = ({ locale, scene, onSceneChange, workspaceId, projectId, documentId, readOnly = false, assetAction, onAssetActionHandled, embedded = false, layersOpen = false, onLayersClose, inspectorRequestId, selectionRequest, zoomPercent = 68, overlayHost }: CanvasWorkspaceProps) => {
  const messages = getMessages(locale);
  const canvasReady = useMemo(canRenderCanvas, []);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inspectorDismissed, setInspectorDismissed] = useState(false);
  const [viewport, setViewport] = useState<ViewportState>(() => embedded ? fitViewport(scene, stageDimensions) : initialViewport);
  const [assetImages, setAssetImages] = useState<Record<string, HTMLImageElement>>({});
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState(stageDimensions);
  const [sceneHydrated, setSceneHydrated] = useState(!workspaceId || !projectId || !documentId);
  const handledAssetAction = useRef<string | undefined>(undefined);
  const handledSelectionRequest = useRef(0);
  const panRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const selectedLayer = useMemo(() => scene.layers.find((layer) => layer.id === selectedIds[0]), [scene.layers, selectedIds]);
  const selectedLayers = useMemo(() => scene.layers.filter((layer) => selectedIds.includes(layer.id)), [scene.layers, selectedIds]);
  const hasVisibleImage = useMemo(() => scene.layers.some((layer) => layer.type === 'image' && layer.assetId !== 'placeholder' && layer.visible), [scene.layers]);
  useEffect(() => {
    if (!workspaceId || !projectId) return undefined;
    let cancelled = false;
    const imageLayers = scene.layers.filter((layer): layer is Extract<SceneLayer, { type: 'image' }> => layer.type === 'image' && layer.assetId !== 'placeholder');
    imageLayers.forEach((layer) => {
      const request = getDesktopApi().readAsset?.({ workspaceId, projectId, assetId: layer.assetId });
      void request?.then((bytes) => {
        if (!bytes || cancelled || typeof URL === 'undefined' || typeof Image === 'undefined') return;
        const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'image/*' }));
        const image = new Image();
        image.onload = () => { if (!cancelled) setAssetImages((current) => ({ ...current, [layer.assetId]: image })); URL.revokeObjectURL(url); };
        image.src = url;
      }).catch(() => undefined);
    });
    return () => { cancelled = true; };
  }, [projectId, scene.layers, workspaceId]);
  useEffect(() => {
    if (!workspaceId || !projectId || !documentId) { setSceneHydrated(true); return undefined; }
    let cancelled = false;
    const request = getDesktopApi().loadDocumentScene?.(workspaceId, projectId, documentId);
    if (!request) return undefined;
    void request.then((stored) => {
      if (cancelled) return;
      if (stored) {
        onSceneChange?.(stored);
        setSceneHydrated(true);
        return;
      }
      const save = getDesktopApi().saveDocumentScene?.({ workspaceId, projectId, documentId, scene });
      if (save) void save.catch(() => undefined);
      setSceneHydrated(true);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [documentId, onSceneChange, projectId, workspaceId]);
  const select = (ids: string[]) => {
    setSelectedIds(selectLayerIds(scene, ids));
    setInspectorDismissed(false);
  };
  const inspectorOpen = selectedIds.length > 0 && !inspectorDismissed;
  const persist = (nextScene: DesignScene): void => {
    if (readOnly) return;
    onSceneChange?.(nextScene);
    if (workspaceId && projectId && documentId) {
      const request = getDesktopApi().saveDocumentScene?.({ workspaceId, projectId, documentId, scene: nextScene });
      if (request) void request.catch(() => undefined);
    }
  };
  useEffect(() => {
    if (!sceneHydrated || !assetAction || handledAssetAction.current === assetAction.id) return;
    const applied = applyAssetToScene(scene, { assetId: assetAction.assetId, mode: assetAction.mode, selectedIds });
    handledAssetAction.current = assetAction.id;
    persist(applied.scene);
    select(applied.selectedIds);
    onAssetActionHandled?.(assetAction.id);
  }, [assetAction, onAssetActionHandled, scene, sceneHydrated, selectedIds]);
  useEffect(() => {
    if (!embedded || !inspectorRequestId || inspectorRequestId < 1) return;
    setSelectedIds((current) => {
      if (current.some((id) => scene.layers.some((layer) => layer.id === id && isLayerInteractive(layer)))) return current;
      const firstInteractive = scene.layers.find(isLayerInteractive);
      return firstInteractive ? [firstInteractive.id] : [];
    });
    setInspectorDismissed(false);
  }, [embedded, inspectorRequestId, scene.layers]);
  useEffect(() => {
    if (!embedded || !selectionRequest || handledSelectionRequest.current >= selectionRequest.id) return;
    handledSelectionRequest.current = selectionRequest.id;
    const requestedLayer = scene.layers.find((layer) => layer.type === selectionRequest.type);
    setSelectedIds(requestedLayer ? [requestedLayer.id] : []);
    setInspectorDismissed(false);
  }, [embedded, scene.layers, selectionRequest]);
  useEffect(() => {
    if (!embedded || !stageRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [embedded]);
  useEffect(() => {
    if (!embedded) return;
    const fit = fitViewport(scene, stageSize);
    const nextZoom = fit.zoom * (zoomPercent / 68);
    setViewport({
      zoom: nextZoom,
      offsetX: (stageSize.width - scene.width * nextZoom) / 2,
      offsetY: (stageSize.height - scene.height * nextZoom) / 2,
    });
  }, [embedded, scene.height, scene.width, stageSize, zoomPercent]);
  const replace = (layer: SceneLayer): void => persist(replaceSceneLayer(scene, layer));
  const move = (layerId: string, direction: 'up' | 'down'): void => {
    const index = scene.layers.findIndex((layer) => layer.id === layerId);
    if (index < 0) return;
    const target = direction === 'up' ? index + 1 : index - 1;
    if (target < 0 || target >= scene.layers.length) return;
    const order = scene.layers.map((layer) => layer.id);
    [order[index], order[target]] = [order[target], order[index]];
    persist(createScene({ ...scene, layers: reorderLayers(scene.layers, order) }));
  };
  const duplicate = (layerId: string): void => {
    const layer = scene.layers.find((entry) => entry.id === layerId);
    if (!layer) return;
    const base = `${layer.id}-copy`;
    let id = base;
    let index = 2;
    while (scene.layers.some((entry) => entry.id === id)) id = `${base}-${index++}`;
    const copy = { ...structuredClone(layer), id, x: layer.x + 16, y: layer.y + 16 };
    const position = scene.layers.findIndex((entry) => entry.id === layerId);
    const layers = [...scene.layers.slice(0, position + 1), copy, ...scene.layers.slice(position + 1)];
    persist(createScene({ ...scene, layers }));
    select([id]);
  };
  const remove = (layerId: string): void => {
    if (!scene.layers.some((layer) => layer.id === layerId)) return;
    persist(createScene({ ...scene, layers: scene.layers.filter((layer) => layer.id !== layerId) }));
    setSelectedIds((ids) => ids.filter((id) => id !== layerId));
  };
  const rename = (layerId: string, name: string): void => {
    const layer = scene.layers.find((entry) => entry.id === layerId);
    if (!layer) return;
    persist(replaceSceneLayer(scene, renameLayer(layer, name)));
  };
  const updateLayer = (layer: SceneLayer) => {
    const next = layer.width > 0 && layer.height > 0 ? layer : resizeLayer(layer, { width: Math.max(1, layer.width), height: Math.max(1, layer.height) });
    replace(next);
  };
  const updateLayers = (layers: SceneLayer[]): void => {
    const byId = new Map(layers.map((layer) => [layer.id, layer]));
    persist(createScene({ ...scene, layers: scene.layers.map((layer) => byId.get(layer.id) ?? layer) }));
  };
  const layersPanel = embedded && layersOpen && <div className="canvas-layer-float">
    <IconButton name="x" label={locale === 'zh-CN' ? '关闭图层' : 'Close layers'} onClick={onLayersClose} />
    <LayerList locale={locale} layers={scene.layers} selectedIds={selectedIds} onSelect={select} onMove={move} onDuplicate={duplicate} onDelete={remove} onRename={rename} readOnly={readOnly} />
  </div>;
  const inspectorPanel = embedded && inspectorOpen && <div className="canvas-inspector-float">
    <IconButton name="x" label={locale === 'zh-CN' ? '关闭检查器' : 'Close inspector'} onClick={() => setInspectorDismissed(true)} />
    <Inspector locale={locale} layer={selectedLayer} selectedLayers={selectedLayers} onChange={updateLayer} onChangeMany={updateLayers} readOnly={readOnly} />
  </div>;
  return <>
    <section
      className={`canvas-workspace${embedded ? ' canvas-workspace--embedded' : ''}`}
      aria-label={messages.canvasTitle}
      data-read-only={readOnly || undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) select([]);
      }}
    >
      {!embedded && <header>
        <h1>{messages.canvasTitle}</h1>
        <div>
          <Button icon="maximize-2" onClick={() => setViewport(fitViewport(scene, stageDimensions))}>{messages.canvasFit}</Button>
          <Button icon="scan" onClick={() => setViewport(initialViewport)}>{messages.canvasReset}</Button>
        </div>
      </header>}
      <div className="canvas-workspace__body">
        {!embedded && <LayerList locale={locale} layers={scene.layers} selectedIds={selectedIds} onSelect={select} onMove={move} onDuplicate={duplicate} onDelete={remove} onRename={rename} readOnly={readOnly} />}
        {!overlayHost && layersPanel}
        <div ref={stageRef} className="canvas-workspace__stage">
          {canvasReady ? <Stage width={stageSize.width} height={stageSize.height} scaleX={viewport.zoom} scaleY={viewport.zoom} x={viewport.offsetX} y={viewport.offsetY}
            onClick={(event) => { if (event.target === event.target.getStage()) select([]); }}
            onMouseDown={(event) => {
              if (event.target !== event.target.getStage()) return;
              const pointer = event.target.getStage()?.getPointerPosition();
              if (pointer) panRef.current = { x: pointer.x, y: pointer.y, offsetX: viewport.offsetX, offsetY: viewport.offsetY };
            }}
            onMouseMove={(event) => {
              const pan = panRef.current;
              if (!pan) return;
              const pointer = event.target.getStage()?.getPointerPosition();
              if (!pointer) return;
              setViewport((current) => ({ ...current, offsetX: pan.offsetX + pointer.x - pan.x, offsetY: pan.offsetY + pointer.y - pan.y }));
            }}
            onMouseUp={() => { panRef.current = null; }}
            onMouseLeave={() => { panRef.current = null; }}
          >
            <Layer>
              {hasVisibleImage && <Rect data-testid="canvas-surface" x={0} y={0} width={scene.width} height={scene.height} fill="#ffffff" listening={false} />}
              {scene.layers.map((layer) => renderLayer(layer, selectedIds.includes(layer.id), () => select([layer.id]), updateLayer, layer.type === 'image' ? assetImages[layer.assetId] : undefined))}
            </Layer>
          </Stage> : <div className="canvas-workspace__fallback" role="img" aria-label={messages.canvasTitle}>{messages.canvasUnavailable}</div>}
        </div>
      </div>
      {!overlayHost && inspectorPanel}
      <Drawer open={!embedded && inspectorOpen} title={messages.canvasInspector} locale={locale} onClose={() => setInspectorDismissed(true)}>
        <Inspector locale={locale} layer={selectedLayer} selectedLayers={selectedLayers} onChange={updateLayer} onChangeMany={updateLayers} readOnly={readOnly} />
      </Drawer>
    </section>
    {overlayHost && layersPanel && createPortal(layersPanel, overlayHost)}
    {overlayHost && inspectorPanel && createPortal(inspectorPanel, overlayHost)}
  </>;
};
