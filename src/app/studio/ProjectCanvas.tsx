import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationImageAttachment } from '../../features/agent/task-service';
import type { ProjectDesign, ProjectCanvasLayout } from '../../features/projects/metadata';
import type { ProjectGenerationRatio } from '../../features/projects/size';
import type { TaskRecord } from '../../features/tasks/state';
import { getDesktopApi } from '../../platform/runtime';
import type { Locale } from '../i18n';
import type { PersonaProfile } from './personas';
import type { Project } from './types';
import { ConversationDock, type ConversationDockAttachment } from './ConversationDock';
import { AnalysisPanel, type AnalysisPanelRequest } from './AnalysisPanel';
import { ProjectCanvasStage } from './ProjectCanvasStage';
import { Icon, IconButton, t } from './ui';
import './project-canvas.css';

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
  onOpenDocument?: (documentId: string) => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onConnections: () => void;
  onRemoveBackground?: (design: ProjectDesign) => void | Promise<void>;
  onSubmitConversation: (message: string, attachments: ConversationImageAttachment[], context?: { analysisThreadId?: string; conversationParentTaskId?: string; referencedAssetIds?: string[] }) => Promise<TaskRecord | null>;
  onSubmitDesignGeneration: (conversationTaskId: string, generationRatio: ProjectGenerationRatio, count: 1 | 3) => Promise<TaskRecord | null>;
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

export const ProjectCanvas = ({ locale, project, libraryId, readOnly, conversationConnected, designer, designerOptions = [], onDesignerChange, onDesignsChange, onGenerationRatioChange, notify, onBack, onOpenDocument, onRename, onDuplicate, onArchive, onRemoveBackground, onSubmitConversation, onSubmitDesignGeneration }: ProjectCanvasProps) => {
  const [designs, setDesigns] = useState<ProjectDesign[]>(project.designs ?? []);
  const onDesignsChangeRef = useRef(onDesignsChange);
  onDesignsChangeRef.current = onDesignsChange;
  const [layout, setLayout] = useState<ProjectCanvasLayout | undefined>(project.canvasLayout);
  const [selectedDesignIds, setSelectedDesignIds] = useState<string[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [conversationSubmitting, setConversationSubmitting] = useState(false);
  const [backgroundRemovalSubmitting, setBackgroundRemovalSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<ConversationDockAttachment[]>([]);
  const [threadId, setThreadId] = useState<string>();
  const [latestConversation, setLatestConversation] = useState<TaskRecord>();
  const [selectedAnalysisTaskId, setSelectedAnalysisTaskId] = useState<string>();
  const [analysisAttachments, setAnalysisAttachments] = useState<ConversationDockAttachment[]>([]);
  const analysisOpen = true;
  const [analysisCollapsed, setAnalysisCollapsed] = useState(false);
  const [analysisHistoryOpen, setAnalysisHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [referencedAssetIds, setReferencedAssetIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!libraryId) return;
    const [nextDesigns, nextLayout, nextTasks] = await Promise.all([
      getDesktopApi().listProjectDesigns?.({ libraryId, projectId: project.id }),
      getDesktopApi().loadProjectCanvasLayout?.({ libraryId, projectId: project.id }),
      getDesktopApi().listTasks?.(libraryId),
    ]);
    if (nextDesigns) {
      setDesigns(nextDesigns);
      onDesignsChangeRef.current?.(nextDesigns);
    }
    if (nextLayout) setLayout(nextLayout);
    if (nextTasks) {
      const projectTasks = nextTasks.filter((task) => task.source?.kind === 'project' && task.source.id === project.id);
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
    setSelectedDesignIds([]);
    setAnalysisCollapsed(false);
  }, [project.id]);

  const latestAnalysisTask = (latestConversation ? tasks.find((task) => task.id === latestConversation.id) ?? latestConversation : undefined)
    ?? (threadId ? tasks.filter((task) => task.capability === 'conversation' && task.analysisThreadId === threadId).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0] : undefined);
  const analysisTask = selectedAnalysisTaskId
    ? tasks.find((task) => task.id === selectedAnalysisTaskId) ?? latestAnalysisTask
    : latestAnalysisTask;
  const analysisAssetKey = (analysisTask?.contextAssetIds ?? []).join('\0');
  const canGenerate = analysisTask?.state === 'completed' && Boolean(analysisTask.result?.text) && !tasks.some((task) => task.capability === 'design-generation' && (task.state === 'queued' || task.state === 'running'));
  const designTasks = tasks.filter((task) => task.capability === 'design-generation' && task.analysisThreadId === threadId);
  const pendingDesigns = designTasks.flatMap((task) => task.generationSlots?.filter((slot) => slot.state === 'queued' || slot.state === 'running').map((slot) => ({ id: `${task.id}-${slot.id}`, rowKey: task.id, width: analysisTask?.designContext?.document.width ?? 1080, height: analysisTask?.designContext?.document.height ?? 1440 })) ?? []);
  const selectedDesigns = designs.filter((design) => selectedDesignIds.includes(design.id));
  const analysisHistory = getAnalysisHistory(tasks, threadId, analysisTask);
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
  const submit = async (): Promise<void> => {
    if (readOnly || !message.trim()) return;
    const currentMessage = message;
    const currentAttachments = attachments;
    setMessage('');
    setAttachments([]);
    setReferencedAssetIds([]);
    setAnalysisAttachments(currentAttachments);
    const userAttachments = currentAttachments.filter((attachment) => !attachment.assetId).map(toAttachment);
    const context = {
      ...(threadId ? { analysisThreadId: threadId, conversationParentTaskId: analysisTask?.id } : {}),
      ...(referencedAssetIds.length ? { referencedAssetIds } : {}),
    };
    setConversationSubmitting(true);
    try {
      const task = await onSubmitConversation(currentMessage, userAttachments, context);
      if (task) { setThreadId(task.analysisThreadId); setLatestConversation(task); setSelectedAnalysisTaskId(task.id); setAnalysisCollapsed(false); void refresh(); }
      else notify(t(locale, '分析任务提交失败，可重试。', 'Analysis could not be submitted; retry it.'));
    } finally {
      setConversationSubmitting(false);
    }
  };
  const generate = async (count: 1 | 3): Promise<void> => {
    if (!analysisTask || !canGenerate) return;
    await onSubmitDesignGeneration(analysisTask.id, project.generationRatio ?? '3:4', count);
    void refresh();
  };
  const removeBackground = async (): Promise<void> => {
    const design = selectedDesigns.length === 1 ? selectedDesigns[0] : undefined;
    if (!design || readOnly || !onRemoveBackground || backgroundRemovalSubmitting) return;
    setBackgroundRemovalSubmitting(true);
    try {
      await onRemoveBackground(design);
    } finally {
      setBackgroundRemovalSubmitting(false);
    }
  };
  const selectAnalysis = (taskId: string): void => {
    setSelectedAnalysisTaskId(taskId);
    setSelectedDesignIds(designs.filter((design) => design.sourceConversationTaskId === taskId).map((design) => design.id));
    setAnalysisCollapsed(false);
  };
  const saveLayout = async (next: ProjectCanvasLayout): Promise<void> => {
    setLayout(next);
    if (libraryId && !readOnly) await getDesktopApi().saveProjectCanvasLayout?.({ libraryId, projectId: project.id, layout: next });
  };
  const exportSelected = async (): Promise<void> => {
    if (selectedDesigns.length === 0 || !libraryId) return;
    let exported = 0;
    for (const design of selectedDesigns) {
      const result = await getDesktopApi().exportDocument?.({
        libraryId,
        projectId: project.id,
        documentId: design.id,
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
    <section className="project-canvas-surface" data-testid="project-canvas" aria-label={t(locale, '设计画布', 'Design canvas')}>
      <div className="project-canvas-toolbar">
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
        <div className="project-canvas-toolbar__actions">
          {onOpenDocument && project.documentEntries?.map((entry) => (
            <button key={entry.id} type="button" className="ui-button ui-button--text" onClick={() => onOpenDocument(entry.id)}>
              {t(locale, `打开${entry.name}`, `Open ${entry.name}`)}
            </button>
          ))}
          <IconButton name="wand-sparkles" label={t(locale, '去除背景', 'Remove background')} disabled={readOnly || selectedDesigns.length !== 1 || backgroundRemovalSubmitting || !onRemoveBackground} onClick={() => { void removeBackground(); }} />
          <IconButton name="download" label={t(locale, '导出所选设计稿', 'Export selected design')} disabled={selectedDesigns.length === 0} onClick={() => { void exportSelected(); }} />
        </div>
      </div>
      <ProjectCanvasStage
        libraryId={libraryId}
        projectId={project.id}
        designs={designs}
        viewport={layout?.viewport}
        initialNodes={layout?.nodes}
        selectedDesignIds={selectedDesignIds}
        pendingDesigns={pendingDesigns}
        readOnly={readOnly}
        onSelect={(designId) => setSelectedDesignIds(designId ? [designId] : [])}
        onAddToConversation={(designId) => { void addDesignToConversation(designId); }}
        onCanvasBackground={() => setAnalysisCollapsed(true)}
        onLayoutChange={saveLayout}
      />
      {analysisOpen && analysisTask && <div className={`project-canvas-analysis-panel ${analysisCollapsed ? 'is-collapsed project-canvas-analysis-panel--collapsed' : 'project-canvas-analysis-panel--expanded'}`}>
        <AnalysisPanel locale={locale} message={analysisTask.requestText ?? ''} attachments={analysisAttachments} task={analysisTask} canGenerate={Boolean(canGenerate)} collapsed={analysisCollapsed} onGenerate={(count) => { void generate(count); }} onCopyRequest={copyAnalysisRequest} onExpand={() => setAnalysisCollapsed(false)} />
      </div>}
      {analysisOpen && analysisHistory.length > 0 && <section className={`project-canvas-analysis-history${analysisHistoryOpen ? ' is-open' : ''}`} aria-label={t(locale, '分析历史列表', 'Analysis history')}>
        {analysisHistoryOpen && <div className="project-canvas-analysis-history__list project-canvas-analysis-history__list-enter">{analysisHistory.map((task) => {
          const status = getAnalysisStatus(task, locale);
          return <button type="button" className={`project-canvas-analysis-history__item${task.id === analysisTask?.id ? ' is-selected' : ''}`} key={task.id} onClick={() => selectAnalysis(task.id)}><span className={`project-canvas-analysis-history__status is-${status.kind}`} data-testid={`analysis-status-${status.kind}`}><Icon name={status.icon} size={13} /></span><span className="project-canvas-analysis-history__copy"><strong>{task.requestText || t(locale, '未命名分析', 'Untitled analysis')}</strong><span>{status.label}</span></span></button>;
        })}</div>}
        <button type="button" className="project-canvas-analysis-history__trigger" aria-expanded={analysisHistoryOpen} onClick={() => setAnalysisHistoryOpen((open) => !open)}>
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
          generationRatio={project.generationRatio ?? '3:4'}
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
    </section>
  );
};
