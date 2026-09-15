import { useEffect, useId, useState, type CSSProperties, type FormEvent } from 'react';

import type { Locale } from '../i18n';
import type { Project } from './types';
import { Drawer } from './Drawer';
import { CanvasWorkspace, type CanvasAssetAction } from '../../features/canvas/CanvasWorkspace';
import type { Region } from '../../features/canvas/selection';
import { createScene, replaceSceneLayer, type DesignScene, type TextLayer } from '../../features/canvas/scene';
import { getDesktopApi } from '../../platform/runtime';
import { resizeScene } from '../../features/image-tools/local-transform';
import { defaultToolParams, validateToolParams, type ImageTool, type ToolParams } from '../../features/image-tools/target';
import { ToolInspector } from '../../features/image-tools/ToolInspector';
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
  Modal,
  t,
} from './ui';
import './workbench.css';

type LayerId = 'text' | 'shape' | 'image';
type ContextPanel = 'properties' | 'conversation' | 'history' | 'tools';
type LayerState = Record<LayerId, boolean>;
type RevisionState = { revisions: RevisionRecord[]; timeline: RevisionTimelineEvent[]; finalRevisionId: string | null };

const toolPrompt: Record<ImageTool, string> = {
  'remove-background': 'Remove the background and preserve the subject with clean edges',
  'replace-background': 'Replace the background while preserving the original subject',
  'remove-object': 'Remove the selected object and reconstruct the surrounding detail',
  inpaint: 'Inpaint the selected region according to the requested direction',
  expand: 'Expand the canvas edges while preserving the primary composition',
  'smart-crop': 'Smart crop while preserving the primary subject',
  upscale: 'Upscale the image while preserving important details',
  resize: 'Resize the image',
};

const toolName = (locale: Locale, tool: ImageTool): string => {
  const labels: Record<ImageTool, [string, string]> = {
    'remove-background': ['去除背景', 'Remove background'],
    'replace-background': ['替换背景', 'Replace background'],
    'remove-object': ['移除对象', 'Remove object'],
    inpaint: ['局部重绘', 'Inpaint'],
    expand: ['扩展画布', 'Expand canvas'],
    'smart-crop': ['智能裁切', 'Smart crop'],
    upscale: ['放大图像', 'Upscale image'],
    resize: ['调整尺寸', 'Resize'],
  };
  const [zh, en] = labels[tool];
  return t(locale, zh, en);
};

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
  onSubmitImageTask?: (input: { tool: ImageTool; prompt: string; params: ToolParams; baseRevisionId: string | null; region?: Region }) => void | Promise<void>;
  onSubmitImageGeneration?: (prompt: string, baseRevisionId: string | null) => void | Promise<void>;
  operatorName?: string;
  modelConnected?: boolean;
  readOnly?: boolean;
  notify: (message: string) => void;
  assetAction?: CanvasAssetAction;
  onAssetActionHandled?: (actionId: string) => void;
};

const createInitialScene = (project: Project, documentId?: string): DesignScene => {
  const document = project.documentEntries?.find((entry) => entry.id === documentId) ?? project.documentEntries?.[0];
  if (project.workspaceId && !document) {
    return createScene({ id: `${project.id}-scene`, width: 1, height: 1, layers: [] });
  }
  const width = document?.width ?? 1080;
  const height = document?.height ?? 1440;
  if (project.workspaceId) {
    return createScene({ id: `${project.id}-scene`, width, height, layers: [] });
  }
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

const contributionRoleLabel = (locale: Locale, role: 'lead' | 'direction' | 'revision'): string => {
  if (role === 'lead') return t(locale, '主导', 'Lead');
  if (role === 'direction') return t(locale, '方向', 'Direction');
  return t(locale, '修订', 'Revision');
};

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
  readOnly = false,
  notify,
  assetAction,
  onAssetActionHandled,
}: WorkbenchProps) => {
  const layersTitleId = useId();
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
  const [panel, setPanel] = useState<ContextPanel>('properties');
  const [panelOpen, setPanelOpen] = useState(true);
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
  const [toolRegion, setToolRegion] = useState<Region | undefined>();
  const [activeTool, setActiveTool] = useState<ImageTool | null>(null);
  const [toolParams, setToolParams] = useState<ToolParams>({});
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
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly || !workspaceId || !documentId || revisionBusy) return;
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
    if (readOnly || !workspaceId || !documentId || revisionBusy) return;
    setRevisionBusy(true);
    try {
      const result = await getDesktopApi().setFinalDocumentRevision?.({ workspaceId, projectId: project.id, documentId, revisionId });
      if (result) setRevisionState((current) => ({ ...current, finalRevisionId: revisionId, timeline: current.timeline }));
    } catch { notify(t(locale, '定稿失败', 'Could not finalize version')); }
    finally { setRevisionBusy(false); }
  };
  const finalizeCandidate = async (candidateId: string): Promise<void> => {
    const entry = candidateFor(candidateId);
    if (readOnly || !workspaceId || !documentId || !entry || revisionBusy || entry.candidate.assetIds.length === 0) return;
    setRevisionBusy(true);
    try {
      const contribution = revisionContributions('revision');
      const imageLayer = scene.layers.find((layer): layer is Extract<typeof layer, { type: 'image' }> => layer.type === 'image');
      const candidateScene = imageLayer
        ? replaceSceneLayer(scene, { ...imageLayer, assetId: entry.candidate.sceneAssetId ?? entry.candidate.assetIds[0]! })
        : undefined;
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
        ...(candidateScene ? { scene: candidateScene } : {}),
      });
      if (!committed) return;
      await getDesktopApi().setFinalDocumentRevision?.({ workspaceId, projectId: project.id, documentId, revisionId: committed.revisionId });
      if (candidateScene) persistScene(candidateScene);
      const loaded = await getDesktopApi().loadDocumentRevisions?.(workspaceId, project.id, documentId);
      if (loaded) setRevisionState(loaded);
      notify(t(locale, '候选已定稿', 'Candidate finalized'));
    } catch { notify(t(locale, '候选定稿失败', 'Could not finalize candidate')); }
    finally { setRevisionBusy(false); }
  };
  const continueCandidate = (candidateId: string): void => {
    if (readOnly) return;
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
    if (readOnly) return;
    setVisibility((current) => ({ ...current, [layer]: !current[layer] }));
  };
  const updateLocked = (layer: LayerId): void => {
    if (readOnly) return;
    setLocked((current) => ({ ...current, [layer]: !current[layer] }));
  };
  const updatePosition = (axis: 'x' | 'y', rawValue: string): void => {
    if (readOnly) return;
    const value = Number(rawValue);
    if (Number.isFinite(value)) {
      const nextValue = clamp(value, -999, 999);
      setPosition((current) => ({ ...current, [axis]: nextValue }));
      updateTextLayer({ [axis]: nextValue });
    }
  };
  const showPanel = (nextPanel: ContextPanel): void => {
    setPanel(nextPanel);
    setPanelOpen(true);
  };
  const selectWorkbenchLayer = (layerId: LayerId): void => {
    setSelectedLayer(layerId);
    showPanel('properties');
  };
  const resetZoom = (): void => {
    setZoom(68);
    notify(t(locale, '缩放已重置', 'Preview zoom reset'));
  };
  const submitPrompt = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (readOnly) return;
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
    if (readOnly) return;
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
  const submitImageTask = (tool: ImageTool, taskPrompt: string, params: ToolParams, region?: Region): void => {
    if (readOnly) return;
    if (!onSubmitImageTask) {
      onConnections();
      return;
    }
    if (!validateToolParams(tool, params).ok) {
      notify(t(locale, '参数无效', 'Invalid parameters'));
      return;
    }
    void Promise.resolve(onSubmitImageTask({ tool, prompt: taskPrompt, params, baseRevisionId: currentRevisionId, ...(region ? { region } : {}) })).catch(() => notify(t(locale, '任务提交失败', 'Task submission failed')));
  };
  const configureImageTool = (tool: ImageTool): void => {
    setActiveTool(tool);
    setToolParams(defaultToolParams(tool, { width: scene.width, height: scene.height }));
    setToolRegion(undefined);
  };
  const runConfiguredTool = (region?: Region): void => {
    if (!activeTool) return;
    if (onSubmitImageTask && !validateToolParams(activeTool, toolParams).ok) {
      notify(t(locale, '参数无效', 'Invalid parameters'));
      return;
    }
    submitImageTask(activeTool, toolPrompt[activeTool], toolParams, region);
    setActiveTool(null);
    setToolRegion(undefined);
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
                aria-pressed={panelOpen && panel === panelId}
                onClick={() => showPanel(panelId)}
              />
            ))}
          </div>
          <Button variant="primary" icon="download" onClick={onExport}>
            {t(locale, '导出', 'Export')}
          </Button>
        </div>
      </header>

      <div className="workbench-body">
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
                showPanel('properties');
                setLayersExpanded(true);
              }}
            />
            <IconButton
              name="type"
              label={t(locale, '文本工具', 'Text tool')}
              onClick={() => selectWorkbenchLayer('text')}
            />
            {hasShapeLayer && (
              <IconButton
                name="square"
                label={t(locale, '形状工具', 'Shape tool')}
                onClick={() => selectWorkbenchLayer('shape')}
              />
            )}
            <IconButton
              name="image"
              label={t(locale, '图像工具', 'Image tool')}
              onClick={() => selectWorkbenchLayer('image')}
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
                      onClick={() => selectWorkbenchLayer(layerId)}
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
                readOnly={readOnly}
                workspaceId={workspaceId}
                projectId={project.id}
                documentId={documentId}
                assetAction={assetAction}
                onAssetActionHandled={onAssetActionHandled}
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

      </div>
      <Drawer
        open={panelOpen}
        title={panelCopy[panel].label}
        locale={locale}
        onClose={() => setPanelOpen(false)}
      >
          <div className="workbench-context">
            <div className="workbench-panel-heading workbench-context__heading">
              <div>
                <p>{t(locale, '上下文', 'Context')}</p>
                <h2>{panelCopy[panel].label}</h2>
              </div>
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
                        disabled={readOnly || locked.text}
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
                            disabled={readOnly || locked.text}
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
                            disabled={readOnly || locked.text}
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
                        disabled={readOnly || locked.text}
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
                      disabled={readOnly}
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
                      disabled={readOnly}
                    >
                      {t(locale, '连接', 'Connect')}
                    </Button>
                    <Button variant="ai" icon="arrow-up-right" type="submit" disabled={readOnly}>
                      {t(locale, '发送', 'Send')}
                    </Button>
                    <Button variant="ai" icon="sparkles" type="button" onClick={submitGeneration} disabled={readOnly}>
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
                {workspaceId && <Button variant="secondary" icon="save" disabled={readOnly || revisionBusy} onClick={() => { void saveRevision(); }}>{t(locale, '保存版本', 'Save version')}</Button>}
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
                        <Button variant="ghost" disabled={readOnly || revisionBusy} onClick={() => continueCandidate(candidate.id)}>{t(locale, '继续', 'Continue')}</Button>
                        <Button variant="ghost" disabled={readOnly || revisionBusy} onClick={() => { void finalizeCandidate(candidate.id); }}>{t(locale, '定稿', 'Finalize')}</Button>
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
                      {revision.contributions.length > 0 && <p className="workbench-history-contributors"><span>{t(locale, '贡献', 'Contributors')}:</span> {revision.contributions.map((contribution) => `${contribution.designerName ?? contribution.designerVersionId} · ${contributionRoleLabel(locale, contribution.role)}`).join('，')}</p>}
                      {revision.operatorName && <p className="workbench-history-operator"><span>{t(locale, '操作者', 'Operator')}:</span> {revision.operatorName}</p>}
                      <div className="workbench-history-actions">
                        {revisionState.finalRevisionId !== revision.revisionId && <Button variant="ghost" disabled={readOnly || revisionBusy} onClick={() => { void finalizeRevision(revision.revisionId); }}>{t(locale, '定稿', 'Finalize')}</Button>}
                        {revision.scene && <Button variant="ghost" disabled={readOnly || revisionBusy} onClick={() => { persistScene(revision.scene!); syncTextState(revision.scene!); setRevisionBaseId(revision.revisionId); notify(t(locale, '已载入旧版', 'Older version loaded')); }}>{t(locale, '继续', 'Continue')}</Button>}
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
                      <Field label={t(locale, '宽度', 'Width')}><input type="number" min="1" value={resizeWidth} disabled={readOnly} onChange={(event) => setResizeWidth(Number(event.target.value))} /></Field>
                      <Field label={t(locale, '高度', 'Height')}><input type="number" min="1" value={resizeHeight} disabled={readOnly} onChange={(event) => setResizeHeight(Number(event.target.value))} /></Field>
                    </div>
                  </div>
                  <Button variant="secondary" disabled={readOnly} onClick={() => {
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
                    disabled={readOnly}
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
                    icon="sliders-horizontal"
                    aria-label={t(locale, '配置智能裁切', 'Configure smart crop')}
                    disabled={readOnly}
                    onClick={() => configureImageTool('smart-crop')}
                  >
                    {t(locale, '配置', 'Configure')}
                  </Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="eraser" /></span>
                  <div>
                    <strong>{t(locale, '去除背景', 'Remove background')}</strong>
                    <p>{t(locale, '保留主体，生成透明背景副本。', 'Keep the subject and create a transparent-background copy.')}</p>
                  </div>
                  <Button aria-label={t(locale, '配置去除背景', 'Configure remove background')} variant="secondary" icon="sliders-horizontal" disabled={readOnly} onClick={() => configureImageTool('remove-background')}>{t(locale, '配置', 'Configure')}</Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="image-plus" /></span>
                  <div>
                    <strong>{t(locale, '替换背景', 'Replace background')}</strong>
                    <p>{t(locale, '使用描述生成新的背景方向。', 'Generate a new background direction from a description.')}</p>
                  </div>
                  <Button aria-label={t(locale, '配置替换背景', 'Configure replace background')} variant="secondary" icon="sliders-horizontal" disabled={readOnly} onClick={() => configureImageTool('replace-background')}>{t(locale, '配置', 'Configure')}</Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="eraser" /></span>
                  <div>
                    <strong>{t(locale, '移除对象', 'Remove object')}</strong>
                    <p>{t(locale, '移除选区中的对象并保留周围细节。', 'Remove an object from a selected region while preserving nearby detail.')}</p>
                  </div>
                  <Button aria-label={t(locale, '配置移除对象', 'Configure remove object')} variant="secondary" icon="sliders-horizontal" disabled={readOnly} onClick={() => configureImageTool('remove-object')}>{t(locale, '配置', 'Configure')}</Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="paintbrush" /></span>
                  <div>
                    <strong>{t(locale, '局部重绘', 'Inpaint')}</strong>
                    <p>{t(locale, '根据描述重绘选区内容。', 'Redraw a selected region from a description.')}</p>
                  </div>
                  <Button aria-label={t(locale, '配置局部重绘', 'Configure inpaint')} variant="secondary" icon="sliders-horizontal" disabled={readOnly} onClick={() => configureImageTool('inpaint')}>{t(locale, '配置', 'Configure')}</Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="expand" /></span>
                  <div>
                    <strong>{t(locale, '扩展画布', 'Expand canvas')}</strong>
                    <p>{t(locale, '延展画布边缘并保持主体构图。', 'Extend the canvas while preserving the primary composition.')}</p>
                  </div>
                  <Button aria-label={t(locale, '配置扩展画布', 'Configure expand canvas')} variant="secondary" icon="sliders-horizontal" disabled={readOnly} onClick={() => configureImageTool('expand')}>{t(locale, '配置', 'Configure')}</Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="scan-line" /></span>
                  <div>
                    <strong>{t(locale, '放大图像', 'Upscale image')}</strong>
                    <p>{t(locale, '提升图像尺寸并尽量保留细节。', 'Increase image resolution while preserving detail.')}</p>
                  </div>
                  <Button aria-label={t(locale, '配置放大图像', 'Configure upscale image')} variant="secondary" icon="sliders-horizontal" disabled={readOnly} onClick={() => configureImageTool('upscale')}>{t(locale, '配置', 'Configure')}</Button>
                </div>
              </div>
            )}
          </div>
      </Drawer>

      <footer className="workbench-statusbar">
        <span>
          {t(locale, '选中', 'Selected')}: {layerCopy[selectedLayer].label}
        </span>
        <span>
          {visibility[selectedLayer]
            ? t(locale, '可见', 'Visible')
            : t(locale, '隐藏', 'Hidden')}
        </span>
        <span>{workspaceId ? t(locale, '本地会话', 'Local session') : t(locale, '示例会话', 'Example session')}</span>
      </footer>
      {activeTool && <Modal title={toolName(locale, activeTool)} locale={locale} onClose={() => setActiveTool(null)}>
        <ToolInspector
          tool={activeTool}
          tools={[activeTool]}
          params={toolParams}
          locale={locale}
          readOnly={readOnly}
          image={{ width: scene.width, height: scene.height }}
          region={toolRegion}
          onToolChange={(tool) => configureImageTool(tool)}
          onParamsChange={setToolParams}
          onRegionChange={setToolRegion}
          onApplyRegion={setToolRegion}
          onCancelRegion={() => setActiveTool(null)}
          onClearRegion={() => setToolRegion(undefined)}
          onRun={runConfiguredTool}
        />
      </Modal>}
    </section>
  );
};
