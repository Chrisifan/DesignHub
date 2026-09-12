import { useEffect, useMemo, useRef, useState } from 'react';
import { Ellipse, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from 'react-konva';

import { getMessages, type Locale } from '../../app/i18n';
import { Button } from '../../app/studio/ui';
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
  assetAction?: CanvasAssetAction;
  onAssetActionHandled?: (actionId: string) => void;
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

export const CanvasWorkspace = ({ locale, scene, onSceneChange, workspaceId, projectId, documentId, assetAction, onAssetActionHandled }: CanvasWorkspaceProps) => {
  const messages = getMessages(locale);
  const canvasReady = useMemo(canRenderCanvas, []);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewport, setViewport] = useState<ViewportState>(initialViewport);
  const [assetImages, setAssetImages] = useState<Record<string, HTMLImageElement>>({});
  const [sceneHydrated, setSceneHydrated] = useState(!workspaceId || !projectId || !documentId);
  const handledAssetAction = useRef<string | undefined>(undefined);
  const selectedLayer = useMemo(() => scene.layers.find((layer) => layer.id === selectedIds[0]), [scene.layers, selectedIds]);
  const selectedLayers = useMemo(() => scene.layers.filter((layer) => selectedIds.includes(layer.id)), [scene.layers, selectedIds]);
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
  const select = (ids: string[]) => setSelectedIds(selectLayerIds(scene, ids));
  const persist = (nextScene: DesignScene): void => {
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
    setSelectedIds(applied.selectedIds);
    onAssetActionHandled?.(assetAction.id);
  }, [assetAction, onAssetActionHandled, scene, sceneHydrated, selectedIds]);
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
    setSelectedIds([id]);
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
  return (
    <section className="canvas-workspace" aria-label={messages.canvasTitle}>
      <header>
        <h1>{messages.canvasTitle}</h1>
        <div>
          <Button icon="maximize-2" onClick={() => setViewport(fitViewport(scene, stageDimensions))}>{messages.canvasFit}</Button>
          <Button icon="scan" onClick={() => setViewport(initialViewport)}>{messages.canvasReset}</Button>
        </div>
      </header>
      <div className="canvas-workspace__body">
        <LayerList locale={locale} layers={scene.layers} selectedIds={selectedIds} onSelect={select} onMove={move} onDuplicate={duplicate} onDelete={remove} onRename={rename} />
        <div className="canvas-workspace__stage" style={{ overflow: 'auto' }}>
          {canvasReady ? <Stage width={stageDimensions.width} height={stageDimensions.height} scaleX={viewport.zoom} scaleY={viewport.zoom} x={viewport.offsetX} y={viewport.offsetY} onClick={(event) => { if (event.target === event.target.getStage()) select([]); }}>
            <Layer>
              <Rect x={0} y={0} width={scene.width} height={scene.height} fill="#ffffff" listening={false} />
              {scene.layers.map((layer) => renderLayer(layer, selectedIds.includes(layer.id), () => select([layer.id]), updateLayer, layer.type === 'image' ? assetImages[layer.assetId] : undefined))}
            </Layer>
          </Stage> : <div className="canvas-workspace__fallback" role="img" aria-label={messages.canvasTitle}>{messages.canvasUnavailable}</div>}
        </div>
        <Inspector locale={locale} layer={selectedLayer} selectedLayers={selectedLayers} onChange={updateLayer} onChangeMany={updateLayers} />
      </div>
    </section>
  );
};
