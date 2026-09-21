import { useCallback, useEffect, useState } from 'react';
import type { ConversationImageAttachment } from '../../features/agent/task-service';
import type { ProjectDesign, ProjectCanvasLayout } from '../../features/projects/metadata';
import type { ProjectGenerationRatio } from '../../features/projects/size';
import type { TaskRecord } from '../../features/tasks/state';
import { getDesktopApi } from '../../platform/runtime';
import type { Locale } from '../i18n';
import type { PersonaProfile } from './personas';
import type { Project } from './types';
import { ConversationDock, type ConversationDockAttachment } from './ConversationDock';
import { AnalysisPanel } from './AnalysisPanel';
import { ProjectCanvasStage } from './ProjectCanvasStage';
import { Icon, IconButton, t } from './ui';
import './project-canvas.css';

type ProjectCanvasProps = {
  locale: Locale;
  project: Project;
  workspaceId?: string;
  readOnly: boolean;
  conversationConnected: boolean;
  designer: PersonaProfile | null;
  notify: (message: string) => void;
  onBack: () => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onConnections: () => void;
  onSubmitConversation: (message: string, attachments: ConversationImageAttachment[], context?: { analysisThreadId?: string; conversationParentTaskId?: string; referencedAssetIds?: string[] }) => Promise<TaskRecord | null>;
  onSubmitDesignGeneration: (conversationTaskId: string, generationRatio: ProjectGenerationRatio) => Promise<TaskRecord | null>;
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

export const ProjectCanvas = ({ locale, project, workspaceId, readOnly, conversationConnected, designer, notify, onBack, onRename, onDuplicate, onArchive, onConnections, onSubmitConversation, onSubmitDesignGeneration }: ProjectCanvasProps) => {
  const [designs, setDesigns] = useState<ProjectDesign[]>(project.designs ?? []);
  const [layout, setLayout] = useState<ProjectCanvasLayout | undefined>(project.canvasLayout);
  const [selectedDesignIds, setSelectedDesignIds] = useState<string[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<ConversationDockAttachment[]>([]);
  const [threadId, setThreadId] = useState<string>();
  const [latestConversation, setLatestConversation] = useState<TaskRecord>();
  const [selectedAnalysisTaskId, setSelectedAnalysisTaskId] = useState<string>();
  const [analysisAttachments, setAnalysisAttachments] = useState<ConversationDockAttachment[]>([]);
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [analysisHistoryOpen, setAnalysisHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [referencedAssetIds, setReferencedAssetIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const [nextDesigns, nextLayout, nextTasks] = await Promise.all([
      getDesktopApi().listProjectDesigns?.({ workspaceId, projectId: project.id }),
      getDesktopApi().loadProjectCanvasLayout?.({ workspaceId, projectId: project.id }),
      getDesktopApi().listTasks?.(workspaceId),
    ]);
    if (nextDesigns) setDesigns(nextDesigns);
    if (nextLayout) setLayout(nextLayout);
    if (nextTasks) {
      const projectTasks = nextTasks.filter((task) => task.source?.kind === 'project' && task.source.id === project.id);
      const persistedLatest = getLatestConversationTask(projectTasks);
      setTasks(projectTasks);
      setLatestConversation((current) => current ?? persistedLatest);
      setThreadId((current) => current ?? persistedLatest?.analysisThreadId);
    }
  }, [project.id, workspaceId]);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => { void refresh(); }, 1200); return () => window.clearInterval(timer); }, [refresh]);
  useEffect(() => {
    setThreadId(undefined);
    setLatestConversation(undefined);
    setSelectedAnalysisTaskId(undefined);
    setAnalysisAttachments([]);
    setSelectedDesignIds([]);
  }, [project.id]);

  const latestAnalysisTask = (latestConversation ? tasks.find((task) => task.id === latestConversation.id) ?? latestConversation : undefined)
    ?? (threadId ? tasks.filter((task) => task.capability === 'conversation' && task.analysisThreadId === threadId).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0] : undefined);
  const analysisTask = selectedAnalysisTaskId
    ? tasks.find((task) => task.id === selectedAnalysisTaskId) ?? latestAnalysisTask
    : latestAnalysisTask;
  const canGenerate = analysisTask?.state === 'completed' && Boolean(analysisTask.result?.text) && !tasks.some((task) => task.capability === 'design-generation' && (task.state === 'queued' || task.state === 'running'));
  const designTasks = tasks.filter((task) => task.capability === 'design-generation' && task.analysisThreadId === threadId);
  const pendingDesigns = designTasks.flatMap((task) => task.generationSlots?.filter((slot) => slot.state === 'queued' || slot.state === 'running').map((slot) => ({ id: `${task.id}-${slot.id}`, rowKey: task.id, width: analysisTask?.designContext?.document.width ?? 1080, height: analysisTask?.designContext?.document.height ?? 1440 })) ?? []);
  const selectedDesigns = designs.filter((design) => selectedDesignIds.includes(design.id));
  const analysisHistory = getAnalysisHistory(tasks, threadId, analysisTask);
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
    const task = await onSubmitConversation(currentMessage, userAttachments, context);
    if (task) { setThreadId(task.analysisThreadId); setLatestConversation(task); setSelectedAnalysisTaskId(task.id); void refresh(); }
    else notify(t(locale, '分析任务提交失败，可重试。', 'Analysis could not be submitted; retry it.'));
  };
  const generate = async (): Promise<void> => {
    if (!analysisTask || !canGenerate) return;
    await onSubmitDesignGeneration(analysisTask.id, project.generationRatio ?? '3:4');
    void refresh();
  };
  const selectAnalysis = (taskId: string): void => {
    setSelectedAnalysisTaskId(taskId);
    setSelectedDesignIds(designs.filter((design) => design.sourceConversationTaskId === taskId).map((design) => design.id));
    setAnalysisHistoryOpen(false);
  };
  const saveLayout = async (next: ProjectCanvasLayout): Promise<void> => {
    setLayout(next);
    if (workspaceId && !readOnly) await getDesktopApi().saveProjectCanvasLayout?.({ workspaceId, projectId: project.id, layout: next });
  };
  const exportSelected = async (): Promise<void> => {
    if (selectedDesigns.length === 0 || !workspaceId) return;
    let exported = 0;
    for (const design of selectedDesigns) {
      const result = await getDesktopApi().exportDocument?.({
        workspaceId,
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
    if (!design || !workspaceId || attachments.some((attachment) => attachment.assetId === design.assetId)) return;
    const bytes = await getDesktopApi().readAsset?.({ workspaceId, projectId: project.id, assetId: design.assetId });
    if (!bytes) return;
    setAttachments((current) => current.some((attachment) => attachment.assetId === design.assetId)
      ? current
      : [...current, { assetId: design.assetId, name: design.title || `${design.id}.png`, mimeType: 'image/png', bytes, previewUrl: bytesToDataUrl('image/png', bytes) }]);
    setReferencedAssetIds((current) => current.includes(design.assetId) ? current : [...current, design.assetId]);
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
          <IconButton name="message-circle" label={t(locale, '设计分析', 'Design analysis')} onClick={() => setAnalysisOpen((open) => !open)} />
          <IconButton name="download" label={t(locale, '导出所选设计稿', 'Export selected design')} disabled={selectedDesigns.length === 0} onClick={() => { void exportSelected(); }} />
        </div>
      </div>
      <ProjectCanvasStage
        workspaceId={workspaceId}
        projectId={project.id}
        designs={designs}
        viewport={layout?.viewport}
        initialNodes={layout?.nodes}
        selectedDesignIds={selectedDesignIds}
        pendingDesigns={pendingDesigns}
        readOnly={readOnly}
        onSelect={(designId) => setSelectedDesignIds(designId ? [designId] : [])}
        onAddToConversation={(designId) => { void addDesignToConversation(designId); }}
        onLayoutChange={saveLayout}
      />
      {analysisOpen && analysisTask && <div className="project-canvas-analysis-panel">
        <AnalysisPanel locale={locale} message={analysisTask.requestText ?? ''} attachments={analysisAttachments} task={analysisTask} canGenerate={Boolean(canGenerate)} onGenerate={() => { void generate(); }} />
      </div>}
      {analysisOpen && analysisHistory.length > 0 && <section className={`project-canvas-analysis-history${analysisHistoryOpen ? ' is-open' : ''}`} aria-label={t(locale, '分析结果列表', 'Analysis results')}>
        {analysisHistoryOpen && <div className="project-canvas-analysis-history__list">{analysisHistory.map((task) => <button type="button" className={`project-canvas-analysis-history__item${task.id === selectedAnalysisTaskId ? ' is-selected' : ''}`} key={task.id} onClick={() => selectAnalysis(task.id)}><strong>{task.requestText || t(locale, '未命名分析', 'Untitled analysis')}</strong><span>{task.state === 'completed' ? t(locale, '已完成', 'Completed') : task.state === 'failed' ? t(locale, '失败', 'Failed') : t(locale, '处理中', 'Processing')}</span></button>)}</div>}
        <button type="button" className="project-canvas-analysis-history__trigger" aria-expanded={analysisHistoryOpen} onClick={() => setAnalysisHistoryOpen((open) => !open)}>
          <span>{t(locale, '分析结果', 'Analysis results')}</span><span className="project-canvas-analysis-history__count">{analysisHistory.length}</span><Icon name={analysisHistoryOpen ? 'chevron-up' : 'chevron-down'} size={14} />
        </button>
      </section>}
      <div className="project-canvas-toolbar project-canvas-toolbar--bottom">
        <ConversationDock
          variant="compact"
          locale={locale}
          value={message}
          attachments={attachments}
          readOnly={readOnly}
          busy={Boolean(analysisTask?.state === 'queued' || analysisTask?.state === 'running')}
          conversationConnected={conversationConnected}
          designer={designer}
          generationRatio={project.generationRatio ?? '3:4'}
          onGenerationRatioChange={() => undefined}
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
          onDesignerClick={onConnections}
          notify={notify}
        />
      </div>
    </section>
  );
};
