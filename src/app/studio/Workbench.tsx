import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import type { Locale } from '../i18n';
import type { PendingHomeConversation, Project } from './types';
import type { PersonaProfile } from './personas';
import { Drawer } from './Drawer';
import { ConversationDock, type ConversationDockAttachment } from './ConversationDock';
import type { ProjectGenerationRatio } from '../../features/projects/size';
import { CanvasWorkspace, type CanvasAssetAction } from '../../features/canvas/CanvasWorkspace';
import { AnalysisPanel } from './AnalysisPanel';
import { CandidateBoard } from './CandidateBoard';
import type { Region } from '../../features/canvas/selection';
import { createScene, isLayerInteractive, replaceSceneLayer, type DesignScene, type TextLayer } from '../../features/canvas/scene';
import { validateDesignSceneCandidate, type DesignSceneCandidate } from '../../features/composition/design-scene-candidate';
import { getDesktopApi } from '../../platform/runtime';
import { defaultToolParams, validateToolParams, type ImageTool, type ToolParams } from '../../features/image-tools/target';
import { ToolInspector } from '../../features/image-tools/ToolInspector';
import type { ConversationImageAttachment } from '../../features/agent/task-service';
import type { RevisionRecord, RevisionTimelineEvent } from '../../features/revisions/model';
import type { DesignGenerationSlotId, TaskRecord } from '../../features/tasks/state';
import { applyToolResult } from '../../features/image-tools/result-application';
import type { RevisionStore } from '../../features/revisions/model';
import { CompareRevisions } from '../../features/revisions/CompareRevisions';
import {
  createCandidateScene,
  findCandidateById,
  findToolCandidate,
  getCompletedCandidates,
  getUnresolvedEntryCandidate,
  resolveCandidateScene,
  taskCandidates,
} from './candidate-controller';
import { validateToolSubmission } from './tool-submit-controller';
import { mergePolledTasks, startTaskPolling } from './task-polling';
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

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
  }
  return btoa(binary);
};

const toPreviewUrl = (attachment: ConversationImageAttachment): string =>
  `data:${attachment.mimeType || 'image/png'};base64,${bytesToBase64(attachment.bytes)}`;

const toolPrompt: Record<ImageTool, string> = {
  'remove-background': 'Remove the background and preserve the subject with clean edges',
  'replace-background': 'Replace the background while preserving the original subject',
  'remove-object': 'Remove the selected object and reconstruct the surrounding detail',
  inpaint: 'Inpaint the selected region according to the requested direction',
  expand: 'Expand the canvas edges while preserving the primary composition',
  'smart-crop': 'Smart crop while preserving the primary subject',
  upscale: 'Upscale the image while preserving important details',
  resize: 'Resize the image',
  'remove-watermark': 'Remove a watermark only from an explicitly selected region',
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
    'remove-watermark': ['移除水印', 'Remove watermark'],
  };
  const [zh, en] = labels[tool];
  return t(locale, zh, en);
};

export type WorkbenchProps = {
  locale: Locale;
  project: Project;
  libraryId?: string;
  documentId?: string;
  scene?: DesignScene;
  initialCandidate?: DesignSceneCandidate;
  onEntryCandidateResolved?: () => void;
  onBack: () => void;
  onConnections: () => void;
  designerOptions?: PersonaProfile[];
  onDesignerChange?: (designerId: string) => void;
  onGenerationRatioChange?: (ratio: ProjectGenerationRatio) => void;
  onTasks?: () => void;
  onSubmitConversation?: (message: string, attachments: ConversationImageAttachment[], context?: { analysisThreadId?: string; conversationParentTaskId?: string; referencedAssetIds?: string[] }) => void | Promise<void | TaskRecord | null> | TaskRecord | null;
  onSubmitDesignGeneration?: (conversationTaskId: string, baseRevisionId: string | null, generationRatio: ProjectGenerationRatio, count: 1 | 3) => void | Promise<void | TaskRecord | null> | TaskRecord | null;
  onSubmitImageTask?: (input: { tool: ImageTool; prompt: string; params: ToolParams; baseRevisionId: string | null; targetLayerId?: string; region?: Region }) => void | Promise<void>;
  onSubmitImageGeneration?: (prompt: string, baseRevisionId: string | null) => void | Promise<void>;
  operatorName?: string;
  modelConnected?: boolean;
  readOnly?: boolean;
  notify: (message: string) => void;
  assetAction?: CanvasAssetAction;
  onAssetActionHandled?: (actionId: string) => void;
  initialConversation?: PendingHomeConversation;
  onInitialConversationConsumed?: (id: string) => void;
};

const createInitialScene = (project: Project, documentId?: string): DesignScene => {
  const document = project.documentEntries?.find((entry) => entry.id === documentId) ?? project.documentEntries?.[0];
  if (project.libraryId && !document) {
    return createScene({ id: `${project.id}-scene`, width: 1, height: 1, layers: [] });
  }
  const width = document?.width ?? 1080;
  const height = document?.height ?? 1440;
  if (project.libraryId) {
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
  libraryId,
  documentId,
  scene: providedScene,
  initialCandidate,
  onEntryCandidateResolved,
  onBack,
  onConnections,
  designerOptions,
  onDesignerChange,
  onGenerationRatioChange,
  onTasks,
  onSubmitConversation,
  onSubmitDesignGeneration,
  onSubmitImageTask,
  onSubmitImageGeneration,
  modelConnected = false,
  readOnly = false,
  notify,
  assetAction,
  onAssetActionHandled,
  initialConversation,
  onInitialConversationConsumed,
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
  const [panelOpen, setPanelOpen] = useState(false);
  const [layersExpanded, setLayersExpanded] = useState(false);
  const [zoom, setZoom] = useState(68);
  const [gridVisible] = useState(true);
  const [title, setTitle] = useState(
    locale === 'zh-CN' ? project.name : project.enName,
  );
  const [opacity, setOpacity] = useState(100);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [conversationAttachments, setConversationAttachments] = useState<ConversationDockAttachment[]>([]);
  const [toolRegion, setToolRegion] = useState<Region | undefined>();
  const [activeTool, setActiveTool] = useState<ImageTool | null>(null);
  const [toolParams, setToolParams] = useState<ToolParams>({});
  const [canvasInspectorRequestId, setCanvasInspectorRequestId] = useState(0);
  const [canvasSelectionRequest, setCanvasSelectionRequest] = useState<{ id: number; type: LayerId }>();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const consumedInitialConversationIds = useRef(new Set<string>());
  const canvasStageRef = useRef<HTMLDivElement>(null);
  const [canvasOverlayHost, setCanvasOverlayHost] = useState<HTMLElement | null>(null);
  const documentMeta = project.documentEntries?.find((entry) => entry.id === documentId) ?? project.documentEntries?.[0];
  const [scene, setScene] = useState<DesignScene>(() => providedScene ?? createInitialScene(project, documentId));
  const [entryCandidate, setEntryCandidate] = useState<DesignSceneCandidate | null>(() => {
    const valid = initialCandidate ? validateDesignSceneCandidate(initialCandidate) : null;
    return valid?.ok ? valid.candidate : null;
  });
  const [candidateScene, setCandidateScene] = useState<DesignScene | null>(() => entryCandidate?.scene ?? null);
  const [revisionState, setRevisionState] = useState<RevisionState>({ revisions: [], timeline: [], finalRevisionId: null });
  const [revisionBusy, setRevisionBusy] = useState(false);
  const [revisionBaseId, setRevisionBaseId] = useState<string | null>(null);
  const [compareRevisionId, setCompareRevisionId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [pendingConversationTaskId, setPendingConversationTaskId] = useState<string | null>(null);
  const [conversationSubmitting, setConversationSubmitting] = useState(false);
  const [analysisThreadId, setAnalysisThreadId] = useState<string | undefined>();
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [analysisAttachments, setAnalysisAttachments] = useState<Array<ConversationImageAttachment & { previewUrl: string }>>([]);
  const [referencedAssetIds, setReferencedAssetIds] = useState<string[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [toolCandidateTaskId, setToolCandidateTaskId] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [candidatePreviewId, setCandidatePreviewId] = useState<string | null>(null);
  const [viewportFocusRequest, setViewportFocusRequest] = useState({ id: 0, candidateId: null as string | null });
  const [canvasSelection, setCanvasSelection] = useState<{ layerId: string; type: 'text' | 'shape' | 'image' } | null>(null);
  const [toolCompareMode, setToolCompareMode] = useState<'result' | 'before'>('result');

  useEffect(() => {
    if (!libraryId || !documentId) return undefined;
    let cancelled = false;
    const request = getDesktopApi().loadDocumentRevisions?.(libraryId, project.id, documentId);
    void request?.then((loaded) => { if (!cancelled && loaded) setRevisionState(loaded); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [documentId, project.id, libraryId]);

  useEffect(() => {
    if (!libraryId) return undefined;
    let cancelled = false;
    const refresh = (): void => {
      const request = getDesktopApi().listTasks?.(libraryId);
      void request?.then((loaded) => {
        if (!cancelled && loaded) {
          const persisted = loaded.filter((task) => task.documentId === documentId);
          setTasks((current) => mergePolledTasks(current, persisted));
        }
      }).catch(() => undefined);
    };
    const stop = startTaskPolling(refresh, pendingConversationTaskId ? 250 : 2_000, window);
    return () => { cancelled = true; stop(); };
  }, [documentId, pendingConversationTaskId, libraryId]);

  useEffect(() => {
    if (!tasks.length) return;
    const activeBaseRevisionId = revisionState.revisions[revisionState.revisions.length - 1]?.revisionId ?? revisionState.finalRevisionId ?? null;
    setAnalysisThreadId((current) => current ?? tasks.find((task) => task.analysisThreadId)?.analysisThreadId);
    const completed = getCompletedCandidates(tasks, activeBaseRevisionId);
    setSelectedCandidateId((current) => current && completed.some(({ candidate }) => candidate.id === current) ? current : completed[0]?.candidate.id ?? null);
    if (!completed.length) {
      const toolTask = tasks.find((task) => (task.capability === 'image-editing' || task.capability === 'local-transform') && task.state === 'completed' && (task.result?.toolCandidate || task.result?.candidate));
      setToolCandidateTaskId(toolTask?.id ?? null);
    } else {
      setToolCandidateTaskId(null);
    }
  }, [revisionState.finalRevisionId, revisionState.revisions, tasks]);

  useEffect(() => {
    if (entryCandidate) {
      setCandidateScene(entryCandidate.scene);
      return;
    }
    const unresolved = getUnresolvedEntryCandidate(tasks, project.id, documentId);
    if (!unresolved) return;
    setEntryCandidate(unresolved.candidate);
    setCandidateScene(unresolved.candidate.scene);
    setSelectedCandidateId(null);
    setToolCandidateTaskId(null);
  }, [documentId, entryCandidate, project.id, tasks]);

  const currentRevisionId = revisionState.revisions[revisionState.revisions.length - 1]?.revisionId ?? revisionState.finalRevisionId ?? null;
  const pendingConversationTask = pendingConversationTaskId ? tasks.find((task) => task.id === pendingConversationTaskId) : undefined;
  const conversationReadyForGeneration = pendingConversationTask?.state === 'completed'
    && pendingConversationTask.visualContextPlan?.clarificationRequired !== true;
  const generating = tasks.some((task) => task.capability === 'design-generation' && task.analysisThreadId === analysisThreadId && (task.state === 'queued' || task.state === 'running'));
  const hasPendingAnalysis = Boolean(pendingConversationTask && (pendingConversationTask.state === 'queued' || pendingConversationTask.state === 'running'));
  const selectCandidate = (candidateId: string, assetId: string): void => {
    setSelectedCandidateId(candidateId);
    setReferencedAssetIds((current) => current.includes(assetId) ? current : [...current, assetId]);
    notify(t(locale, '候选已加入下一轮对话', 'Candidate added to the next conversation'));
  };

  useEffect(() => {
    if (entryCandidate) {
      setCandidateScene(entryCandidate.scene);
      return;
    }
    if (!selectedCandidateId && !toolCandidateTaskId) {
      setCandidateScene(null);
      return;
    }
    setCandidateScene(resolveCandidateScene({
      entryCandidate,
      selectedCandidateId,
      toolCandidateTaskId,
      tasks,
      baseScene: scene,
    }));
  }, [entryCandidate, selectedCandidateId, toolCandidateTaskId, tasks, scene.width, scene.height]);

  const resolveEntryCandidate = async (resolution: 'confirmed' | 'discarded'): Promise<boolean> => {
    if (!entryCandidate) return true;
    const resolveCandidate = getDesktopApi().resolveCompositionCandidate;
    if (libraryId && resolveCandidate) {
      try {
        const resolved = await resolveCandidate({ libraryId, taskId: entryCandidate.sourceTaskId, resolution });
        if (!resolved || resolved.candidateResolution !== resolution) return false;
        setTasks((current) => current.map((task) => task.id === resolved.id ? resolved : task));
      } catch {
        return false;
      }
    }
    onEntryCandidateResolved?.();
    return true;
  };

  const discardCandidate = async (): Promise<void> => {
    if (entryCandidate && !await resolveEntryCandidate('discarded')) {
      notify(t(locale, '候选状态保存失败，请重试。', 'Could not save candidate status. Try again.'));
      return;
    }
    setEntryCandidate(null);
    setCandidateScene(null);
    setSelectedCandidateId(null);
    setToolCandidateTaskId(null);
    setRevisionBaseId(null);
  };

  const persistScene = (nextScene: DesignScene): void => {
    if (readOnly) return;
    setScene(nextScene);
    if (libraryId && documentId) {
      const request = getDesktopApi().saveDocumentScene?.({ libraryId, projectId: project.id, documentId, scene: nextScene });
      if (request) void request.catch(() => undefined);
    }
  };
  const syncTextState = useCallback((nextScene: DesignScene): void => {
    const textLayer = nextScene.layers.find((layer): layer is TextLayer => layer.type === 'text');
    if (!textLayer) return;
    setTitle(textLayer.text);
    setPosition({ x: textLayer.x, y: textLayer.y });
    setOpacity(Math.round(textLayer.opacity * 100));
  }, []);
  const handleSceneChange = useCallback((nextScene: DesignScene): void => {
    syncTextState(nextScene);
    setScene(nextScene);
  }, [syncTextState]);
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
  const saveRevision = async (override?: { scene?: DesignScene; baseRevisionId?: string | null; operationId?: string }): Promise<boolean> => {
    if (readOnly || !libraryId || !documentId || revisionBusy) return false;
    setRevisionBusy(true);
    try {
      const revisionScene = override?.scene ?? scene;
      const result = await getDesktopApi().commitDocumentRevision?.({
        libraryId,
        projectId: project.id,
        documentId,
        baseRevisionId: override?.baseRevisionId ?? revisionBaseId ?? revisionState.revisions[revisionState.revisions.length - 1]?.revisionId ?? null,
        operationId: override?.operationId ?? `workbench-${crypto.randomUUID()}`,
        sceneAssetId: revisionScene.id,
        assetIds: revisionScene.layers.filter((layer): layer is Extract<typeof layer, { type: 'image' }> => layer.type === 'image').map((layer) => layer.assetId),
        contributions: revisionContributions(),
        scene: revisionScene,
      });
      if (result) {
        if (override?.scene && entryCandidate && !await resolveEntryCandidate('confirmed')) {
          notify(t(locale, '版本已创建，但候选状态保存失败，请重试。', 'The revision was created, but candidate status could not be saved. Try again.'));
          return false;
        }
        const loaded = await getDesktopApi().loadDocumentRevisions?.(libraryId, project.id, documentId);
        if (loaded) setRevisionState(loaded);
        if (override?.scene) persistScene(override.scene);
        setRevisionBaseId(null);
        if (override?.scene) {
          setCandidateScene(null);
          setSelectedCandidateId(null);
          setEntryCandidate(null);
        }
        notify(t(locale, '版本已保存', 'Version saved'));
        return true;
      }
    } catch {
      notify(t(locale, '版本保存失败', 'Could not save version'));
    } finally { setRevisionBusy(false); }
    return false;
  };

  const confirmCandidate = async (): Promise<void> => {
    if (!candidateScene) return;
    if (entryCandidate) {
      await saveRevision({ scene: candidateScene, baseRevisionId: null, operationId: entryCandidate.sourceTaskId });
      return;
    }
    const entry = selectedCandidateId
      ? findCandidateById(tasks, selectedCandidateId)
      : toolCandidateTaskId
        ? findToolCandidate(tasks, toolCandidateTaskId)
        : undefined;
    if (!entry) return;
    if ('candidateScene' in entry.candidate && libraryId && documentId) {
      const candidate = entry.candidate;
      const revisionStore = {
        commitRevision: async (input: Parameters<RevisionStore['commitRevision']>[0]) => {
          const committed = await getDesktopApi().commitDocumentRevision?.({ libraryId, projectId: project.id, documentId, baseRevisionId: input.baseRevisionId, operationId: input.operationId, sceneAssetId: input.sceneAssetId, assetIds: input.assetIds, contributions: input.contributions, scene: input.scene });
          if (!committed) throw new Error('REVISION_COMMIT_FAILED');
          return committed;
        },
      } as RevisionStore;
      setRevisionBusy(true);
      try {
        const applied = await applyToolResult({ status: 'completed', projectId: project.id, documentId, baseRevisionId: candidate.baseRevisionId, operationId: entry.task.requestId, sceneAssetId: candidate.resultAssetId, assetIds: [candidate.resultAssetId], revisionStore, candidate });
        if (applied) {
          const loaded = await getDesktopApi().loadDocumentRevisions?.(libraryId, project.id, documentId);
          if (loaded) setRevisionState(loaded);
          persistScene(candidate.candidateScene);
          setCandidateScene(null); setToolCandidateTaskId(null); setRevisionBaseId(null);
          notify(t(locale, '版本已保存', 'Version saved'));
        }
      } catch { notify(t(locale, '版本保存失败', 'Could not save version')); }
      finally { setRevisionBusy(false); }
      return;
    }
    await saveRevision({
      scene: candidateScene,
      baseRevisionId: entry.candidate.baseRevisionId,
      operationId: entry.task.requestId,
    });
  };
  const exportSelectedCandidate = async (): Promise<void> => {
    if (!libraryId || !documentId || !selectedCandidateId || exportBusy) return;
    const entry = findCandidateById(tasks, selectedCandidateId);
    const selectedAssetId = entry?.candidate.sceneAssetId ?? entry?.candidate.assetIds[0];
    if (!entry || !selectedAssetId) {
      notify(t(locale, '所选候选不可导出', 'The selected candidate cannot be exported'));
      return;
    }
    const candidateScene = createScene({
      id: `candidate-export-${entry.candidate.id}`,
      width: scene.width,
      height: scene.height,
      layers: [{
        id: `candidate-export-image-${entry.candidate.id}`,
        type: 'image',
        role: 'content',
        assetId: selectedAssetId,
        x: 0,
        y: 0,
        width: scene.width,
        height: scene.height,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
      }],
    });
    setExportBusy(true);
    try {
      const result = await getDesktopApi().exportDocument?.({
        libraryId,
        projectId: project.id,
        documentId,
        format: 'png',
        scene: candidateScene,
      });
      if (result) notify(t(locale, `已导出到 ${result.path}`, `Exported to ${result.path}`));
    } catch {
      notify(t(locale, '候选导出失败，请重试。', 'Could not export the candidate. Try again.'));
    } finally {
      setExportBusy(false);
    }
  };
  const continueCandidate = (candidateId: string): void => {
    if (readOnly) return;
    const entry = findCandidateById(tasks, candidateId);
    const nextScene = entry ? createCandidateScene(scene, entry.candidate) : null;
    if (!entry || !nextScene) return;
    setRevisionBaseId(entry.candidate.baseRevisionId);
    persistScene(nextScene);
    setCandidateScene(null);
    setSelectedCandidateId(null);
    setToolCandidateTaskId(null);
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
  const detailedPanelOpen = panelOpen && (panel === 'history' || panel === 'tools');
  const hasWorkspaceDocument = Boolean(libraryId && documentId);
  const propertiesOpen = !hasWorkspaceDocument && panelOpen && panel === 'properties';
  const designerSnapshot = project.designerSnapshot as { id?: string; name?: { zh?: string; en?: string }; artworkUrl?: string; artworkAlt?: { zh?: string; en?: string } } | undefined;
  const conversationDesigner = designerSnapshot?.name?.[locale === 'zh-CN' ? 'zh' : 'en']
    ?? project.designers[0]
    ?? t(locale, '未设置设计师', 'No designer selected');
  const conversationDesignerProfile = {
    id: designerSnapshot?.id ?? project.activeDesignerVersionId ?? conversationDesigner,
    name: { zh: conversationDesigner, en: conversationDesigner },
    artworkUrl: designerSnapshot?.artworkUrl ?? '',
    artworkAlt: designerSnapshot?.artworkAlt ?? { zh: conversationDesigner, en: conversationDesigner },
  } as import('./personas').PersonaProfile;
  const canvasStyle = {
    '--workbench-rotation': `${rotation}deg`,
  } as CSSProperties;
  const draftDisplayWidth = Math.round(280 * zoom / 68);
  const toolCandidateTask = toolCandidateTaskId ? tasks.find((task) => task.id === toolCandidateTaskId) : undefined;
  const activeCandidateId = selectedCandidateId ?? (toolCandidateTask ? taskCandidates(toolCandidateTask)[0]?.id ?? null : null);
  const activeToolCandidate = toolCandidateTask?.result?.toolCandidate;
  const displayedCandidateScene = candidateScene && toolCompareMode === 'before' && activeToolCandidate
    ? activeToolCandidate.beforeScene
    : candidateScene;
  const hasSceneContent = scene.layers.some((layer) => layer.type !== 'image' || layer.assetId !== 'placeholder');
  const centerDraft = useCallback((element: HTMLElement): void => {
    const container = canvasStageRef.current;
    if (!container || typeof container.scrollTo !== 'function') return;
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const left = Math.max(0, container.scrollLeft + elementRect.left - containerRect.left + elementRect.width / 2 - containerRect.width / 2);
    const top = Math.max(0, container.scrollTop + elementRect.top - containerRect.top + elementRect.height / 2 - containerRect.height / 2);
    container.scrollTo({ left, top, behavior: 'smooth' });
  }, []);
  const focusPreferredDraft = useCallback((candidateId: string | null): void => {
    const stage = canvasStageRef.current;
    if (!stage) return;
    const selected = candidateId
      ? Array.from(stage.querySelectorAll<HTMLElement>('.workbench-candidate-card[data-candidate-id]')).find((element) => element.dataset.candidateId === candidateId)
      : undefined;
    const running = Array.from(stage.querySelectorAll<HTMLElement>('.workbench-candidate-card[data-task-id]')).at(-1);
    const current = stage.querySelector<HTMLElement>('[data-draft-role="current"]');
    const target = selected ?? running ?? current;
    if (target) centerDraft(target);
  }, [centerDraft]);

  useLayoutEffect(() => {
    if (viewportFocusRequest.id > 0) focusPreferredDraft(viewportFocusRequest.candidateId);
  }, [focusPreferredDraft, viewportFocusRequest]);

  useLayoutEffect(() => {
    if (!generating) focusPreferredDraft(selectedCandidateId);
  }, [focusPreferredDraft, generating, selectedCandidateId, zoom]);

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
    if (nextPanel === 'conversation') {
      const shouldOpen = panel !== 'conversation' || !panelOpen;
      setPanel('conversation');
      setPanelOpen(shouldOpen);
      if (shouldOpen) promptRef.current?.focus();
      return;
    }
    setPanel(nextPanel);
    if (nextPanel === 'properties' && hasWorkspaceDocument) {
      setPanelOpen(false);
      if (!scene.layers.some(isLayerInteractive)) {
        notify(t(locale, '当前没有可编辑图层', 'There are no editable layers in the current document'));
        return;
      }
      setCanvasInspectorRequestId((current) => current + 1);
      return;
    }
    setPanelOpen(true);
  };
  const selectWorkbenchLayer = (layerId: LayerId): void => {
    setSelectedLayer(layerId);
    if (hasWorkspaceDocument) {
      setCanvasSelectionRequest((current) => ({ id: (current?.id ?? 0) + 1, type: layerId }));
    }
    showPanel('properties');
  };
  const resetZoom = (): void => {
    setZoom(68);
    setViewportFocusRequest((current) => ({ id: current.id + 1, candidateId: selectedCandidateId }));
    notify(t(locale, '缩放已重置', 'Preview zoom reset'));
  };
  const clearConversationAttachments = (): void => {
    setConversationAttachments([]);
  };
  const submitConversationRequest = useCallback((
    message: string,
    attachments: ConversationImageAttachment[],
    context: { analysisThreadId?: string; conversationParentTaskId?: string; referencedAssetIds?: string[] } = {},
  ): Promise<TaskRecord | null | undefined> => {
    const previewAttachments = attachments.map((attachment) => ({
      ...attachment,
      previewUrl: toPreviewUrl(attachment),
    }));
    setAnalysisMessage(message);
    setAnalysisAttachments(previewAttachments);
    setAnalysisThreadId((current) => current ?? `analysis-${crypto.randomUUID()}`);
    setPanel('conversation');
    setPanelOpen(true);
    setPendingConversationTaskId(null);
    if (!onSubmitConversation) return Promise.resolve(undefined);

    setConversationSubmitting(true);
    let submitted: ReturnType<NonNullable<WorkbenchProps['onSubmitConversation']>>;
    try {
      submitted = Object.keys(context).length > 0
        ? onSubmitConversation(message, attachments, context)
        : onSubmitConversation(message, attachments);
    } catch (error) {
      setConversationSubmitting(false);
      return Promise.reject(error);
    }
    if (submitted === undefined) {
      setConversationSubmitting(false);
      setReferencedAssetIds([]);
      return Promise.resolve(undefined);
    }
    return Promise.resolve(submitted).then((task) => {
      if (task === null) return null;
      if (!task) return undefined;
      setPendingConversationTaskId(task.id);
      setAnalysisThreadId(task.analysisThreadId ?? `analysis-${task.id}`);
      setTasks((current) => [...current.filter((entry) => entry.id !== task.id), task]);
      setReferencedAssetIds([]);
      return task;
    }).finally(() => setConversationSubmitting(false));
  }, [onSubmitConversation]);

  useEffect(() => {
    if (!initialConversation || consumedInitialConversationIds.current.has(initialConversation.id)) return;
    consumedInitialConversationIds.current.add(initialConversation.id);
    onInitialConversationConsumed?.(initialConversation.id);
    void submitConversationRequest(initialConversation.message, initialConversation.attachments).then((task) => {
      if (task) return;
      setPrompt(initialConversation.message);
      setConversationAttachments(initialConversation.attachments.map((attachment) => ({
        ...attachment,
        previewUrl: toPreviewUrl(attachment),
      })));
    }).catch(() => {
      setPrompt(initialConversation.message);
      setConversationAttachments(initialConversation.attachments.map((attachment) => ({
        ...attachment,
        previewUrl: toPreviewUrl(attachment),
      })));
      notify(t(locale, '任务提交失败', 'Task submission failed'));
    });
  }, [initialConversation, locale, notify, onInitialConversationConsumed, submitConversationRequest]);

  const submitPromptRequest = (): void => {
    if (readOnly) return;
    if (!prompt.trim()) {
      notify(t(locale, '请输入修改说明', 'Enter an edit request'));
      return;
    }
    if (onSubmitConversation) {
      const message = prompt.trim();
      const attachments = conversationAttachments.map((attachment) => ({
        name: attachment.name,
        mimeType: attachment.mimeType,
        bytes: attachment.bytes,
      }));
      const context = {
        ...(analysisThreadId ? { analysisThreadId } : {}),
        ...(pendingConversationTaskId ? { conversationParentTaskId: pendingConversationTaskId } : {}),
        ...(referencedAssetIds.length ? { referencedAssetIds } : {}),
      };
      setPrompt('');
      clearConversationAttachments();
      void submitConversationRequest(message, attachments, context)
        .catch(() => notify(t(locale, '任务提交失败', 'Task submission failed')));
      return;
    }
    onConnections();
  };
  const submitGeneration = (count: 1 | 3 = 3): void => {
    if (readOnly) return;
    if (onSubmitDesignGeneration && pendingConversationTaskId) {
      if (!conversationReadyForGeneration) {
        notify(t(locale, '请等待对话理解完成。', 'Wait for conversation analysis to finish.'));
        return;
      }
      void Promise.resolve(onSubmitDesignGeneration(pendingConversationTaskId, currentRevisionId, project.generationRatio ?? '3:4', count)).then((task) => {
        if (!task) return;
        const threadTask = task.analysisThreadId || !analysisThreadId
          ? task
          : { ...task, analysisThreadId };
        setTasks((current) => [...current.filter((entry) => entry.id !== task.id), threadTask]);
      }).catch(() => notify(t(locale, '任务提交失败', 'Task submission failed')));
      return;
    }
    if (onSubmitImageGeneration && prompt.trim()) {
      void Promise.resolve(onSubmitImageGeneration(prompt.trim(), currentRevisionId)).then(() => setPrompt('')).catch(() => notify(t(locale, '任务提交失败', 'Task submission failed')));
      return;
    }
    notify(t(locale, '请先发送一轮对话分析。', 'Send a conversation analysis first.'));
  };
  const retryPendingConversation = (): void => {
    if (!libraryId || !pendingConversationTaskId) return;
    void getDesktopApi().retryTask?.(libraryId, pendingConversationTaskId).then((task) => {
      if (!task) return;
      setTasks((current) => [...current.filter((entry) => entry.id !== task.id), task]);
      setPendingConversationTaskId(task.id);
      setAnalysisThreadId(task.analysisThreadId ?? analysisThreadId);
    }).catch(() => notify(t(locale, '重试失败', 'Retry failed')));
  };
  const retryGenerationSlot = async (taskId: string, slotId: DesignGenerationSlotId): Promise<void> => {
    if (!libraryId) return;
    const retried = await getDesktopApi().retryDesignGenerationSlot?.({ libraryId, taskId, slotId });
    if (!retried) return;
    setTasks((current) => current.map((task) => task.id === retried.id ? retried : task));
  };
  const submitImageTask = (tool: ImageTool, taskPrompt: string, params: ToolParams, region?: Region): void => {
    if (readOnly) return;
    if (!onSubmitImageTask) {
      onConnections();
      return;
    }
    const validation = validateToolSubmission({
      tool,
      params,
      scene,
      selection: canvasSelection,
      libraryId,
      documentId,
      readOnly,
      ...(region ? { region } : {}),
    });
    if (!validation.ok) {
      notify(validation.code === 'IMAGE_LAYER_REQUIRED' || validation.code === 'IMAGE_ASSET_REQUIRED'
        ? t(locale, '请选择一个图片图层', 'Select an image layer first')
        : validation.code === 'DOCUMENT_REQUIRED'
          ? t(locale, '请选择一个文档', 'Select a document first')
          : t(locale, '参数无效', 'Invalid parameters'));
      return;
    }
    void Promise.resolve(onSubmitImageTask({ tool, prompt: taskPrompt, params, baseRevisionId: currentRevisionId, ...(validation.targetLayerId ? { targetLayerId: validation.targetLayerId } : {}), ...(validation.region ? { region: validation.region } : {}) })).catch(() => notify(t(locale, '任务提交失败', 'Task submission failed')));
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

  const propertiesContent = (
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
                <strong>{t(locale, '解锁图层后可继续编辑', 'Unlock the layer to continue editing')}</strong>
              </div>
            </div>
          )}
          <Field
            label={t(locale, '标题文字', 'Title text')}
            hint={t(locale, '仅影响当前示例预览', 'Only affects this example preview')}
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
                <input type="number" min="-999" max="999" value={position.x} disabled={readOnly || locked.text} onChange={(event) => updatePosition('x', event.target.value)} />
              </Field>
              <Field label={t(locale, 'Y 坐标', 'Y position')}>
                <input type="number" min="-999" max="999" value={position.y} disabled={readOnly || locked.text} onChange={(event) => updatePosition('y', event.target.value)} />
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
            <strong>{t(locale, '此示例仅开放文字属性', 'Only text properties are editable in this example')}</strong>
            <p>{t(locale, '仍可在图层面板切换显示或锁定。', 'Visibility and locking remain available in the layers panel.')}</p>
          </div>
        </div>
      )}
    </div>
  );

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
          <Badge tone={libraryId ? 'success' : 'warning'}>
            {libraryId ? t(locale, '已保存', 'Saved') : t(locale, '预览未保存', 'Unsaved preview')}
          </Badge>
        </div>

        <div
          className="workbench-viewport-controls"
          role="toolbar"
          aria-label={t(locale, '预览视图', 'Preview view')}
        >
          <Button
            className="workbench-image-tools-trigger"
            variant={panelOpen && panel === 'tools' ? 'secondary' : 'ghost'}
            icon="wand-sparkles"
            aria-label={t(locale, '画布图像工具', 'Canvas image tools')}
            title={t(locale, '画布图像工具', 'Canvas image tools')}
            onClick={() => showPanel('tools')}
          >
            {t(locale, '画布图像工具', 'Canvas image tools')}
          </Button>
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
            onClick={() => undefined}
          />
        </div>

      </header>

      <div className="workbench-body workbench-body--canvas-first">
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

          {!hasWorkspaceDocument && <section
            className={`workbench-layers ${layersExpanded ? 'workbench-layers--expanded' : ''}`}
            aria-labelledby={layersTitleId}
            role="complementary"
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
          </section>}
        </aside>

        <section
          ref={setCanvasOverlayHost}
          className="workbench-canvas"
          aria-label={t(locale, '设计画布', 'Design canvas')}
          data-grid-visible={gridVisible}
          data-text-visible={visibility.text}
          data-shape-visible={visibility.shape}
          data-image-visible={visibility.image}
          style={canvasStyle}
        >
          <div className="workbench-ruler workbench-ruler--horizontal" aria-hidden="true">
            <span>0</span>
            <span>480</span>
            <span>960</span>
            <strong>{documentMeta?.width ?? scene.width}</strong>
            <span>1440</span>
            <span>1920</span>
          </div>
          <div className="workbench-ruler workbench-ruler--vertical" aria-hidden="true">
            <span>0</span>
            <span>600</span>
            <span>1200</span>
            <span>1800</span>
          </div>
          <div ref={canvasStageRef} className="workbench-canvas__stage">
            <div className="workbench-canvas-world">
              <div className="workbench-canvas-world__row">
                {libraryId && documentId ? (
                  <div
                    data-testid={candidateScene ? 'canvas-candidate-scene' : undefined}
                    data-draft-role={candidateScene ? 'candidate' : 'current'}
                    data-candidate-id={candidateScene ? activeCandidateId ?? undefined : undefined}
                    className={`workbench-design-card${hasSceneContent ? '' : ' workbench-design-card--empty'}`}
                    style={{ aspectRatio: `${scene.width} / ${scene.height}`, ...(hasSceneContent ? { width: draftDisplayWidth, flexBasis: draftDisplayWidth } : {}) }}
                  >
                    <CanvasWorkspace
                      locale={locale}
                      scene={displayedCandidateScene ?? scene}
                      onSceneChange={candidateScene && toolCompareMode === 'result' ? setCandidateScene : handleSceneChange}
                      onSelectionChange={(selection) => {
                        setCanvasSelection(selection);
                        if (selection) setSelectedLayer(selection.type);
                      }}
                      readOnly={readOnly || toolCompareMode === 'before' || entryCandidate?.editable === false}
                      libraryId={libraryId}
                      projectId={project.id}
                      documentId={documentId}
                      persistDocumentScene={!candidateScene}
                      embedded
                      layersOpen={layersExpanded}
                      onLayersClose={() => setLayersExpanded(false)}
                      inspectorRequestId={canvasInspectorRequestId}
                      selectionRequest={canvasSelectionRequest}
                      zoomPercent={68}
                      overlayHost={canvasOverlayHost}
                      assetAction={assetAction}
                      onAssetActionHandled={onAssetActionHandled}
                    />
                    {candidateScene && <div className="workbench-candidate-actions">
                      {entryCandidate && <span role="status">{entryCandidate.mode === 'raster-fallback' ? t(locale, '栅格候选 · 不可编辑', 'Raster candidate · non-editable') : t(locale, '本地候选 · 待确认', 'Local candidate · review before confirming')}</span>}
                      {activeToolCandidate && <div role="group" aria-label={t(locale, '结果比较', 'Result comparison')}><Button variant={toolCompareMode === 'before' ? 'secondary' : 'ghost'} icon="image" onClick={() => setToolCompareMode('before')}>{t(locale, '原图', 'Original')}</Button><Button variant={toolCompareMode === 'result' ? 'secondary' : 'ghost'} icon="sparkles" onClick={() => setToolCompareMode('result')}>{t(locale, '结果', 'Result')}</Button></div>}
                      <Button variant="secondary" icon="check" disabled={readOnly || revisionBusy} onClick={() => { void confirmCandidate(); }}>{t(locale, '确认候选', 'Confirm candidate')}</Button>
                      <Button variant="ghost" icon="x" disabled={revisionBusy} onClick={() => { void discardCandidate(); }}>{t(locale, '放弃候选', 'Discard candidate')}</Button>
                    </div>}
                  </div>
                ) : (
                  <div data-draft-role="current" className="workbench-design-card" style={{ width: draftDisplayWidth, flexBasis: draftDisplayWidth, aspectRatio: `${scene.width} / ${scene.height}` }}>
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
                  </div>
                )}
                <CandidateBoard
                  locale={locale}
                  tasks={tasks}
                  libraryId={libraryId}
                  projectId={project.id}
                  analysisThreadId={analysisThreadId}
                  width={scene.width}
                  height={scene.height}
                  displayWidth={draftDisplayWidth}
                  selectedCandidateId={selectedCandidateId}
                  onSelect={selectCandidate}
                  onRetrySlot={(taskId, slotId) => { void retryGenerationSlot(taskId, slotId); }}
                  onRequestFocus={centerDraft}
                />
              </div>
            </div>
          </div>
          {analysisThreadId && panel === 'conversation' && panelOpen && (
            <AnalysisPanel
              locale={locale}
              message={analysisMessage}
              attachments={analysisAttachments}
              task={pendingConversationTask}
              canGenerate={Boolean(conversationReadyForGeneration && !generating && !hasPendingAnalysis)}
              onGenerate={submitGeneration}
              onRetry={pendingConversationTask?.state === 'failed' ? retryPendingConversation : undefined}
            />
          )}
          <div className="workbench-canvas__meta" aria-hidden="true">
            <span>{documentMeta?.width ?? scene.width} × {documentMeta?.height ?? scene.height} px</span>
            <span>sRGB</span>
          </div>
          <div
            className="workbench-context-tools"
            role="toolbar"
            aria-label={t(locale, '上下文工具', 'Context tools')}
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
            <span className="workbench-context-tools__separator" aria-hidden="true" />
            <IconButton
              className="icon-button workbench-context-tools__export"
              name="download"
              label={t(locale, '导出所选候选', 'Export selected candidate')}
              disabled={exportBusy || !libraryId || !documentId || !selectedCandidateId}
              onClick={() => { void exportSelectedCandidate(); }}
            />
          </div>
          {propertiesOpen && (
            <aside className="workbench-properties-float" aria-label={panelCopy.properties.label}>
              <div className="workbench-panel-heading">
                <div>
                  <p>{t(locale, '快速检查', 'Quick inspect')}</p>
                  <h2>{panelCopy.properties.label}</h2>
                </div>
                <IconButton name="x" label={t(locale, '关闭属性', 'Close properties')} onClick={() => setPanelOpen(false)} />
              </div>
              {propertiesContent}
            </aside>
          )}
          <ConversationDock
            variant="compact"
            locale={locale}
            value={prompt}
            attachments={conversationAttachments}
            readOnly={readOnly}
            busy={conversationSubmitting || hasPendingAnalysis}
            conversationConnected={modelConnected}
            designer={designerSnapshot ? conversationDesignerProfile : null}
            designerOptions={designerOptions}
            onDesignerChange={onDesignerChange}
            generationRatio={project.generationRatio ?? '3:4'}
            onGenerationRatioChange={onGenerationRatioChange}
            textareaLabel={t(locale, '修改说明', 'Edit request')}
            placeholder={t(locale, '描述希望调整的内容…', 'Describe the change…')}
            submitLabel={t(locale, '发送', 'Send')}
            textareaRef={promptRef}
            referencedAssetCount={referencedAssetIds.length}
            showGenerate={!analysisThreadId}
            generateDisabled={readOnly || Boolean(onSubmitDesignGeneration && pendingConversationTaskId)}
            onValueChange={setPrompt}
            onAttachmentsChange={setConversationAttachments}
            onSubmit={submitPromptRequest}
            onOpenTasks={() => onTasks?.()}
            onOpenHistory={() => showPanel('history')}
            onGenerate={submitGeneration}
            notify={notify}
          />
        </section>

      </div>
      <Drawer
        open={detailedPanelOpen}
        title={panelCopy[panel].label}
        locale={locale}
        onClose={() => setPanelOpen(false)}
        footer={panel === 'history' && libraryId ? (
          <div className="workbench-compose__actions">
            <Button variant="secondary" icon="save" disabled={readOnly || revisionBusy} onClick={() => { void saveRevision(); }}>{t(locale, '保存版本', 'Save version')}</Button>
          </div>
        ) : undefined}
      >
          <div className="workbench-context">
            <div className="workbench-panel-heading workbench-context__heading">
              <div>
                <p>{t(locale, '上下文', 'Context')}</p>
                <h2>{panelCopy[panel].label}</h2>
              </div>
            </div>

            {panel === 'history' && (
              <div className="workbench-context__content workbench-history">
                <p className="workbench-section-copy">
                  {t(
                    locale,
                    libraryId ? '当前文档的场景会保存到工作区。修订时间线将在版本提交后显示。' : '示例会话只包含初始基线。预览编辑尚未保存为版本。',
                    libraryId ? 'The current document scene is saved to the workspace. Revision events appear after a version is committed.' : 'This example session contains only its baseline. Preview edits are not saved as a version.',
                  )}
                </p>
                <ol className="workbench-history-list">
                {tasks.flatMap((task) => task.state === 'completed'
                  ? taskCandidates(task).map((candidate) => ({ task, candidate }))
                  : []).map(({ candidate }) => {
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
                      </div>
                      {candidatePreviewId === candidate.id && <p role="status">{t(locale, `候选素材 ${candidate.assetIds.join(', ')}`, `Candidate assets ${candidate.assetIds.join(', ')}`)}</p>}
                      {compareRevisionId === candidate.id && latest && <CompareRevisions left={{ revisionId: candidate.id, sceneAssetId: candidate.sceneAssetId ?? candidate.assetIds[0] ?? 'candidate', assetIds: candidate.assetIds }} right={latest} />}
                    </div>
                  </li>;
                })}
                {revisionState.revisions.length > 0 ? revisionState.revisions.map((revision) => <li key={revision.revisionId}>
                    <span className="workbench-history-marker" aria-hidden="true" />
                    <div>
                      <Badge>{t(locale, '版本', 'Version')}</Badge>
                      <strong>{revision.revisionId.slice(0, 8)}</strong>
                      <p>{new Date(revision.createdAt).toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-US')}</p>
                      {revision.contributions.length > 0 && <p className="workbench-history-contributors"><span>{t(locale, '贡献', 'Contributors')}:</span> {revision.contributions.map((contribution) => `${contribution.designerName ?? contribution.designerVersionId} · ${contributionRoleLabel(locale, contribution.role)}`).join('，')}</p>}
                      {revision.operatorName && <p className="workbench-history-operator"><span>{t(locale, '操作者', 'Operator')}:</span> {revision.operatorName}</p>}
                      <div className="workbench-history-actions">
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
                    <strong>{t(locale, '调整尺寸', 'Resize')}</strong>
                    <p>{t(locale, '本地转换并生成可确认的结果候选。', 'Transform locally and create a result candidate for review.')}</p>
                  </div>
                  <Button aria-label={t(locale, '配置调整尺寸', 'Configure resize')} variant="secondary" icon="sliders-horizontal" disabled={readOnly} onClick={() => configureImageTool('resize')}>{t(locale, '配置', 'Configure')}</Button>
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
                    <Icon name="crop" />
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
                  <span className="workbench-tool-entry__icon"><Icon name="image" /></span>
                  <div>
                    <strong>{t(locale, '去除背景', 'Remove background')}</strong>
                    <p>{t(locale, '保留主体，生成透明背景副本。', 'Keep the subject and create a transparent-background copy.')}</p>
                  </div>
                  <Button aria-label={t(locale, '配置去除背景', 'Configure remove background')} variant="secondary" icon="sliders-horizontal" disabled={readOnly} onClick={() => configureImageTool('remove-background')}>{t(locale, '配置', 'Configure')}</Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="file-image" /></span>
                  <div>
                    <strong>{t(locale, '替换背景', 'Replace background')}</strong>
                    <p>{t(locale, '使用描述生成新的背景方向。', 'Generate a new background direction from a description.')}</p>
                  </div>
                  <Button aria-label={t(locale, '配置替换背景', 'Configure replace background')} variant="secondary" icon="sliders-horizontal" disabled={readOnly} onClick={() => configureImageTool('replace-background')}>{t(locale, '配置', 'Configure')}</Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="trash-2" /></span>
                  <div>
                    <strong>{t(locale, '移除对象', 'Remove object')}</strong>
                    <p>{t(locale, '移除选区中的对象并保留周围细节。', 'Remove an object from a selected region while preserving nearby detail.')}</p>
                  </div>
                  <Button aria-label={t(locale, '配置移除对象', 'Configure remove object')} variant="secondary" icon="sliders-horizontal" disabled={readOnly} onClick={() => configureImageTool('remove-object')}>{t(locale, '配置', 'Configure')}</Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="pencil" /></span>
                  <div>
                    <strong>{t(locale, '局部重绘', 'Inpaint')}</strong>
                    <p>{t(locale, '根据描述重绘选区内容。', 'Redraw a selected region from a description.')}</p>
                  </div>
                  <Button aria-label={t(locale, '配置局部重绘', 'Configure inpaint')} variant="secondary" icon="sliders-horizontal" disabled={readOnly} onClick={() => configureImageTool('inpaint')}>{t(locale, '配置', 'Configure')}</Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="maximize-2" /></span>
                  <div>
                    <strong>{t(locale, '扩展画布', 'Expand canvas')}</strong>
                    <p>{t(locale, '延展画布边缘并保持主体构图。', 'Extend the canvas while preserving the primary composition.')}</p>
                  </div>
                  <Button aria-label={t(locale, '配置扩展画布', 'Configure expand canvas')} variant="secondary" icon="sliders-horizontal" disabled={readOnly} onClick={() => configureImageTool('expand')}>{t(locale, '配置', 'Configure')}</Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="zoom-in" /></span>
                  <div>
                    <strong>{t(locale, '放大图像', 'Upscale image')}</strong>
                    <p>{t(locale, '提升图像尺寸并尽量保留细节。', 'Increase image resolution while preserving detail.')}</p>
                  </div>
                  <Button aria-label={t(locale, '配置放大图像', 'Configure upscale image')} variant="secondary" icon="sliders-horizontal" disabled={readOnly} onClick={() => configureImageTool('upscale')}>{t(locale, '配置', 'Configure')}</Button>
                </div>
                <div className="workbench-tool-entry">
                  <span className="workbench-tool-entry__icon"><Icon name="circle-check" /></span>
                  <div>
                    <strong>{t(locale, '移除水印', 'Remove watermark')}</strong>
                    <p>{t(locale, '确认素材权利后，从所选区域移除水印。', 'Confirm your rights, then remove a watermark from the selected region.')}</p>
                  </div>
                  <Button aria-label={t(locale, '配置移除水印', 'Configure remove watermark')} variant="secondary" icon="sliders-horizontal" disabled={readOnly} onClick={() => configureImageTool('remove-watermark')}>{t(locale, '配置', 'Configure')}</Button>
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
        <span>{libraryId ? t(locale, '本地会话', 'Local session') : t(locale, '示例会话', 'Example session')}</span>
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
