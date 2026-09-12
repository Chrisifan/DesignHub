import { useEffect, useId, useState, type CSSProperties, type FormEvent } from 'react';

import type { Locale } from '../i18n';
import type { Project } from './types';
import { CanvasWorkspace } from '../../features/canvas/CanvasWorkspace';
import { createScene, replaceSceneLayer, type DesignScene, type TextLayer } from '../../features/canvas/scene';
import { getDesktopApi } from '../../platform/runtime';
import { resizeScene } from '../../features/image-tools/local-transform';
import type { ImageTool } from '../../features/image-tools/target';
import type { RevisionRecord, RevisionTimelineEvent } from '../../features/revisions/model';
import type { TaskCandidate, TaskRecord } from '../../features/tasks/state';
import { CompareRevisions } from '../../features/revisions/CompareRevisions';
import {
  ArtworkPreview,
  Badge,
  Button,
  Field,
  Icon,
  IconButton,
  t,
} from './ui';
import './workbench.css';

type LayerId = 'text' | 'shape' | 'image';
type ContextPanel = 'properties' | 'conversation' | 'history' | 'tools';
type LayerState = Record<LayerId, boolean>;
type RevisionState = { revisions: RevisionRecord[]; timeline: RevisionTimelineEvent[]; finalRevisionId: string | null };

export type WorkbenchProps = {
  locale: Locale;
  project: Project;
  workspaceId?: string;
  documentId?: string;
  scene?: DesignScene;
  onBack: () => void;
  onExport: () => void;
  onConnections: () => void;
  onSubmitConversation?: (message: string) => void | Promise<void>;
  onSubmitImageTask?: (input: { tool: ImageTool; prompt: string; baseRevisionId: string | null }) => void | Promise<void>;
  onSubmitImageGeneration?: (prompt: string, baseRevisionId: string | null) => void | Promise<void>;
  operatorName?: string;
  modelConnected?: boolean;
  notify: (message: string) => void;
};

const createInitialScene = (project: Project, documentId?: string): DesignScene => {
  const document = project.documentEntries?.find((entry) => entry.id === documentId) ?? project.documentEntries?.[0];
  const width = document?.width ?? 1080;
  const height = document?.height ?? 1440;
  const titleLayer = {
    id: 'title', type: 'text' as const, text: project.name, fontFamily: 'Inter', fontSize: 96,
    fontWeight: 'bold', align: 'center' as const, color: '#24262B', x: 120, y: 520,
    width: Math.max(1, width - 240), height: 140, rotation: 0, opacity: 1, visible: true, locked: false,
  };
  const layers = project.artwork === 'blank'
    ? [titleLayer]
    : [
        { id: 'background', type: 'image' as const, assetId: 'placeholder', x: 0, y: 0, width, height, rotation: 0, opacity: 1, visible: true, locked: false },
        titleLayer,
      ];
  return createScene({ id: `${project.id}-scene`, width, height, layers });
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const Workbench = ({
  locale,
  project,
  workspaceId,
  documentId,
  scene: providedScene,
  onBack,
  onExport,
  onConnections,
  onSubmitConversation,
  onSubmitImageTask,
  onSubmitImageGeneration,
  operatorName = '',
  modelConnected = false,
  notify,
}: WorkbenchProps) => {
  const layersTitleId = useId();
  const contextTitleId = useId();
  const [selectedLayer, setSelectedLayer] = useState<LayerId>('text');
  const [visibility, setVisibility] = useState<LayerState>({
    text: true,
    shape: true,
    image: true,
  });
  const [locked, setLocked] = useState<LayerState>({
    text: false,
    shape: false,
    image: false,
  });
  const [panel, setPanel] = useState<ContextPanel | null>('properties');
  const [layersExpanded, setLayersExpanded] = useState(false);
  const [zoom, setZoom] = useState(68);
  const [gridVisible, setGridVisible] = useState(false);
  const [title, setTitle] = useState(
    locale === 'zh-CN' ? project.name : project.enName,
  );
  const [opacity, setOpacity] = useState(100);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [prompt, setPrompt] = useState('');
  const documentMeta = project.documentEntries?.find((entry) => entry.id === documentId) ?? project.documentEntries?.[0];
  const [scene, setScene] = useState<DesignScene>(() => providedScene ?? createInitialScene(project, documentId));
  const [resizeWidth, setResizeWidth] = useState(() => (providedScene ?? createInitialScene(project, documentId)).width);
  const [resizeHeight, setResizeHeight] = useState(() => (providedScene ?? createInitialScene(project, documentId)).height);
  const [revisionState, setRevisionState] = useState<RevisionState>({ revisions: [], timeline: [], finalRevisionId: null });
  const [revisionBusy, setRevisionBusy] = useState(false);
  const [revisionBaseId, setRevisionBaseId] = useState<string | null>(null);
  const [compareRevisionId, setCompareRevisionId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [candidatePreviewId, setCandidatePreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId || !documentId) return undefined;
    let cancelled = false;
    const request = getDesktopApi().loadDocumentRevisions?.(workspaceId, project.id, documentId);
    void request?.then((loaded) => { if (!cancelled && loaded) setRevisionState(loaded); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [documentId, project.id, workspaceId]);

  useEffect(() => {
    if (!workspaceId) return undefined;
    let cancelled = false;
    const request = getDesktopApi().listTasks?.(workspaceId);
    void request?.then((loaded) => { if (!cancelled && loaded) setTasks(loaded.filter((task) => task.documentId === documentId)); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [documentId, workspaceId]);

  const currentRevisionId = revisionState.revisions[revisionState.revisions.length - 1]?.revisionId ?? revisionState.finalRevisionId ?? null;
  const candidateFor = (candidateId: string): { task: TaskRecord; candidate: TaskCandidate } | undefined => {
    for (const task of tasks) {
      if (task.result?.candidate?.id === candidateId) return { task, candidate: task.result.candidate };
    }
    return undefined;
  };

  const persistScene = (nextScene: DesignScene): void => {
    setScene(nextScene);
    if (workspaceId && documentId) {
      const request = getDesktopApi().saveDocumentScene?.({ workspaceId, projectId: project.id, documentId, scene: nextScene });
      if (request) void request.catch(() => undefined);
    }
  };
  const syncTextState = (nextScene: DesignScene): void => {
    const textLayer = nextScene.layers.find((layer): layer is TextLayer => layer.type === 'text');
    if (!textLayer) return;
    setTitle(textLayer.text);
    setPosition({ x: textLayer.x, y: textLayer.y });
    setOpacity(Math.round(textLayer.opacity * 100));
  };
  const updateTextLayer = (patch: Partial<Pick<TextLayer, 'text' | 'x' | 'y' | 'opacity'>>): void => {
    const textLayer = scene.layers.find((layer): layer is TextLayer => layer.type === 'text');
    if (!textLayer || textLayer.locked) return;
    persistScene(replaceSceneLayer(scene, { ...textLayer, ...patch }));
  };
  const revisionContributions = (role: 'lead' | 'revision' = 'lead'): Array<{ designerVersionId: string; role: 'lead' | 'direction' | 'revision'; designerName?: string }> => {
    const ids = [...new Set(project.contributorDesignerVersionIds ?? (project.activeDesignerVersionId ? [project.activeDesignerVersionId] : []))];
    return ids.map((designerVersionId, index) => ({
      designerVersionId,
      role: index === 0 ? role : 'direction',
      ...(index === 0 ? (() => {
        const snapshot = project.designerSnapshot as { name?: { zh?: string; en?: string } } | undefined;
        const designerName = snapshot?.name?.[locale === 'zh-CN' ? 'zh' : 'en'];
        return designerName ? { designerName } : {};
      })() : {}),
    }));
  };
  const saveRevision = async (): Promise<void> => {
    if (!workspaceId || !documentId || revisionBusy) return;
    setRevisionBusy(true);
    try {
      const result = await getDesktopApi().commitDocumentRevision?.({
        workspaceId,
        projectId: project.id,
        documentId,
        baseRevisionId: revisionBaseId ?? revisionState.revisions[revisionState.revisions.length - 1]?.revisionId ?? null,
        operationId: `workbench-${crypto.randomUUID()}`,
        sceneAssetId: scene.id,
        assetIds: scene.layers.filter((layer): layer is Extract<typeof layer, { type: 'image' }> => layer.type === 'image').map((layer) => layer.assetId),
        contributions: revisionContributions(),
        scene,
      });
      if (result) {
        const loaded = await getDesktopApi().loadDocumentRevisions?.(workspaceId, project.id, documentId);
        if (loaded) setRevisionState(loaded);
        setRevisionBaseId(null);
        notify(t(locale, '版本已保存', 'Version saved'));
      }
    } catch {
      notify(t(locale, '版本保存失败', 'Could not save version'));
    } finally { setRevisionBusy(false); }
  };
  const finalizeRevision = async (revisionId: string): Promise<void> => {
    if (!workspaceId || !documentId || revisionBusy) return;
    setRevisionBusy(true);
    try {
      const result = await getDesktopApi().setFinalDocumentRevision?.({ workspaceId, projectId: project.id, documentId, revisionId });
      if (result) setRevisionState((current) => ({ ...current, finalRevisionId: revisionId, timeline: current.timeline }));
    } catch { notify(t(locale, '定稿失败', 'Could not finalize version')); }
    finally { setRevisionBusy(false); }
  };
  const finalizeCandidate = async (candidateId: string): Promise<void> => {
    const entry = candidateFor(candidateId);
    if (!workspaceId || !documentId || !entry || revisionBusy || entry.candidate.assetIds.length === 0) return;
    setRevisionBusy(true);
    try {
      const contribution = revisionContributions('revision');
      const committed = await getDesktopApi().commitDocumentRevision?.({
        workspaceId,
        projectId: project.id,
        documentId,
        baseRevisionId: entry.candidate.baseRevisionId,
        operationId: `candidate-${entry.candidate.id}`,
        sceneAssetId: entry.candidate.sceneAssetId ?? entry.candidate.assetIds[0]!,
        assetIds: [...entry.candidate.assetIds],
        contributions: contribution,
        ...(operatorName.trim() ? { operatorName: operatorName.trim() } : {}),
      });
      if (!committed) return;
      await getDesktopApi().setFinalDocumentRevision?.({ workspaceId, projectId: project.id, documentId, revisionId: committed.revisionId });
      const loaded = await getDesktopApi().loadDocumentRevisions?.(workspaceId, project.id, documentId);
      if (loaded) setRevisionState(loaded);
      notify(t(locale, '候选已定稿', 'Candidate finalized'));
    } catch { notify(t(locale, '候选定稿失败', 'Could not finalize candidate')); }
    finally { setRevisionBusy(false); }
  };
  const continueCandidate = (candidateId: string): void => {
    const entry = candidateFor(candidateId);
    const assetId = entry?.candidate.assetIds[0];
    if (!entry || !assetId) return;
    const imageLayer = scene.layers.find((layer): layer is Extract<typeof layer, { type: 'image' }> => layer.type === 'image');
    if (!imageLayer) return;
    const nextScene = replaceSceneLayer(scene, { ...imageLayer, assetId });
    setRevisionBaseId(entry.candidate.baseRevisionId);
    persistScene(nextScene);
    notify(t(locale, '候选已载入，可继续编辑', 'Candidate loaded for continued editing'));
  };

  const layerCopy: Record<
    LayerId,
    { label: string; kind: string; icon: string }
  > = {
    text: {
      label: t(locale, '标题文字', 'Title text'),
      kind: t(locale, '文字', 'Text'),
      icon: 'type',
    },
    shape: {
      label: t(locale, '装饰图形', 'Graphic shape'),
      kind: t(locale, '形状', 'Shape'),
      icon: 'square',
    },
    image: {
      label: t(locale, '背景图像', 'Background image'),
      kind: t(locale, '图像', 'Image'),
      icon: 'image',
    },
  };
  const panelCopy: Record<ContextPanel, { label: string; icon: string }> = {
    properties: {
      label: t(locale, '属性', 'Properties'),
      icon: 'sliders-horizontal',
    },
    conversation: {
      label: t(locale, '对话', 'Conversation'),
      icon: 'message-square',
    },
    history: { label: t(locale, '历史', 'History'), icon: 'history' },
    tools: { label: t(locale, '工具', 'Tools'), icon: 'wand-sparkles' },
  };
  const hasShapeLayer =
    project.artwork === 'market' || project.artwork === 'objects';
  const orderedLayers: LayerId[] = hasShapeLayer
    ? ['text', 'shape', 'image']
    : ['text', 'image'];
  const panelOrder: ContextPanel[] = [
    'properties',
    'conversation',
    'history',
    'tools',
  ];
  const canvasStyle = {
    '--workbench-zoom': zoom / 100,
    '--workbench-rotation': `${rotation}deg`,
  } as CSSProperties;

  const updateVisibility = (layer: LayerId): void => {
    setVisibility((current) => ({ ...current, [layer]: !current[layer] }));
  };
  const updateLocked = (layer: LayerId): void => {
    setLocked((current) => ({ ...current, [layer]: !current[layer] }));
  };
  const updatePosition = (axis: 'x' | 'y', rawValue: string): void => {
    const value = Number(rawValue);
    if (Number.isFinite(value)) {
      const nextValue = clamp(value, -999, 999);
      setPosition((current) => ({ ...current, [axis]: nextValue }));
      updateTextLayer({ [axis]: nextValue });
    }
  };
  const togglePanel = (nextPanel: ContextPanel): void => {
    setPanel((current) => (current === nextPanel ? null : nextPanel));
  };
  const resetZoom = (): void => {
    setZoom(68);
    notify(t(locale, '缩放已重置', 'Preview zoom reset'));
  };
  const submitPrompt = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!prompt.trim()) {
      notify(t(locale, '请输入修改说明', 'Enter an edit request'));
      return;
    }
    if (onSubmitConversation) {
      onSubmitConversation(prompt.trim());
      setPrompt('');
      return;
    }
    onConnections();
  };
  const submitGeneration = (): void => {
    if (!prompt.trim()) {
      notify(t(locale, '请输入生成说明', 'Enter a generation prompt'));
      return;
    }
    if (!onSubmitImageGeneration) {
      onConnections();
      return;
    }
    void Promise.resolve(onSubmitImageGeneration(prompt.trim(), currentRevisionId)).then(() => setPrompt('')).catch(() => notify(t(locale, '任务提交失败', 'Task submission failed')));
  };
  const runImageTask = (tool: ImageTool, taskPrompt: string): void => {
    if (!onSubmitImageTask) {
      onConnections();
      return;
    }
    void Promise.resolve(onSubmitImageTask({ tool, prompt: taskPrompt, baseRevisionId: currentRevisionId })).catch(() => notify(t(locale, '任务提交失败', 'Task submission failed')));
  };

  return (
    <section
      className="workbench"
      aria-label={t(locale, '设计工作台', 'Design workbench')}
    >
      <header className="workbench-toolbar">
        <div className="workbench-toolbar__document">
          <IconButton
            name="arrow-left"
            label={t(locale, '返回项目', 'Back to project')}
            onClick={onBack}
          />
          <span className="workbench-toolbar__divider" aria-hidden="true" />
          <div
            className="workbench-document-name"
            title={locale === 'zh-CN' ? project.name : project.enName}
          >
            <strong>
              {locale === 'zh-CN' ? project.name : project.enName}
            </strong>
            <span>{documentMeta?.name ?? t(locale, '主海报', 'Main poster')}</span>
          </div>
          <Badge tone={workspaceId ? 'success' : 'warning'}>
            {workspaceId ? t(locale, '已保存', 'Saved') : t(locale, '预览未保存', 'Unsaved preview')}
          </Badge>
        </div>

        <div
          className="workbench-viewport-controls"
          role="toolbar"
          aria-label={t(locale, '预览视图', 'Preview view')}
        >
          <IconButton
            name="zoom-out"
            label={t(locale, '缩小', 'Zoom out')}
            onClick={() => setZoom((value) => clamp(value - 8, 20, 160))}
          />
          <output
            className="workbench-zoom"
            aria-label={t(locale, '预览缩放', 'Preview zoom')}
            aria-live="polite"
          >
            {zoom}%
          </output>
          <IconButton
            name="zoom-in"
            label={t(locale, '放大', 'Zoom in')}
            onClick={() => setZoom((value) => clamp(value + 8, 20, 160))}
          />
          <IconButton
            name="rotate-ccw"
            label={t(locale, '重置缩放', 'Reset zoom')}
            onClick={resetZoom}
          />
          <IconButton
            name="layout-grid"
            label={t(locale, '网格', 'Grid')}
            aria-pressed={gridVisible}
            onClick={() => setGridVisible((value) => !value)}
          />
        </div>

        <div className="workbench-toolbar__actions">
          <div
            className="workbench-panel-switcher"
            aria-label={t(locale, '上下文面板', 'Context panels')}
          >
            {panelOrder.map((panelId) => (
              <IconButton
                key={panelId}
                name={panelCopy[panelId].icon}
                label={panelCopy[panelId].label}
                aria-pressed={panel === panelId}
                onClick={() => togglePanel(panelId)}
              />
            ))}
          </div>
          <Button variant="primary" icon="download" onClick={onExport}>
            {t(locale, '导出', 'Export')}
          </Button>
        </div>
      </header>

      <div
        className={`workbench-body ${panel === null ? 'workbench-body--panel-closed' : ''}`}
      >
        <aside
          className="workbench-left"
          aria-label={t(locale, '画布工具与图层', 'Canvas tools and layers')}
        >
          <div
            className="workbench-toolstrip"
            role="toolbar"
            aria-label={t(locale, '画布工具', 'Canvas tools')}
          >
            <IconButton
              name="mouse-pointer-2"
              label={t(locale, '选择工具', 'Select tool')}
              aria-pressed="true"
              onClick={() => {
                setPanel('properties');
                setLayersExpanded(true);
              }}
            />
            <IconButton
              name="type"
              label={t(locale, '文本工具', 'Text tool')}
              onClick={() => setSelectedLayer('text')}
            />
            {hasShapeLayer && (
              <IconButton
                name="square"
                label={t(locale, '形状工具', 'Shape tool')}
                onClick={() => setSelectedLayer('shape')}
              />
            )}
            <IconButton
              name="image"
              label={t(locale, '图像工具', 'Image tool')}
              onClick={() => setSelectedLayer('image')}
            />
            <span className="workbench-toolstrip__spacer" />
            <IconButton
              name="layers"
              label={t(locale, '图层', 'Layers')}
              aria-pressed={layersExpanded}
              onClick={() => setLayersExpanded((value) => !value)}
            />
          </div>

          <section
            className={`workbench-layers ${layersExpanded ? 'workbench-layers--expanded' : ''}`}
            aria-labelledby={layersTitleId}
          >
            <div className="workbench-panel-heading">
              <div>
                <p>{t(locale, '文档', 'Document')}</p>
                <h2 id={layersTitleId}>{t(locale, '图层', 'Layers')}</h2>
              </div>
              <span className="workbench-layers__close">
                <IconButton
                  name="x"
                  label={t(locale, '关闭图层', 'Close layers')}
                  onClick={() => setLayersExpanded(false)}
                />
              </span>
            </div>
            <div className="workbench-layer-list">
              {orderedLayers.map((layerId) => {
                const item = layerCopy[layerId];
                const isVisible = visibility[layerId];
                const isLocked = locked[layerId];
                return (
                  <div
                    className={`workbench-layer-row ${selectedLayer === layerId ? 'is-selected' : ''}`}
                    key={layerId}
                  >
                    <button
                      type="button"
                      className="workbench-layer-select"
                      aria-label={item.label}
                      aria-pressed={selectedLayer === layerId}
                      onClick={() => {
                        setSelectedLayer(layerId);
                        setPanel('properties');
                      }}
                    >
                      <span className="workbench-layer-icon">
                        <Icon name={item.icon} size={15} />
                      </span>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.kind}</small>
                      </span>
                    </button>
                    <IconButton
                      name={isVisible ? 'eye' : 'eye-off'}
                      label={t(
                        locale,
                        `${isVisible ? '隐藏' : '显示'}${item.label}`,
                        `${isVisible ? 'Hide' : 'Show'} ${item.label}`,
                      )}
                      aria-pressed={isVisible}
                      onClick={() => updateVisibility(layerId)}
                    />
                    <IconButton
                      name={isLocked ? 'lock' : 'unlock'}
                      label={t(
                        locale,
                        `${isLocked ? '解锁' : '锁定'}${item.label}`,
                        `${isLocked ? 'Unlock' : 'Lock'} ${item.label}`,
                      )}
                      aria-pressed={isLocked}
                      onClick={() => updateLocked(layerId)}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        <section
          className="workbench-canvas"
          aria-label={t(locale, '设计画布', 'Design canvas')}
          data-grid-visible={gridVisible}
          data-text-visible={visibility.text}
          data-shape-visible={visibility.shape}
          data-image-visible={visibility.image}
          style={canvasStyle}
        >
          <div className="workbench-canvas__stage">
            {workspaceId && documentId ? (
              <CanvasWorkspace
                locale={locale}
                scene={scene}
                onSceneChange={(nextScene) => { syncTextState(nextScene); setScene(nextScene); }}
                workspaceId={workspaceId}
                projectId={project.id}
                documentId={documentId}
              />
            ) : (
              <>
            <div
              className={`workbench-preview ${!visibility.text ? 'workbench-preview--text-hidden' : ''} ${!visibility.shape ? 'workbench-preview--shape-hidden' : ''} ${!visibility.image ? 'workbench-preview--image-hidden' : ''}`}
            >
              <ArtworkPreview
                kind={project.artwork}
                className="workbench-artwork"
              />
              <span
                className="workbench-artwork__title-overlay"
                style={{
                  opacity: opacity / 100,
                  transform: `translate(${position.x}px, ${position.y}px)`,
                }}
              >
                {title}
              </span>
              {selectedLayer === 'text' && visibility.text && (
                <span
                  className="workbench-selection"
                  aria-hidden="true"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                  }}
                >
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
              </>
            )}
          </div>
          <div className="workbench-canvas__meta" aria-hidden="true">
            <span>{documentMeta?.width ?? scene.width} × {documentMeta?.height ?? scene.height} px</span>
            <span>sRGB</span>
          </div>
        </section>

        {panel !== null && (
          <aside className="workbench-context" aria-labelledby={contextTitleId}>
            <div className="workbench-panel-heading workbench-context__heading">
              <div>
                <p>{t(locale, '上下文', 'Context')}</p>
                <h2 id={contextTitleId}>{panelCopy[panel].label}</h2>
              </div>
              <IconButton
                name="x"
                label={t(locale, '关闭面板', 'Close panel')}
                onClick={() => setPanel(null)}
              />
            </div>

            {panel === 'properties' && (
              <div className="workbench-context__content workbench-properties">
                <div className="workbench-selection-summary">
                  <span className="workbench-layer-icon">
                    <Icon name={layerCopy[selectedLayer].icon} size={16} />
                  </span>
                  <div>
                    <strong>{layerCopy[selectedLayer].label}</strong>
                    <small>{layerCopy[selectedLayer].kind}</small>
                  </div>
                  <Badge>
                    {locked[selectedLayer]
                      ? t(locale, '已锁定', 'Locked')
                      : t(locale, '可编辑', 'Editable')}
                  </Badge>
                </div>

                {selectedLayer === 'text' ? (
                  <>
                    {locked.text && (
                      <div className="workbench-context-note workbench-lock-note">
                        <Icon name="lock" size={18} />
                        <div>
                          <strong>
                            {t(
                              locale,
                              '解锁图层后可继续编辑',
                              'Unlock the layer to continue editing',
                            )}
                          </strong>
                        </div>
                      </div>
                    )}
                    <Field
                      label={t(locale, '标题文字', 'Title text')}
                      hint={t(
                        locale,
                        '仅影响当前示例预览',
                        'Only affects this example preview',
                      )}
                    >
                      <input
                        aria-label={t(locale, '标题文字', 'Title text')}
                        value={title}
                        disabled={locked.text}
                        onChange={(event) => { const value = event.target.value; setTitle(value); updateTextLayer({ text: value }); }}
                      />
                    </Field>
                    <div className="workbench-property-section">
                      <h3>{t(locale, '位置', 'Position')}</h3>
                      <div className="workbench-coordinate-grid">
                        <Field label={t(locale, 'X 坐标', 'X position')}>
                          <input
                            type="number"
                            min="-999"
                            max="999"
                            value={position.x}
                            disabled={locked.text}
                            onChange={(event) =>
                              updatePosition('x', event.target.value)
                            }
                          />
                        </Field>
                        <Field label={t(locale, 'Y 坐标', 'Y position')}>
                          <input
                            type="number"
                            min="-999"
                            max="999"
                            value={position.y}
                            disabled={locked.text}
                            onChange={(event) =>
                              updatePosition('y', event.target.value)
                            }
                          />
                        </Field>
                      </div>
                    </div>
                    <div className="workbench-property-section">
                      <div className="workbench-range-heading">
                        <h3>{t(locale, '不透明度', 'Opacity')}</h3>
                        <output>{opacity}%</output>
                      </div>
                      <input
                        className="workbench-range"
                        type="range"
                        min="0"
                        max="100"
                        value={opacity}
                        disabled={locked.text}
                        aria-label={t(locale, '不透明度', 'Opacity')}
                        onChange={(event) => { const value = Number(event.target.value); setOpacity(value); updateTextLayer({ opacity: value / 100 }); }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="workbench-context-note workbench-properties-note">
                    <Icon name="circle-alert" size={18} />
                    <div>
                      <strong>
                        {t(
                          locale,
                          '此示例仅开放文字属性',
                          'Only text properties are editable in this example',
                        )}
                      </strong>
                      <p>
                        {t(
                          locale,
                          '仍可在图层面板切换显示或锁定。',
                          'Visibility and locking remain available in the layers panel.',
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {panel === 'conversation' && (
              <div className="workbench-context__content workbench-conversation">
                <div className="workbench-context-note">
                  <Icon name="plug" size={18} />
                  <div>
                    <strong>{modelConnected ? t(locale, '模型已连接', 'Model connected') : t(locale, '尚未连接模型', 'No model connected')}</strong>
                    <p>
                      {t(
                        locale,
                        modelConnected ? '输入会提交到当前连接。' : '发送时将前往模型连接，输入会保留。',
                        modelConnected ? 'Your request will use the active connection.' : 'Sending opens model connections and keeps your draft.',
                      )}
                    </p>
                  </div>
                </div>
                <div className="workbench-conversation__scope">
                  <span>{t(locale, '目标', 'Target')}</span>
                  <strong>{t(locale, '当前文档', 'Current document')}</strong>
                </div>
                <form className="workbench-compose" onSubmit={submitPrompt}>
                  <Field label={t(locale, '修改说明', 'Edit request')}>
                    <textarea
                      rows={6}
                      value={prompt}
                      placeholder={t(
                        locale,
                        '描述希望调整的内容…',
                        'Describe the change…',
                      )}
                      onChange={(event) => setPrompt(event.target.value)}
                    />
                  </Field>
                  <div className="workbench-compose__actions">
                    <Button
                      variant="secondary"
                      icon="plug"
                      onClick={onConnections}
                    >
                      {t(locale, '连接', 'Connect')}
                    </Button>
                    <Button variant="ai" icon="arrow-up-right" type="submit">
                      {t(locale, '发送', 'Send')}
                    </Button>
                    <Button variant="ai" icon="sparkles" type="button" onClick={submitGeneration}>
                      {t(locale, '生成', 'Generate')}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {panel === 'history' && (
              <div className="workbench-context__content workbench-history">
                <p className="workbench-section-copy">
                  {t(
                    locale,
                    workspaceId ? '当前文档的场景会保存到工作区。修订时间线将在版本提交后显示。' : '示例会话只包含初始基线。预览编辑尚未保存为版本。',
                    workspaceId ? 'The current document scene is saved to the workspace. Revision events appear after a version is committed.' : 'This example session contains only its baseline. Preview edits are not saved as a version.',
                  )}
                </p>
                {workspaceId && <Button variant="secondary" icon="save" disabled={revisionBusy} onClick={() => { void saveRevision(); }}>{t(locale, '保存版本', 'Save version')}</Button>}
                <ol className="workbench-history-list">
                {tasks.filter((task) => task.state === 'completed' && task.result?.candidate).map((task) => {
                  const candidate = task.result!.candidate!;
                  const latest = revisionState.revisions[revisionState.revisions.length - 1];
                  return <li key={candidate.id}>
                    <span className="workbench-history-marker" aria-hidden="true" />
                    <div>
                      <Badge>{t(locale, '候选', 'Candidate')}</Badge>
                      <strong>{candidate.id.slice(0, 16)}</strong>
                      <p>{candidate.assetIds.length} {t(locale, '张图', 'images')}</p>
                      <div className="workbench-history-actions">
                        <Button variant="ghost" onClick={() => setCandidatePreviewId((current) => current === candidate.id ? null : candidate.id)}>{t(locale, '查看', 'View')}</Button>
                        {latest && <Button variant="ghost" onClick={() => setCompareRevisionId((current) => current === candidate.id ? null : candidate.id)}>{t(locale, '比较', 'Compare')}</Button>}
                        <Button variant="ghost" disabled={revisionBusy} onClick={() => continueCandidate(candidate.id)}>{t(locale, '继续', 'Continue')}</Button>
                        <Button variant="ghost" disabled={revisionBusy} onClick={() => { void finalizeCandidate(candidate.id); }}>{t(locale, '定稿', 'Finalize')}</Button>
                      </div>
                      {candidatePreviewId === candidate.id && <p role="status">{t(locale, `候选素材 ${candidate.assetIds.join(', ')}`, `Candidate assets ${candidate.assetIds.join(', ')}`)}</p>}
                      {compareRevisionId === candidate.id && latest && <CompareRevisions left={{ revisionId: candidate.id, sceneAssetId: candidate.sceneAssetId ?? candidate.assetIds[0] ?? 'candidate', assetIds: candidate.assetIds }} right={latest} />}
                    </div>
                  </li>;
                })}
                {revisionState.revisions.length > 0 ? revisionState.revisions.map((revision) => <li key={revision.revisionId}>
                    <span className="workbench-history-marker" aria-hidden="true" />
                    <div>
                      <Badge tone={revisionState.finalRevisionId === revision.revisionId ? 'success' : ''}>{revisionState.finalRevisionId === revision.revisionId ? t(locale, '定稿', 'Final') : t(locale, '版本', 'Version')}</Badge>
                      <strong>{revision.revisionId.slice(0, 8)}</strong>
                      <p>{new Date(revision.createdAt).toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-US')}</p>
                      <div className="workbench-history-actions">
                        {revisionState.finalRevisionId !== revision.revisionId && <Button variant="ghost" disabled={revisionBusy} onClick={() => { void finalizeRevision(revision.revisionId); }}>{t(locale, '定稿', 'Finalize')}</Button>}
                        {revision.scene && <Button variant="ghost" disabled={revisionBusy} onClick={() => { persistScene(revision.scene!); syncTextState(revision.scene!); setRevisionBaseId(revision.revisionId); notify(t(locale, '已载入旧版', 'Older version loaded')); }}>{t(locale, '继续', 'Continue')}</Button>}
                        {revisionState.revisions.length > 1 && <Button variant="ghost" onClick={() => setCompareRevisionId((current) => current === revision.revisionId ? null : revision.revisionId)}>{t(locale, '比较', 'Compare')}</Button>}
                      </div>
                      {compareRevisionId === revision.revisionId && <CompareRevisions left={revision} right={revisionState.revisions[revisionState.revisions.length - 1]} />}
                    </div>
                  </li>) : <li>
                    <span
                      className="workbench-history-marker"
                      aria-hidden="true"
                    />
                    <div>
                      <Badge>{t(locale, '示例', 'Example')}</Badge>
                      <strong>
                        {t(locale, '示例起点', 'Example baseline')}
                      </strong>
                      <p>{t(locale, '打开主海报', 'Main poster opened')}</p>
                    </div>
                  </li>}
                </ol>
              </div>
            )}

            {panel === 'tools' && (
              <div className="workbench-context__content workbench-tools">
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="maximize-2" /></span>
                  <div>
                    <strong>{t(locale, '调整尺寸', 'Resize canvas')}</strong>
                    <p>{t(locale, '本地处理，可撤销或继续编辑。', 'Local transform; continue editing after apply.')}</p>
                    <div className="workbench-coordinate-grid">
                      <Field label={t(locale, '宽度', 'Width')}><input type="number" min="1" value={resizeWidth} onChange={(event) => setResizeWidth(Number(event.target.value))} /></Field>
                      <Field label={t(locale, '高度', 'Height')}><input type="number" min="1" value={resizeHeight} onChange={(event) => setResizeHeight(Number(event.target.value))} /></Field>
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => {
                    try {
                      persistScene(resizeScene(scene, { width: resizeWidth, height: resizeHeight }));
                      notify(t(locale, '尺寸已更新', 'Canvas resized'));
                    } catch { notify(t(locale, '尺寸无效', 'Invalid size')); }
                  }}>{t(locale, '应用', 'Apply')}</Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon">
                    <Icon name="rotate-ccw" />
                  </span>
                  <div>
                    <strong>
                      {t(locale, '旋转画布对象', 'Rotate canvas object')}
                    </strong>
                    <p>
                      {t(
                        locale,
                        '本地预览，不创建版本。',
                        'Local preview; no version is created.',
                      )}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRotation((value) => value - 90);
                      notify(t(locale, '已旋转预览', 'Preview rotated'));
                    }}
                  >
                    {t(locale, '旋转', 'Rotate')}
                  </Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon">
                    <Icon name="wand-sparkles" />
                  </span>
                  <div>
                    <strong>{t(locale, '智能裁切', 'Smart crop')}</strong>
                    <p>
                      {t(
                        locale,
                        '需要连接支持此功能的模型。',
                        'Connect a model that supports this tool.',
                      )}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    icon="plug"
                    onClick={() => runImageTask('smart-crop', 'Smart crop while preserving the primary subject')}
                  >
                    {t(locale, '连接', 'Connect')}
                  </Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="eraser" /></span>
                  <div>
                    <strong>{t(locale, '去除背景', 'Remove background')}</strong>
                    <p>{t(locale, '保留主体，生成透明背景副本。', 'Keep the subject and create a transparent-background copy.')}</p>
                  </div>
                  <Button aria-label={t(locale, '去除背景', 'Remove background')} variant="secondary" icon="wand-sparkles" onClick={() => runImageTask('remove-background', 'Remove the background and preserve the subject with clean edges')}>{t(locale, '执行', 'Run')}</Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="image-plus" /></span>
                  <div>
                    <strong>{t(locale, '替换背景', 'Replace background')}</strong>
                    <p>{t(locale, '使用描述生成新的背景方向。', 'Generate a new background direction from a description.')}</p>
                  </div>
                  <Button aria-label={t(locale, '替换背景', 'Replace background')} variant="secondary" icon="image-plus" onClick={() => runImageTask('replace-background', 'Replace the background while preserving the original subject')}>{t(locale, '执行', 'Run')}</Button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className="workbench-statusbar">
        <span>
          {t(locale, '选中', 'Selected')}: {layerCopy[selectedLayer].label}
        </span>
        <span>
          {visibility[selectedLayer]
            ? t(locale, '可见', 'Visible')
            : t(locale, '隐藏', 'Hidden')}
        </span>
        <span>{t(locale, '示例会话', 'Example session')}</span>
      </footer>
    </section>
  );
};
