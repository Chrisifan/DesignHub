import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationImageAttachment } from '../../features/agent/task-service';
import type { ProjectDesign, ProjectCanvasLayout } from '../../features/projects/metadata';
import type { ProjectGenerationRatio } from '../../features/projects/size';
import type { TaskRecord } from '../../features/tasks/state';
import { createScene, type DesignScene } from '../../features/canvas/scene';
import type { Region } from '../../features/canvas/selection';
import { defaultToolParams, imageTools, validateToolParams, type ImageTool, type ToolParams } from '../../features/image-tools/target';
import { ToolInspector, ToolInspectorActions } from '../../features/image-tools/ToolInspector';
import { getDesktopApi } from '../../platform/runtime';
import type { Locale } from '../i18n';
import type { PersonaProfile } from './personas';
import type { Project } from './types';
import { ConversationDock, type ConversationDockAttachment } from './ConversationDock';
import { AnalysisPanel, type AnalysisPanelRequest } from './AnalysisPanel';
import { layoutProjectDesigns, ProjectCanvasStage } from './ProjectCanvasStage';
import { Icon, IconButton, Modal, t } from './ui';
import { Tooltip } from './Tooltip';
import './workbench.css';
import './project-canvas.css';
import { readImageFile } from '../../features/assets/image-input';
import { itemErrorMessage } from '../../features/image-tools/image-tools-copy';
import { NeuralPresence, type PresenceMode } from '../previews/AgentConstellationPreview';

type ProjectCanvasProps = {
  locale: Locale;
  project: Project;
  libraryId?: string;
  readOnly: boolean;
  conversationConnected: boolean;
  designer: PersonaProfile | null;
  designerOptions?: PersonaProfile[];
  onDesignerChange?: (designerId: string) => void;
  onDesignsChange?: (designs: ProjectDesign[]) => void;
  onGenerationRatioChange?: (ratio: ProjectGenerationRatio) => void;
  notify: (message: string) => void;
  onBack: () => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onConnections: () => void;
  onSubmitImageTask?: (input: { tool: ImageTool; prompt: string; params: ToolParams; baseRevisionId: string | null; targetLayerId: string; region?: Region; beforeScene: DesignScene }) => TaskRecord | null | void | Promise<TaskRecord | null | void>;
  onSubmitConversation: (message: string, attachments: ConversationImageAttachment[], context?: { analysisThreadId?: string; conversationParentTaskId?: string; referencedAssetIds?: string[] }) => Promise<TaskRecord | null>;
  onSubmitDesignGeneration: (conversationTaskId: string, generationRatio: ProjectGenerationRatio, count: 1 | 3) => Promise<TaskRecord | null>;
};

const imageToolCopy: Record<ImageTool, { zh: string; en: string; icon: string; prompt: string }> = {
  'remove-background': { zh: '去除背景', en: 'Remove background', icon: 'eye-off', prompt: 'Remove the background and preserve the subject with clean edges' },
  'replace-background': { zh: '替换背景', en: 'Replace background', icon: 'palette', prompt: 'Replace the background while preserving the original subject' },
  'remove-object': { zh: '移除对象', en: 'Remove object', icon: 'trash-2', prompt: 'Remove the selected object and reconstruct the surrounding detail' },
  inpaint: { zh: '局部重绘', en: 'Inpaint', icon: 'pencil', prompt: 'Inpaint the selected region according to the requested direction' },
  expand: { zh: '扩展图片', en: 'Expand image', icon: 'arrow-up-right', prompt: 'Expand the image edges while preserving the primary composition' },
  'smart-crop': { zh: '智能裁切', en: 'Smart crop', icon: 'crop', prompt: 'Smart crop while preserving the primary subject' },
  upscale: { zh: '放大图像', en: 'Upscale image', icon: 'zoom-in', prompt: 'Upscale the image while preserving important details' },
  resize: { zh: '调整尺寸', en: 'Resize', icon: 'maximize-2', prompt: 'Resize the image' },
  'remove-watermark': { zh: '移除水印', en: 'Remove watermark', icon: 'layout-grid', prompt: 'Remove a watermark only from an explicitly selected region' },
};

const canvasLayoutSaveDelayMs = 250;

type PendingCanvasLayoutSave = {
  libraryId: string;
  projectId: string;
  layout: ProjectCanvasLayout;
};

type QueuedCanvasLayoutSave = {
  input: PendingCanvasLayoutSave;
  ready: boolean;
};

const canvasLayoutSaveKey = (libraryId: string, projectId: string): string => `${libraryId}\0${projectId}`;

const isLayoutSaveForProject = (
  save: PendingCanvasLayoutSave | null,
  libraryId: string,
  projectId: string,
): boolean => save?.libraryId === libraryId && save.projectId === projectId;

const imageToolResultSize = (task: TaskRecord, source: ProjectDesign): { width: number; height: number } => {
  const params = task.toolParams ?? {};
  if (task.tool === 'resize' || task.tool === 'smart-crop') {
    return { width: Number(params.width), height: Number(params.height) };
  }
  if (task.tool === 'expand') {
    return {
      width: source.width + Number(params.left) + Number(params.right),
      height: source.height + Number(params.top) + Number(params.bottom),
    };
  }
  if (task.tool === 'upscale') {
    const scale = Number(params.scale);
    return { width: source.width * scale, height: source.height * scale };
  }
  return { width: source.width, height: source.height };
};

export const getPendingCanvasDesigns = (tasks: readonly TaskRecord[], designs: readonly ProjectDesign[]) => tasks.flatMap((task) => {
  if ((task.capability !== 'image-editing' && task.capability !== 'local-transform')
    || !['queued', 'running', 'unknown'].includes(task.state)
    || !task.tool
    || !task.sourceAssetId
    || designs.some((design) => design.sourceTaskId === task.id
      || (task.result?.assetIds ?? []).includes(design.assetId)
      || task.result?.toolCandidate?.resultAssetId === design.assetId)) return [];
  const source = (task.sourceDesignId ? designs.find((design) => design.id === task.sourceDesignId) : undefined)
    ?? designs.find((design) => design.assetId === task.sourceAssetId);
  if (!source) return [];
  const size = imageToolResultSize(task, source);
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) return [];
  return [{ id: task.id, rowKey: source.sourceTaskId, anchorId: source.id, width: size.width, height: size.height, status: task.state, ...(task.errorCode ? { errorCode: task.errorCode } : {}) }];
});

const isImageToolTask = (task: TaskRecord): boolean => task.capability === 'image-editing' || task.capability === 'local-transform';

const taskProducesDesign = (task: TaskRecord, design: ProjectDesign): boolean => (
  isImageToolTask(task)
  && (task.id === design.sourceTaskId
    || (task.result?.assetIds ?? []).includes(design.assetId)
    || task.result?.toolCandidate?.resultAssetId === design.assetId)
);

const imageToolTaskForDesign = (tasks: readonly TaskRecord[], design: ProjectDesign): TaskRecord | undefined => tasks.find((task) => taskProducesDesign(task, design));

export const imageToolDesignRowKeys = (tasks: readonly TaskRecord[], designs: readonly ProjectDesign[]): Record<string, string> => {
  const byAsset = new Map(designs.map((design) => [design.assetId, design]));
  const rowKeys: Record<string, string> = {};
  designs.forEach((design) => {
    const task = imageToolTaskForDesign(tasks, design);
    if (!task?.sourceAssetId) return;
    const source = (task.sourceDesignId ? designs.find((candidate) => candidate.id === task.sourceDesignId) : undefined)
      ?? byAsset.get(task.sourceAssetId);
    if (source) rowKeys[design.id] = source.sourceTaskId;
  });
  return rowKeys;
};

export const imageToolDesignAnchors = (tasks: readonly TaskRecord[], designs: readonly ProjectDesign[]): Record<string, string> => {
  const byAsset = new Map(designs.map((design) => [design.assetId, design]));
  const anchors: Record<string, string> = {};
  designs.forEach((design) => {
    const task = imageToolTaskForDesign(tasks, design);
    const source = task?.sourceDesignId
      ? designs.find((candidate) => candidate.id === task.sourceDesignId)
      : task?.sourceAssetId ? byAsset.get(task.sourceAssetId) : undefined;
    if (source) anchors[design.id] = source.id;
  });
  return anchors;
};

const toAttachment = (attachment: ConversationDockAttachment): ConversationImageAttachment => ({ name: attachment.name, mimeType: attachment.mimeType, bytes: attachment.bytes });

const bytesToDataUrl = (mimeType: string, bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
};

const attachmentIdentity = (attachment: ConversationDockAttachment): string => {
  if (attachment.assetId) return `asset:${attachment.assetId}`;
  return `upload:${attachment.name}:${attachment.mimeType}:${Array.from(attachment.bytes).join(',')}`;
};

export const getAnalysisHistory = (
  tasks: TaskRecord[],
  threadId: string | undefined,
  displayedTask?: TaskRecord,
): TaskRecord[] => {
  const activeThreadId = threadId ?? displayedTask?.analysisThreadId;
  const history = tasks.filter((task) => (
    task.capability === 'conversation'
    && task.analysisThreadId === activeThreadId
  ));
  if (displayedTask?.capability === 'conversation' && !history.some((task) => task.id === displayedTask.id)) {
    history.push(displayedTask);
  }
  return history.sort((a, b) => (
    (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id.localeCompare(a.id)
  ));
};

export const getLatestConversationTask = (tasks: TaskRecord[]): TaskRecord | undefined => tasks
  .filter((task) => task.capability === 'conversation')
  .sort((a, b) => (
    (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id.localeCompare(a.id)
  ))[0];

const getAnalysisStatus = (task: TaskRecord, locale: Locale): { icon: string; kind: 'completed' | 'running' | 'failed'; label: string } => {
  if (task.state === 'completed') return { icon: 'circle-check', kind: 'completed', label: t(locale, '已完成', 'Completed') };
  if (task.state === 'cancelled') return { icon: 'circle-alert', kind: 'failed', label: t(locale, '已取消', 'Cancelled') };
  if (task.state === 'failed') return { icon: 'circle-alert', kind: 'failed', label: t(locale, '失败', 'Failed') };
  return { icon: 'clock', kind: 'running', label: t(locale, '处理中', 'Processing') };
};

type AnalysisDockView = 'presence' | 'history' | 'thinking' | 'result';

export const ProjectCanvas = ({ locale, project, libraryId, readOnly, conversationConnected, designer, designerOptions = [], onDesignerChange, onDesignsChange, onGenerationRatioChange, notify, onBack, onRename, onDuplicate, onArchive, onConnections, onSubmitImageTask, onSubmitConversation, onSubmitDesignGeneration }: ProjectCanvasProps) => {
  const [designs, setDesigns] = useState<ProjectDesign[]>(project.designs ?? []);
  const onDesignsChangeRef = useRef(onDesignsChange);
  onDesignsChangeRef.current = onDesignsChange;
  const [layout, setLayout] = useState<ProjectCanvasLayout | undefined>(project.canvasLayout);
  const [selectedDesignIds, setSelectedDesignIds] = useState<string[]>(project.canvasLayout?.selectedDesignIds ?? []);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [conversationSubmitting, setConversationSubmitting] = useState(false);
  const [activeTool, setActiveTool] = useState<ImageTool | null>(null);
  const [toolParams, setToolParams] = useState<ToolParams>({});
  const [toolRegion, setToolRegion] = useState<Region>();
  const [imageToolSubmitting, setImageToolSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<ConversationDockAttachment[]>([]);
  const [threadId, setThreadId] = useState<string>();
  const [latestConversation, setLatestConversation] = useState<TaskRecord>();
  const [selectedAnalysisTaskId, setSelectedAnalysisTaskId] = useState<string>();
  const [analysisAttachments, setAnalysisAttachments] = useState<ConversationDockAttachment[]>([]);
  const analysisOpen = true;
  const [analysisCollapsed, setAnalysisCollapsed] = useState(false);
  const [analysisHistoryOpen, setAnalysisHistoryOpen] = useState(false);
  const [analysisThinking, setAnalysisThinking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [referencedAssetIds, setReferencedAssetIds] = useState<string[]>([]);
  const imageTaskStatesRef = useRef<Map<string, TaskRecord['state']>>(new Map());
  const imageTaskStatesInitializedRef = useRef(false);
  const analysisPresenceRef = useRef<HTMLButtonElement>(null);
  const analysisHistoryWasOpenRef = useRef(false);
  const layoutSaveTimersRef = useRef<Map<string, number>>(new Map());
  const queuedLayoutSavesRef = useRef<Map<string, QueuedCanvasLayoutSave>>(new Map());
  const inFlightLayoutSaveRef = useRef<PendingCanvasLayoutSave | null>(null);
  const drainLayoutSavesRef = useRef<() => void>(() => undefined);
  const localLayoutAuthorityRef = useRef<Set<string>>(new Set());
  const layoutMutationVersionRef = useRef(0);
  const projectScopeRef = useRef({ libraryId, projectId: project.id });
  if (projectScopeRef.current.libraryId !== libraryId || projectScopeRef.current.projectId !== project.id) {
    projectScopeRef.current = { libraryId, projectId: project.id };
  }

  const drainLayoutSaves = useCallback((): void => {
    if (inFlightLayoutSaveRef.current) return;
    const readyEntry = [...queuedLayoutSavesRef.current.entries()].find(([, queued]) => queued.ready);
    if (!readyEntry) return;
    const [key, queued] = readyEntry;
    queuedLayoutSavesRef.current.delete(key);
    const pending = queued.input;
    const save = getDesktopApi().saveProjectCanvasLayout;
    if (!save) {
      drainLayoutSavesRef.current();
      return;
    }
    inFlightLayoutSaveRef.current = pending;
    const finish = (): void => {
      if (inFlightLayoutSaveRef.current === pending) inFlightLayoutSaveRef.current = null;
      drainLayoutSavesRef.current();
    };
    try {
      void save(pending).then(finish, finish);
    } catch {
      finish();
    }
  }, []);
  drainLayoutSavesRef.current = drainLayoutSaves;

  const flushLayoutSave = useCallback((targetLibraryId: string, targetProjectId: string): void => {
    const key = canvasLayoutSaveKey(targetLibraryId, targetProjectId);
    const timer = layoutSaveTimersRef.current.get(key);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      layoutSaveTimersRef.current.delete(key);
    }
    const queued = queuedLayoutSavesRef.current.get(key);
    if (!queued) return;
    queued.ready = true;
    drainLayoutSavesRef.current();
  }, []);

  const queueLayoutSave = useCallback((next: ProjectCanvasLayout): void => {
    setLayout(next);
    layoutMutationVersionRef.current += 1;
    if (!libraryId) return;
    const key = canvasLayoutSaveKey(libraryId, project.id);
    if (readOnly || !getDesktopApi().saveProjectCanvasLayout) {
      localLayoutAuthorityRef.current.add(key);
      return;
    }
    localLayoutAuthorityRef.current.delete(key);
    queuedLayoutSavesRef.current.set(key, {
      input: { libraryId, projectId: project.id, layout: next },
      ready: false,
    });
    const currentTimer = layoutSaveTimersRef.current.get(key);
    if (currentTimer !== undefined) window.clearTimeout(currentTimer);
    const timer = window.setTimeout(() => {
      if (layoutSaveTimersRef.current.get(key) === timer) layoutSaveTimersRef.current.delete(key);
      const queued = queuedLayoutSavesRef.current.get(key);
      if (!queued) return;
      queued.ready = true;
      drainLayoutSavesRef.current();
    }, canvasLayoutSaveDelayMs);
    layoutSaveTimersRef.current.set(key, timer);
  }, [libraryId, project.id, readOnly]);

  useEffect(() => () => {
    if (libraryId) flushLayoutSave(libraryId, project.id);
  }, [flushLayoutSave, libraryId, project.id]);

  const refresh = useCallback(async () => {
    if (!libraryId) return;
    const scope = projectScopeRef.current;
    const mutationVersion = layoutMutationVersionRef.current;
    const key = canvasLayoutSaveKey(libraryId, project.id);
    const hadLayoutWrite = localLayoutAuthorityRef.current.has(key)
      || queuedLayoutSavesRef.current.has(key)
      || isLayoutSaveForProject(inFlightLayoutSaveRef.current, libraryId, project.id);
    const [nextDesigns, nextLayout, nextTasks] = await Promise.all([
      getDesktopApi().listProjectDesigns?.({ libraryId, projectId: project.id }),
      getDesktopApi().loadProjectCanvasLayout?.({ libraryId, projectId: project.id }),
      getDesktopApi().listTasks?.(libraryId),
    ]);
    if (projectScopeRef.current !== scope) return;
    if (nextDesigns) {
      setDesigns(nextDesigns);
      onDesignsChangeRef.current?.(nextDesigns);
      setSelectedDesignIds((current) => current.filter((id) => nextDesigns.some((design) => design.id === id)));
    }
    if (nextLayout && layoutMutationVersionRef.current === mutationVersion && !hadLayoutWrite) {
      setLayout(nextLayout);
      setSelectedDesignIds(nextLayout.selectedDesignIds);
    }
    if (nextTasks) {
      const projectTasks = nextTasks.filter((task) => task.source?.kind === 'project' && task.source.id === project.id);
      if (!imageTaskStatesInitializedRef.current) {
        imageTaskStatesRef.current = new Map(projectTasks
          .filter(isImageToolTask)
          .map((task) => [task.id, task.state]));
        imageTaskStatesInitializedRef.current = true;
      }
      const persistedLatest = getLatestConversationTask(projectTasks);
      setTasks(projectTasks);
      setLatestConversation((current) => current ?? persistedLatest);
      setThreadId((current) => current ?? persistedLatest?.analysisThreadId);
    }
  }, [project.id, libraryId]);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => { void refresh(); }, 1200); return () => window.clearInterval(timer); }, [refresh]);
  useEffect(() => {
    setThreadId(undefined);
    setLatestConversation(undefined);
    setSelectedAnalysisTaskId(undefined);
    setAnalysisAttachments([]);
    setDesigns(project.designs ?? []);
    setLayout(project.canvasLayout);
    setSelectedDesignIds(project.canvasLayout?.selectedDesignIds ?? []);
    setAnalysisThinking(false);
    if (libraryId) localLayoutAuthorityRef.current.delete(canvasLayoutSaveKey(libraryId, project.id));
    setAnalysisCollapsed(false);
    imageTaskStatesRef.current.clear();
    imageTaskStatesInitializedRef.current = false;
  }, [libraryId, project.id]);
  useEffect(() => {
    const previous = imageTaskStatesRef.current;
    tasks.forEach((task) => {
      if (task.capability !== 'image-editing' && task.capability !== 'local-transform') return;
      const priorState = previous.get(task.id);
      if (priorState !== task.state && (task.state === 'failed' || task.state === 'cancelled' || task.state === 'unknown')) {
        const reason = task.errorCode ? itemErrorMessage(locale, task.errorCode) : itemErrorMessage(locale, '');
        notify(reason);
      }
      previous.set(task.id, task.state);
    });
  }, [locale, notify, tasks]);

  const latestAnalysisTask = (latestConversation ? tasks.find((task) => task.id === latestConversation.id) ?? latestConversation : undefined)
    ?? (threadId ? tasks.filter((task) => task.capability === 'conversation' && task.analysisThreadId === threadId).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0] : undefined);
  const analysisTask = selectedAnalysisTaskId
    ? tasks.find((task) => task.id === selectedAnalysisTaskId) ?? latestAnalysisTask
    : latestAnalysisTask;
  const analysisAssetKey = (analysisTask?.contextAssetIds ?? []).join('\0');
  const canGenerate = analysisTask?.state === 'completed'
    && Boolean(analysisTask.result?.text)
    && analysisTask.visualContextPlan?.clarificationRequired !== true
    && !tasks.some((task) => task.capability === 'design-generation' && (task.state === 'queued' || task.state === 'running'));
  const designTasks = tasks.filter((task) => task.capability === 'design-generation' && task.analysisThreadId === threadId);
  const pendingDesigns = [
    ...designTasks.flatMap((task) => task.generationSlots?.filter((slot) => slot.state === 'queued' || slot.state === 'running').map((slot) => ({ id: `${task.id}-${slot.id}`, rowKey: task.id, width: task.designContext?.canvas.width ?? 1080, height: task.designContext?.canvas.height ?? 1440 })) ?? []),
    ...getPendingCanvasDesigns(tasks, designs),
  ];
  const selectedDesigns = designs.filter((design) => selectedDesignIds.includes(design.id));
  const designRowKeys = imageToolDesignRowKeys(tasks, designs);
  const designAnchors = imageToolDesignAnchors(tasks, designs);
  const analysisHistory = getAnalysisHistory(tasks, threadId, analysisTask);
  const analysisRunning = analysisThinking || analysisTask?.state === 'queued' || analysisTask?.state === 'running';
  const analysisDockView: AnalysisDockView = analysisRunning
    ? 'thinking'
    : analysisCollapsed
      ? 'presence'
      : analysisHistoryOpen
        ? 'history'
        : 'result';
  const analysisPresenceMode: PresenceMode = analysisRunning ? 'thinking' : 'idle';
  useEffect(() => {
    let cancelled = false;
    const assetIds = analysisAssetKey ? analysisAssetKey.split('\0') : [];
    if (!libraryId || assetIds.length === 0) {
      setAnalysisAttachments([]);
      return () => { cancelled = true; };
    }
    void (async () => {
      const managed = await getDesktopApi().listAssets?.({ libraryId, projectId: project.id, includeContextAssets: true }) ?? [];
      const byId = new Map(managed.map((asset) => [asset.id, asset]));
      const loaded = await Promise.all(assetIds.map(async (assetId) => {
        const asset = byId.get(assetId);
        if (!asset?.mimeType.startsWith('image/')) return null;
        const bytes = await getDesktopApi().readAsset?.({ libraryId, projectId: project.id, assetId });
        if (!bytes) return null;
        return { assetId, name: asset.name, mimeType: asset.mimeType, bytes, previewUrl: bytesToDataUrl(asset.mimeType, bytes) } satisfies ConversationDockAttachment;
      }));
      if (!cancelled) setAnalysisAttachments(loaded.filter((entry): entry is NonNullable<(typeof loaded)[number]> => entry !== null));
    })();
    return () => { cancelled = true; };
  }, [analysisAssetKey, analysisTask?.id, project.id, libraryId]);
  useEffect(() => {
    if (analysisTask && analysisTask.state !== 'queued' && analysisTask.state !== 'running') setAnalysisThinking(false);
  }, [analysisTask?.id, analysisTask?.state]);
  useEffect(() => {
    if (!analysisHistoryOpen && analysisHistoryWasOpenRef.current && !analysisRunning) {
      window.requestAnimationFrame(() => analysisPresenceRef.current?.focus());
    }
    analysisHistoryWasOpenRef.current = analysisHistoryOpen;
  }, [analysisHistoryOpen, analysisRunning]);
  const submit = async (): Promise<void> => {
    if (readOnly || !message.trim()) return;
    const currentMessage = message;
    const currentAttachments = attachments;
    setMessage('');
    setAttachments([]);
    setReferencedAssetIds([]);
    setAnalysisAttachments(currentAttachments);
    setAnalysisHistoryOpen(false);
    setAnalysisCollapsed(false);
    setAnalysisThinking(true);
    const userAttachments = currentAttachments.filter((attachment) => !attachment.assetId).map(toAttachment);
    const context = {
      ...(threadId ? { analysisThreadId: threadId, conversationParentTaskId: analysisTask?.id } : {}),
      ...(referencedAssetIds.length ? { referencedAssetIds } : {}),
    };
    setConversationSubmitting(true);
    try {
      const task = await onSubmitConversation(currentMessage, userAttachments, context);
      if (task) {
        setThreadId(task.analysisThreadId);
        setLatestConversation(task);
        setSelectedAnalysisTaskId(task.id);
        setAnalysisCollapsed(false);
        setAnalysisThinking(task.state === 'queued' || task.state === 'running');
        void refresh();
      } else {
        setAnalysisThinking(false);
      }
    } finally {
      setConversationSubmitting(false);
    }
  };
  const generate = async (count: 1 | 3): Promise<void> => {
    if (!analysisTask || !canGenerate) return;
    await onSubmitDesignGeneration(analysisTask.id, project.generationRatio ?? 'original', count);
    void refresh();
  };
  const configureImageTool = (tool: ImageTool): void => {
    const design = selectedDesigns.length === 1 ? selectedDesigns[0] : undefined;
    if (!design) {
      notify(t(locale, '请先选择一张图片。', 'Select an image first.'));
      return;
    }
    setActiveTool(tool);
    setToolParams(defaultToolParams(tool, design));
    setToolRegion(undefined);
  };
  const runImageTool = async (region?: Region): Promise<void> => {
    const design = selectedDesigns.length === 1 ? selectedDesigns[0] : undefined;
    if (!activeTool || !design || readOnly || imageToolSubmitting) return;
    if (!validateToolParams(activeTool, toolParams).ok) {
      notify(t(locale, '参数无效', 'Invalid parameters'));
      return;
    }
    if (!onSubmitImageTask) {
      onConnections();
      return;
    }
    const beforeScene = createScene({
      id: `${project.id}-${design.id}-image-tool`,
      width: design.width,
      height: design.height,
      layers: [{ id: design.id, type: 'image', assetId: design.assetId, x: 0, y: 0, width: design.width, height: design.height, rotation: 0, opacity: 1, visible: true, locked: false }],
    });
    setImageToolSubmitting(true);
    try {
      const task = await onSubmitImageTask({ tool: activeTool, prompt: imageToolCopy[activeTool].prompt, params: toolParams, baseRevisionId: null, targetLayerId: design.id, ...(region ? { region } : {}), beforeScene });
      if (task) setTasks((current) => [...current.filter((candidate) => candidate.id !== task.id), task]);
      setActiveTool(null);
      setToolRegion(undefined);
      void refresh();
    } finally {
      setImageToolSubmitting(false);
    }
  };
  const layoutForSelection = (nextSelectedDesignIds: string[]): ProjectCanvasLayout => ({
    viewport: layout?.viewport ?? { zoom: 0.65, offsetX: 40, offsetY: 40 },
    nodes: layout?.nodes ?? layoutProjectDesigns(designs.map((design) => ({
      ...design,
      rowKey: designRowKeys[design.id] ?? design.sourceTaskId,
      anchorId: designAnchors[design.id],
    })), { centerRows: true }),
    selectedDesignIds: nextSelectedDesignIds,
  });
  const selectDesigns = (nextSelectedDesignIds: string[]): void => {
    setSelectedDesignIds(nextSelectedDesignIds);
    queueLayoutSave(layoutForSelection(nextSelectedDesignIds));
  };
  const selectAnalysis = (taskId: string): void => {
    setSelectedAnalysisTaskId(taskId);
    selectDesigns(designs.filter((design) => design.sourceConversationTaskId === taskId).map((design) => design.id));
    setAnalysisCollapsed(false);
  };
  const saveLayout = (next: Pick<ProjectCanvasLayout, 'viewport' | 'nodes'>): void => {
    queueLayoutSave({ ...next, selectedDesignIds });
  };
  const importImages = useCallback(async (files: readonly File[]): Promise<void> => {
    if (readOnly || !libraryId || !getDesktopApi().importAssets || !getDesktopApi().addProjectDesigns) return;
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (!images.length) return;
    try {
      const api = getDesktopApi();
      if (!api.importAssets || !api.addProjectDesigns) return;
      const prepared = await Promise.all(images.map(async (file) => {
        const image = await readImageFile(file);
        let width = 1080;
        let height = 1440;
        if (typeof createImageBitmap === 'function') {
          const bitmap = await createImageBitmap(file);
          width = bitmap.width;
          height = bitmap.height;
          bitmap.close();
        }
        return { image, width, height };
      }));
      const imported = await api.importAssets({
        libraryId,
        projectId: project.id,
        items: prepared.map(({ image }) => ({ name: image.name, mimeType: image.mimeType, data: image.bytes, metadata: { purpose: 'project-design', origin: 'canvas-import' } })),
      });
      const successful = imported?.filter((result): result is Extract<typeof result, { status: 'success' }> => result.status === 'success') ?? [];
      if (successful.length !== prepared.length) throw new Error('IMAGE_IMPORT_FAILED');
      const now = new Date().toISOString();
      const next = await api.addProjectDesigns({
        libraryId,
        projectId: project.id,
        designs: successful.map((result, index) => ({
          id: `design-${crypto.randomUUID()}`,
          projectId: project.id,
          assetId: result.asset.id,
          sourceTaskId: `canvas-import-${crypto.randomUUID()}`,
          width: prepared[index]!.width,
          height: prepared[index]!.height,
          title: prepared[index]!.image.name,
          createdAt: now,
        })),
      });
      setDesigns(next ?? []);
      onDesignsChangeRef.current?.(next ?? []);
    } catch {
      notify(t(locale, '图片导入失败。', 'Image import failed.'));
    }
  }, [libraryId, locale, notify, project.id, readOnly]);
  useEffect(() => {
    const pasteImages = (event: ClipboardEvent): void => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"], [role="dialog"]')) return;
      const images = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
      if (readOnly || images.length === 0) return;
      event.preventDefault();
      void importImages(images);
    };
    window.addEventListener('paste', pasteImages);
    return () => window.removeEventListener('paste', pasteImages);
  }, [importImages, readOnly]);
  const exportSelected = async (): Promise<void> => {
    if (selectedDesigns.length === 0 || !libraryId) return;
    let exported = 0;
    for (const design of selectedDesigns) {
      const result = await getDesktopApi().exportProjectDesign?.({
        libraryId,
        projectId: project.id,
        designId: design.id,
        format: 'png',
        scene: { version: 1, id: design.id, width: design.width, height: design.height, layers: [{ id: design.id, type: 'image', assetId: design.assetId, x: 0, y: 0, width: design.width, height: design.height, rotation: 0, opacity: 1, visible: true, locked: false }] },
      });
      if (result) exported += 1;
    }
    if (exported > 0) notify(t(locale, '设计稿已导出。', 'Design exported.'));
  };

  const addDesignToConversation = async (designId: string): Promise<void> => {
    const design = designs.find((candidate) => candidate.id === designId);
    if (!design || !libraryId || attachments.some((attachment) => attachment.assetId === design.assetId)) return;
    const bytes = await getDesktopApi().readAsset?.({ libraryId, projectId: project.id, assetId: design.assetId });
    if (!bytes) return;
    setAttachments((current) => current.some((attachment) => attachment.assetId === design.assetId)
      ? current
      : [...current, { assetId: design.assetId, name: design.title || `${design.id}.png`, mimeType: 'image/png', bytes, previewUrl: bytesToDataUrl('image/png', bytes) }]);
    setReferencedAssetIds((current) => current.includes(design.assetId) ? current : [...current, design.assetId]);
  };
  const copyAnalysisRequest = ({ message: copiedMessage, attachments: copiedAttachments }: AnalysisPanelRequest): void => {
    const normalized = copiedMessage.trim();
    if (normalized) {
      setMessage((current) => {
        const existing = current.trimEnd();
        if (!existing) return normalized;
        if (existing.endsWith(normalized)) return current;
        return `${existing}\n\n${normalized}`;
      });
    }
    setAttachments((current) => {
      const identities = new Set(current.map(attachmentIdentity));
      return [...current, ...copiedAttachments.filter((attachment) => {
        const identity = attachmentIdentity(attachment);
        if (identities.has(identity)) return false;
        identities.add(identity);
        return true;
      })];
    });
    setReferencedAssetIds((current) => [...new Set([...current, ...copiedAttachments.flatMap((attachment) => attachment.assetId ? [attachment.assetId] : [])])]);
  };
  return (
    <section className="project-canvas-surface" data-testid="project-canvas" data-analysis-dock-view={analysisDockView} aria-label={t(locale, '设计画布', 'Design canvas')}>
      <div className={`project-canvas-toolbar project-canvas-toolbar--top${menuOpen ? ' project-canvas-toolbar--menu-open' : ''}`}>
        <div className="project-canvas-toolbar__group">
          <div className="project-canvas-menu">
            <IconButton name="menu" label={t(locale, '项目操作', 'Project actions')} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} />
            {menuOpen && <div className="project-canvas-menu__popover" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onBack(); }}><Icon name="arrow-left" size={15} />{t(locale, '返回首页', 'Back to home')}</button>
              {onRename && <button type="button" role="menuitem" disabled={readOnly} onClick={() => { setMenuOpen(false); onRename(); }}><Icon name="pencil" size={15} />{t(locale, '重命名项目', 'Rename project')}</button>}
              {onDuplicate && <button type="button" role="menuitem" disabled={readOnly} onClick={() => { setMenuOpen(false); onDuplicate(); }}><Icon name="copy" size={15} />{t(locale, '复制项目', 'Duplicate project')}</button>}
              {onArchive && <button type="button" role="menuitem" disabled={readOnly} onClick={() => { setMenuOpen(false); onArchive(); }}><Icon name="folder" size={15} />{t(locale, '归档项目', 'Archive project')}</button>}
            </div>}
          </div>
          <span className="project-canvas-toolbar__title">{project.name}</span>
        </div>
      </div>
      <aside className="project-canvas-image-tools" aria-label={t(locale, '图片工具', 'Image tools')}>
        <div className="project-canvas-toolbar__actions">
          <IconButton name="download" tooltipPlacement="right" label={t(locale, '导出所选设计稿', 'Export selected design')} disabled={selectedDesigns.length === 0} onClick={() => { void exportSelected(); }} />
        </div>
        <Tooltip
          content={selectedDesigns.length === 1 ? t(locale, `当前图片：${selectedDesigns[0]!.title}`, `Current image: ${selectedDesigns[0]!.title}`) : t(locale, '选择一张图片后使用工具', 'Select one image to use a tool')}
          asChild
        >
          <div role="toolbar" aria-label={t(locale, '图片工具', 'Image tools')}>
            {imageTools.map((tool) => {
              const copy = imageToolCopy[tool];
              return <IconButton key={tool} name={copy.icon} tooltipPlacement="right" label={t(locale, copy.zh, copy.en)} aria-pressed={activeTool === tool} disabled={readOnly || selectedDesigns.length !== 1 || imageToolSubmitting} onClick={() => configureImageTool(tool)} />;
            })}
          </div>
        </Tooltip>
      </aside>
      <ProjectCanvasStage
        libraryId={libraryId}
        projectId={project.id}
        designs={designs}
        viewport={layout?.viewport}
        initialNodes={layout?.nodes}
        selectedDesignIds={selectedDesignIds}
        designRowKeys={designRowKeys}
        designAnchors={designAnchors}
        pendingDesigns={pendingDesigns}
        readOnly={readOnly}
        onSelect={(designId) => selectDesigns(designId ? [designId] : [])}
        onAddToConversation={(designId) => { void addDesignToConversation(designId); }}
        onCanvasBackground={() => {
          if (analysisRunning) return;
          setAnalysisHistoryOpen(false);
          setAnalysisCollapsed(true);
        }}
        onLayoutChange={saveLayout}
        onImportImages={importImages}
      />
      {analysisOpen && analysisTask && !analysisRunning && !analysisCollapsed && <div className="project-canvas-analysis-panel project-canvas-analysis-panel--expanded">
        <AnalysisPanel locale={locale} message={analysisTask.requestText ?? ''} attachments={analysisAttachments} task={analysisTask} canGenerate={Boolean(canGenerate)} onGenerate={(count) => { void generate(count); }} onCopyRequest={copyAnalysisRequest} />
      </div>}
      {analysisOpen && (analysisRunning || analysisHistory.length > 0) && !analysisHistoryOpen && <div className={`project-canvas-analysis-presence${analysisRunning ? ' project-canvas-analysis-presence--thinking' : ' project-canvas-analysis-presence--idle'}`} data-testid="project-canvas-analysis-presence" data-mode={analysisPresenceMode} aria-live="polite">
        <button
          type="button"
          className="project-canvas-analysis-history__presence"
          ref={analysisPresenceRef}
          aria-label={analysisRunning
            ? t(locale, '正在分析', 'Analyzing')
            : t(locale, `打开分析历史，${analysisHistory.length} 条记录`, `Open analysis history, ${analysisHistory.length} records`)}
          disabled={analysisRunning}
          onClick={() => setAnalysisHistoryOpen(true)}
        >
          <NeuralPresence mode={analysisPresenceMode} compact historyCount={analysisHistory.length} />
        </button>
      </div>}
      {analysisOpen && analysisHistory.length > 0 && !analysisRunning && analysisHistoryOpen && <section className="project-canvas-analysis-history is-open" aria-label={t(locale, '分析历史列表', 'Analysis history')}>
        <div className="project-canvas-analysis-history__list project-canvas-analysis-history__list-enter">{analysisHistory.map((task) => {
          const status = getAnalysisStatus(task, locale);
          return <button type="button" className={`project-canvas-analysis-history__item${task.id === analysisTask?.id ? ' is-selected' : ''}`} key={task.id} onClick={() => selectAnalysis(task.id)}><span className={`project-canvas-analysis-history__status is-${status.kind}`} data-testid={`analysis-status-${status.kind}`}><Icon name={status.icon} size={13} /></span><span className="project-canvas-analysis-history__copy"><strong>{task.requestText || t(locale, '未命名分析', 'Untitled analysis')}</strong><span>{status.label}</span></span></button>;
        })}</div>
        <button type="button" className="project-canvas-analysis-history__trigger" aria-expanded={analysisHistoryOpen} onClick={() => setAnalysisHistoryOpen(false)}>
          <span>{t(locale, '分析历史', 'Analysis history')}</span><span className="project-canvas-analysis-history__count">{analysisHistory.length}</span><Icon name="chevron-down" size={14} />
        </button>
      </section>}
      <div className="project-canvas-toolbar project-canvas-toolbar--bottom">
        <ConversationDock
          variant="compact"
          locale={locale}
          value={message}
          attachments={attachments}
          readOnly={readOnly}
          busy={conversationSubmitting || Boolean(analysisTask?.state === 'queued' || analysisTask?.state === 'running')}
          conversationConnected={conversationConnected}
          designer={designer}
          designerOptions={designerOptions}
          onDesignerChange={onDesignerChange}
          generationRatio={project.generationRatio ?? 'original'}
          onGenerationRatioChange={onGenerationRatioChange}
          textareaLabel={t(locale, '设计需求', 'Design request')}
          placeholder={t(locale, '描述你想生成的设计…', 'Describe the design you want…')}
          submitLabel={t(locale, '发送', 'Send')}
          onValueChange={setMessage}
          onAttachmentsChange={(next) => {
            setAttachments(next);
            setReferencedAssetIds(next.flatMap((attachment) => attachment.assetId ? [attachment.assetId] : []));
          }}
          referencedAssetCount={referencedAssetIds.length}
          onSubmit={() => { void submit(); }}
          notify={notify}
        />
      </div>
      {activeTool && selectedDesigns.length === 1 && <Modal title={t(locale, imageToolCopy[activeTool].zh, imageToolCopy[activeTool].en)} locale={locale} onClose={() => setActiveTool(null)} footer={<ToolInspectorActions tool={activeTool} locale={locale} readOnly={readOnly || imageToolSubmitting} region={toolRegion} onApplyRegion={setToolRegion} onCancelRegion={() => setActiveTool(null)} onClearRegion={() => setToolRegion(undefined)} onRun={(region) => { void runImageTool(region); }} />}>
        <ToolInspector
          tool={activeTool}
          tools={[activeTool]}
          params={toolParams}
          locale={locale}
          readOnly={readOnly || imageToolSubmitting}
          hideActions
          image={{ width: selectedDesigns[0]!.width, height: selectedDesigns[0]!.height }}
          region={toolRegion}
          onToolChange={configureImageTool}
          onParamsChange={setToolParams}
          onRegionChange={setToolRegion}
          onApplyRegion={(region) => setToolRegion(region)}
          onCancelRegion={() => setActiveTool(null)}
          onClearRegion={() => setToolRegion(undefined)}
          onRun={(region) => { void runImageTool(region); }}
        />
      </Modal>}
    </section>
  );
};
