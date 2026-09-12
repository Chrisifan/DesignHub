import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getMessages, type Locale } from '../i18n';
import { WindowBar } from '../shell/WindowBar';
import { exampleProjects } from './examples';
import { LibraryPages } from './LibraryPages';
import { DesignerHero } from './DesignerHero';
import { NewDesignPage } from './NewDesignPage';
import { PersonaArtwork } from './PersonaArtwork';
import { getPersona, localize, personaProfiles, type PersonaProfile } from './personas';
import { Workbench } from './Workbench';
import type { CanvasAssetAction } from '../../features/canvas/CanvasWorkspace';
import type { WorkspaceDescriptor } from '../../features/workspace/open-workspace';
import { getDesktopApi } from '../../platform/runtime';
import {
  ArtworkPreview,
  Badge,
  Button,
  EmptyState,
  Field,
  Icon,
  IconButton,
  Modal,
  PageHeader,
  t,
} from './ui';
import type { NewDesignDraft, Project, StudioSurface, Theme, View } from './types';
import type { ProjectDocumentMetadata, ProjectMetadataPatch } from '../../features/projects/metadata';
import type { ImageTool } from '../../features/image-tools/target';
import { resizeScene } from '../../features/image-tools/local-transform';
import { buildSearchIndex, searchIndex } from '../../features/library/indexer';
import '../styles/studio.css';

const navigation: { view: View; icon: string; zh: string; en: string }[] = [
  { view: 'projects', icon: 'layout-grid', zh: '项目库', en: 'Projects' },
  { view: 'designers', icon: 'users', zh: '设计师', en: 'Designers' },
  { view: 'assets', icon: 'image', zh: '素材库', en: 'Assets' },
  { view: 'brands', icon: 'palette', zh: '品牌包', en: 'Brand kits' },
  { view: 'connections', icon: 'plug', zh: '模型连接', en: 'Connections' },
  { view: 'tasks', icon: 'clock', zh: '模型任务', en: 'Model tasks' },
  { view: 'delivery', icon: 'download', zh: '导出交付', en: 'Delivery' },
  { view: 'storage', icon: 'hard-drive', zh: '工作区管理', en: 'Workspace' },
  { view: 'settings', icon: 'settings', zh: '设置', en: 'Settings' },
];

const readOperatorName = (): string => {
  try { return localStorage.getItem('designhub.operator.name') ?? ''; } catch { return ''; }
};

type StudioProps = {
  locale: Locale;
  theme: Theme;
  workspace?: WorkspaceDescriptor | null;
  onLocaleChange: (locale: Locale) => void;
  onThemeChange: (theme: Theme) => void;
  onExit: () => void;
  onWorkspaceChange?: (workspace: WorkspaceDescriptor) => void;
};

export const Studio = ({
  locale,
  theme,
  workspace = null,
  onLocaleChange,
  onThemeChange,
  onExit,
  onWorkspaceChange,
}: StudioProps) => {
  const [view, setView] = useState<View>('projects');
  const [surface, setSurface] = useState<StudioSurface>('projects');
  const [projects, setProjects] = useState(() => (workspace ? [] : exampleProjects));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [display, setDisplay] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<Project | null>(null);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [deliveryProject, setDeliveryProject] = useState<Project | null>(null);
  const [dialog, setDialog] = useState<'workspace' | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [notice, setNotice] = useState('');
  const newDesignReturnFocus = useRef<HTMLElement | null>(null);
  const [draft, setDraft] = useState<NewDesignDraft>({
    name: '',
    goal: '',
    brief: '',
    personaId: 'paper-type',
    size: '1080 × 1440',
    mode: 'manual',
  });
  const [creationDraftId, setCreationDraftId] = useState<string | null>(null);
  const [conversationResult, setConversationResult] = useState<{ taskId: string; text: string } | null>(null);
  const [projectDialog, setProjectDialog] = useState<'rename' | null>(null);
  const [relatedDialog, setRelatedDialog] = useState(false);
  const [relatedName, setRelatedName] = useState('');
  const [relatedWidth, setRelatedWidth] = useState('1080');
  const [relatedHeight, setRelatedHeight] = useState('1080');
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [designerOptions, setDesignerOptions] = useState<PersonaProfile[]>(personaProfiles);
  const [modelConnected, setModelConnected] = useState(false);
  const [operatorName, setOperatorName] = useState(readOperatorName);
  const [pendingAssetAction, setPendingAssetAction] = useState<(CanvasAssetAction & { projectId?: string }) | null>(null);
  const updateOperatorName = (value: string): void => {
    const next = value.slice(0, 80);
    setOperatorName(next);
    try { localStorage.setItem('designhub.operator.name', next); } catch { /* in-memory fallback */ }
  };
  useEffect(() => {
    let cancelled = false;
    if (!workspace) {
      setProjects(exampleProjects);
    } else {
      setProjects([]);
      const request = getDesktopApi().listActiveProjects?.(workspace.workspaceId);
      if (!request) {
        setProjects([]);
      }
      void request?.then((entries) => {
        if (cancelled || !entries) return;
        setProjects(entries.map((entry) => ({
          id: entry.projectId,
          workspaceId: workspace.workspaceId,
          documentId: entry.documents?.[0]?.id,
          name: entry.name,
          enName: entry.name,
          description: entry.brief ?? t(locale, '本地项目', 'Local project'),
          enDescription: entry.brief ?? 'Local project',
          designers: ['纸感排版'],
          activeDesignerVersionId: entry.activeDesignerVersionId,
          contributorDesignerVersionIds: entry.contributorDesignerVersionIds,
          designerSnapshot: entry.designerSnapshot,
          brandSnapshot: entry.brandSnapshot,
          artwork: 'blank' as const,
          documents: entry.documents?.length ?? 1,
          documentEntries: entry.documents?.map(({ id, name, width, height, sourceDocumentId, sourceRevisionId, finalizedRevisionId }) => ({ id, name, width, height, sourceDocumentId, sourceRevisionId, finalizedRevisionId })),
          archived: entry.archived,
        })));
      }).catch(() => undefined);
    }
    setSelected(null);
    setDocumentOpen(false);
    setActiveDocumentId(null);
    setView('projects');
    setSurface('projects');
    return () => { cancelled = true; };
  }, [workspace?.workspaceId, locale]);
  useEffect(() => {
    let cancelled = false;
    if (!workspace) { setModelConnected(false); return () => { cancelled = true; }; }
    const request = getDesktopApi().hasCredential?.('openai-compatible');
    void request?.then((value) => { if (!cancelled) setModelConnected(Boolean(value)); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [workspace?.workspaceId]);
  useEffect(() => {
    let cancelled = false;
    if (!workspace) { setDesignerOptions(personaProfiles); return () => { cancelled = true; }; }
    const request = getDesktopApi().loadDesignerState?.(workspace.workspaceId);
    void request?.then((state) => {
      if (cancelled) return;
      const byId = new Map((state?.profiles ?? []).map((profile) => [profile.id, profile]));
      setDesignerOptions([...personaProfiles.map((profile) => byId.get(profile.id) ?? profile), ...(state?.profiles ?? []).filter((profile) => !personaProfiles.some((builtin) => builtin.id === profile.id))]);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [workspace]);
  useEffect(() => {
    if (!workspace || !creationDraftId) return undefined;
    let cancelled = false;
    const request = getDesktopApi().listTasks?.(workspace.workspaceId);
    void request?.then((stored) => {
      if (cancelled || !stored) return;
      const completed = stored.find((task) => task.source?.kind === 'creation-draft' && task.source.id === creationDraftId && task.state === 'completed' && task.result?.text);
      if (!completed?.result?.text) return;
      setConversationResult({ taskId: completed.id, text: completed.result.text });
      setDraft((current) => ({ ...current, brief: completed.result?.text ?? current.brief }));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [creationDraftId, workspace]);
  const navigate = (next: View) => {
    setView(next);
    setSurface(next);
    setDocumentOpen(false);
    setSelected(null);
  };
  const routeAssetAction = (input: { assetId: string; mode: CanvasAssetAction['mode']; projectId?: string }): void => {
    const project = projects.find((entry) => entry.id === input.projectId) ?? projects[0];
    const documentId = project?.documentEntries?.[0]?.id ?? project?.documentId;
    if (!project || !documentId) {
      notify(t(locale, '请先创建项目', 'Create a project first'));
      return;
    }
    setPendingAssetAction({ id: crypto.randomUUID(), assetId: input.assetId, mode: input.mode, projectId: project.id });
    setSelected(project);
    setActiveDocumentId(documentId);
    setDocumentOpen(true);
    setSurface('projects');
    setView('projects');
    notify(t(locale, input.mode === 'replace' ? '已准备替换图像' : input.mode === 'reference' ? '已准备参考图层' : '已准备放入画布', input.mode === 'replace' ? 'Ready to replace the selected image' : input.mode === 'reference' ? 'Ready to add a reference layer' : 'Ready to place on canvas'));
  };
  const notify = (message: string) => setNotice(message);
  const updateProject = async (patch: ProjectMetadataPatch): Promise<void> => {
    if (!workspace || !selected || workspace.openMode !== 'writable') return;
    try {
      const metadata = await getDesktopApi().updateProjectMetadata?.({ workspaceId: workspace.workspaceId, projectId: selected.id, patch });
      if (!metadata) return;
      setProjects((current) => current.map((project) => project.id === selected.id ? {
        ...project,
        name: metadata.name,
        enName: metadata.name,
        description: metadata.brief ?? project.description,
        enDescription: metadata.brief ?? project.enDescription,
        documents: metadata.documents.length || project.documents,
        documentEntries: metadata.documents.map(({ id, name, width, height, sourceDocumentId, sourceRevisionId, finalizedRevisionId }) => ({ id, name, width, height, sourceDocumentId, sourceRevisionId, finalizedRevisionId })),
        archived: metadata.archived,
        activeDesignerVersionId: metadata.activeDesignerVersionId,
        contributorDesignerVersionIds: metadata.contributorDesignerVersionIds,
        designerSnapshot: metadata.designerSnapshot,
      } : project));
      setSelected((current) => current ? {
        ...current,
        name: metadata.name,
        enName: metadata.name,
        description: metadata.brief ?? current.description,
        enDescription: metadata.brief ?? current.enDescription,
        documents: metadata.documents.length || current.documents,
        documentEntries: metadata.documents.map(({ id, name, width, height, sourceDocumentId, sourceRevisionId, finalizedRevisionId }) => ({ id, name, width, height, sourceDocumentId, sourceRevisionId, finalizedRevisionId })),
        archived: metadata.archived,
        activeDesignerVersionId: metadata.activeDesignerVersionId,
        contributorDesignerVersionIds: metadata.contributorDesignerVersionIds,
        designerSnapshot: metadata.designerSnapshot,
      } : current);
      notify(t(locale, patch.name ? '项目已重命名' : '项目已归档', patch.name ? 'Project renamed' : 'Project archived'));
    } catch {
      notify(t(locale, '项目更新失败，请重试', 'Project update failed; try again'));
    }
  };
  const openRelatedDialog = (): void => {
    if (!workspace || workspace.openMode !== 'writable' || !selected) return;
    const source = selected.documentEntries?.find((entry) => entry.id === (activeDocumentId ?? selected.documentId)) ?? selected.documentEntries?.[0];
    if (!source?.finalizedRevisionId) {
      notify(t(locale, '请先定稿源文档', 'Finalize the source document first'));
      return;
    }
    setRelatedName('');
    setRelatedWidth('1080');
    setRelatedHeight('1080');
    setRelatedDialog(true);
  };
  const createRelatedSize = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!workspace || workspace.openMode !== 'writable' || !selected) return;
    const source = selected.documentEntries?.find((entry) => entry.id === (activeDocumentId ?? selected.documentId)) ?? selected.documentEntries?.[0];
    const width = Number(relatedWidth);
    const height = Number(relatedHeight);
    if (!source?.finalizedRevisionId || !relatedName.trim() || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      notify(t(locale, '尺寸信息无效', 'Enter a valid document name and size'));
      return;
    }
    const documents: Array<Omit<ProjectDocumentMetadata, 'updatedAt'>> = (selected.documentEntries ?? []).map((entry) => ({
      id: entry.id,
      name: entry.name,
      width: entry.width,
      height: entry.height,
      ...(entry.sourceDocumentId ? { sourceDocumentId: entry.sourceDocumentId } : {}),
      ...(entry.sourceRevisionId ? { sourceRevisionId: entry.sourceRevisionId } : {}),
      ...(entry.finalizedRevisionId ? { finalizedRevisionId: entry.finalizedRevisionId } : {}),
    }));
    const relatedDocumentId = `doc-${crypto.randomUUID()}`;
    documents.push({ id: relatedDocumentId, name: relatedName.trim(), width, height, sourceDocumentId: source.id, sourceRevisionId: source.finalizedRevisionId, finalizedRevisionId: null });
    await updateProject({ documents });
    const sourceRevisions = await getDesktopApi().loadDocumentRevisions?.(workspace.workspaceId, selected.id, source.id);
    const sourceRevision = sourceRevisions?.revisions.find((revision) => revision.revisionId === source.finalizedRevisionId);
    if (sourceRevision?.scene) {
      try {
        const converted = resizeScene(sourceRevision.scene, { width, height });
        await getDesktopApi().saveDocumentScene?.({ workspaceId: workspace.workspaceId, projectId: selected.id, documentId: relatedDocumentId, scene: { ...converted, id: relatedDocumentId } });
      } catch {
        notify(t(locale, '布局转换失败，已创建空白尺寸稿', 'Layout conversion failed; an empty size document was created'));
      }
    }
    setRelatedDialog(false);
    setActiveDocumentId(relatedDocumentId);
    notify(t(locale, '关联尺寸已创建', 'Related size created'));
  };
  const switchProjectDesigner = async (designerId: string): Promise<void> => {
    if (!selected || !workspace || workspace.openMode !== 'writable') return;
    const designer = designerOptions.find((profile) => profile.id === designerId);
    if (!designer) return;
    await updateProject({ activeDesignerVersionId: designer.id, designerSnapshot: structuredClone(designer) });
    notify(t(locale, '设计师已切换', 'Designer switched'));
  };
  const toggleProjectContributor = async (designerId: string): Promise<void> => {
    if (!selected || !workspace || workspace.openMode !== 'writable') return;
    const current = selected.contributorDesignerVersionIds ?? (selected.activeDesignerVersionId ? [selected.activeDesignerVersionId] : []);
    const next = current.includes(designerId) ? current.filter((id) => id !== designerId) : [...current, designerId];
    const activeId = selected.activeDesignerVersionId;
    const normalized = activeId && !next.includes(activeId) ? [activeId, ...next] : next;
    await updateProject({ contributorDesignerVersionIds: normalized });
    notify(t(locale, '署名已更新', 'Contributors updated'));
  };
  const duplicateSelected = async (): Promise<void> => {
    if (!workspace || !selected || workspace.openMode !== 'writable') return;
    try {
      const result = await getDesktopApi().duplicateProject?.({ workspaceId: workspace.workspaceId, sourceProjectId: selected.id, operationId: crypto.randomUUID() });
      if (!result) return;
      const duplicate: Project = { ...selected, id: result.projectId, name: `${selected.name} copy`, enName: `${selected.enName} copy`, archived: false };
      setProjects((current) => [duplicate, ...current]);
      notify(t(locale, '项目已复制', 'Project duplicated'));
    } catch {
      notify(t(locale, '复制失败，请重试', 'Duplicate failed; try again'));
    }
  };
  const importProjectPackage = async (): Promise<void> => {
    if (!workspace || workspace.openMode !== 'writable') return;
    try {
      const result = await getDesktopApi().importProjectPackage?.({ workspaceId: workspace.workspaceId });
      if (!result) return;
      const entries = await getDesktopApi().listActiveProjects?.(workspace.workspaceId);
      if (entries) {
        setProjects(entries.map((entry) => ({
          id: entry.projectId,
          workspaceId: workspace.workspaceId,
          documentId: entry.documents?.[0]?.id,
          name: entry.name,
          enName: entry.name,
          description: entry.brief ?? t(locale, '本地项目', 'Local project'),
          enDescription: entry.brief ?? 'Local project',
          designers: ['纸感排版'],
          artwork: 'blank' as const,
          documents: entry.documents?.length ?? 1,
          archived: entry.archived,
        })));
      }
      notify(t(locale, '项目包已导入', 'Project package imported'));
    } catch {
      notify(t(locale, '项目包导入失败', 'Project package import failed'));
    }
  };
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const title = navigation.find((item) => item.view === view)!;
  const nativeControlSide = navigator.userAgent.includes('Mac')
    ? 'left'
    : 'right';
  const searchRecords = projects.map((project) => {
    const brand = project.brandSnapshot as { source?: { brandId?: string } } | undefined;
    return {
      workspaceId: project.workspaceId ?? 'preview',
      projectId: project.id,
      documentId: project.documentId ?? `${project.id}-overview`,
      title: `${project.name} ${project.enName}`,
      brief: `${project.description} ${project.enDescription}`,
      brand: brand?.source?.brandId,
      size: `${project.documents} documents`,
      tags: project.designers,
      updatedAt: undefined,
      finalized: false,
      contributorIds: [...new Set([
        ...(project.activeDesignerVersionId ? [project.activeDesignerVersionId] : []),
        ...(project.contributorDesignerVersionIds ?? []),
      ])],
    };
  });
  const indexedProjects = buildSearchIndex(searchRecords);
  const visibleProjectIds = new Set(searchIndex(indexedProjects, { workspaceId: workspace?.workspaceId ?? 'preview', query }).map((item) => item.projectId));
  const visibleProjects = projects.filter((project) =>
    (filter === 'all' || Boolean(project.archived) === (filter === 'archived')) && visibleProjectIds.has(project.id),
  );
  const openProject = (project: Project) => {
    setSelected(project);
    setSurface('projects');
    setDocumentOpen(false);
    setActiveDocumentId(null);
    setView('projects');
  };
  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    if (draft.mode === 'conversation') {
      if (!draft.brief.trim()) return;
      if (!workspace || workspace.openMode !== 'writable') {
        notify(t(locale, '请先打开可写工作区。', 'Open a writable workspace first.'));
        return;
      }
      const draftId = creationDraftId ?? `creation-${crypto.randomUUID()}`;
      try {
        const task = await getDesktopApi().submitConversation?.({
          workspaceId: workspace.workspaceId,
          source: { kind: 'creation-draft', id: draftId },
          connectionId: 'openai-compatible',
          message: draft.brief.trim(),
        });
        if (!task) {
          notify(t(locale, '模型连接不可用，草稿未提交。', 'Model connection unavailable; draft was not submitted.'));
          return;
        }
        setCreationDraftId(draftId);
        setConversationResult(null);
        notify(t(locale, '简报任务已排队，确认后创建项目。', 'Brief task queued; confirm it before creating the project.'));
      } catch {
        notify(t(locale, '任务提交失败，请检查连接。', 'Task submission failed. Check the connection.'));
      }
      return;
    }
    const documentId = crypto.randomUUID();
    if (workspace?.openMode === 'writable') {
      const created = await getDesktopApi().createProjectContainer?.({
        workspaceId: workspace.workspaceId,
        operationId: crypto.randomUUID(),
        name: draft.name.trim(),
        brief: draft.goal || draft.brief || undefined,
        activeDesignerVersionId: draft.personaId,
        designerSnapshot: getPersona(draft.personaId),
        documents: [{ id: documentId, name: t(locale, '主海报', 'Main poster'), width: 1080, height: 1440 }],
      });
      if (!created) {
        notify(t(locale, '无法保存项目，请检查工作区。', 'Could not save the project. Check the workspace.'));
        return;
      }
      const project: Project = {
        id: created.projectId,
        workspaceId: workspace.workspaceId,
        documentId,
        name: draft.name.trim(),
        enName: draft.name.trim(),
        description: draft.goal || draft.brief || t(locale, '本地项目', 'Local project'),
        enDescription: draft.goal || draft.brief || 'Local project',
        designers: [getPersona(draft.personaId)?.name.zh ?? '纸感排版'],
        activeDesignerVersionId: draft.personaId,
        designerSnapshot: getPersona(draft.personaId),
        artwork: 'blank',
        documents: 1,
        documentEntries: [{ id: documentId, name: t(locale, '主海报', 'Main poster'), width: 1080, height: 1440 }],
      };
      setProjects((previous) => [project, ...previous]);
      setSurface('projects');
      setSelected(project);
      setView('projects');
      setQuery('');
      setFilter('active');
      setDraft({ name: '', goal: '', brief: '', personaId: 'paper-type', size: '1080 × 1440', mode: 'manual' });
      setCreationDraftId(null);
      setConversationResult(null);
      notify(t(locale, '项目已保存到本地工作区。', 'Project saved to the local workspace.'));
      return;
    }
    if (workspace) {
      notify(t(locale, '当前工作区为只读模式，无法创建项目。', 'This workspace is read-only; projects cannot be created.'));
      return;
    }
    const project: Project = {
      id: `preview-${crypto.randomUUID()}`,
      name: draft.name.trim(),
      enName: draft.name.trim(),
      description:
        draft.goal || draft.brief ||
        t(locale, '本次预览中的项目草稿', 'A project draft for this preview'),
      enDescription: draft.goal || draft.brief || 'A project draft for this preview',
      designers: [getPersona(draft.personaId)?.name.zh ?? '纸感排版'],
      artwork: 'blank',
      documents: 1,
      documentEntries: [{ id: documentId, name: t(locale, '主海报', 'Main poster'), width: 1080, height: 1440 }],
    };
    setProjects((previous) => [project, ...previous]);
    setSurface('projects');
    setSelected(project);
    setView('projects');
    setQuery('');
    setFilter('active');
    setDraft({
      name: '',
      goal: '',
      brief: '',
      personaId: 'paper-type',
      size: '1080 × 1440',
      mode: 'manual',
    });
    setCreationDraftId(null);
    setConversationResult(null);
    notify(
      t(
        locale,
        '预览草稿已创建，关闭预览后不会保留。',
        'Preview draft created. It will not be kept after leaving this preview.',
      ),
    );
  };
  const projectName = (project: Project) =>
    t(locale, project.name, project.enName);
  const designerName = (name: string) =>
    locale === 'zh-CN'
      ? name
      : ((
          {
            纸感排版: 'Paper & type',
            极简构成: 'Minimal form',
            自然叙事: 'Natural stories',
            清晰商业: 'Clear Commerce',
          } as Record<string, string>
        )[name] ?? name);
  const projectPersonaId = (project: Project) => {
    if (project.activeDesignerVersionId) return project.activeDesignerVersionId;
    const name = project.designers[0];
    return (
      {
        纸感排版: 'paper-type',
        极简构成: 'paper-type',
        自然叙事: 'natural-story',
        清晰商业: 'clear-commerce',
      } as Record<string, string>
    )[name] ?? 'paper-type';
  };
  const projectDesignerLabel = (project: Project): string => {
    const snapshot = project.designerSnapshot as { name?: { zh?: string; en?: string } } | undefined;
    const localizedName = snapshot?.name?.[locale === 'zh-CN' ? 'zh' : 'en'];
    return localizedName ?? designerName(project.designers[0] ?? '纸感排版');
  };
  const openDelivery = (project: Project) => {
    setDeliveryProject(project);
    navigate('delivery');
  };
  const openDocument = (project: Project, documentId?: string): void => {
    setSelected(project);
    setActiveDocumentId(documentId ?? project.documentEntries?.[0]?.id ?? project.documentId ?? null);
    setDocumentOpen(true);
    setSurface('projects');
    setView('projects');
  };
  const submitProjectConversation = async (project: Project, message: string): Promise<void> => {
    if (!workspace || workspace.openMode !== 'writable' || !project.workspaceId) {
      notify(t(locale, '请先打开可写工作区。', 'Open a writable workspace first.'));
      return;
    }
    try {
      const task = await getDesktopApi().submitConversation?.({
        workspaceId: workspace.workspaceId,
        projectId: project.id,
        ...(project.documentId ? { documentId: project.documentId } : {}),
        connectionId: 'openai-compatible',
        message,
      });
      if (!task) {
        notify(t(locale, '模型连接不可用，任务未提交。', 'Model connection unavailable; task was not submitted.'));
        return;
      }
      notify(t(locale, '任务已排队。', 'Task queued.'));
    } catch {
      notify(t(locale, '任务提交失败，请检查连接。', 'Task submission failed. Check the connection.'));
    }
  };
  const submitProjectImageTask = async (project: Project, input: { tool: ImageTool; prompt: string; baseRevisionId: string | null }): Promise<void> => {
    if (!workspace || workspace.openMode !== 'writable' || !project.workspaceId) {
      notify(t(locale, '请先打开可写工作区。', 'Open a writable workspace first.'));
      return;
    }
    const documentId = project.id === selected?.id ? (activeDocumentId ?? project.documentId) : project.documentId;
    if (!documentId) {
      notify(t(locale, '请先打开文档。', 'Open a document first.'));
      return;
    }
    try {
      const api = getDesktopApi();
      const scene = await api.loadDocumentScene?.(workspace.workspaceId, project.id, documentId);
      const imageLayer = scene?.layers.find((layer): layer is Extract<typeof layer, { type: 'image' }> => layer.type === 'image' && layer.assetId !== 'placeholder');
      if (!imageLayer) {
        notify(t(locale, '当前文档没有受管图像。', 'The current document has no managed image layer.'));
        return;
      }
      const bytes = await api.readAsset?.({ workspaceId: workspace.workspaceId, projectId: project.id, assetId: imageLayer.assetId });
      if (!bytes) {
        notify(t(locale, '无法读取目标图像。', 'Could not read the target image.'));
        return;
      }
      const task = await api.submitImageEdit?.({ workspaceId: workspace.workspaceId, projectId: project.id, documentId, baseRevisionId: input.baseRevisionId, designerVersionId: project.activeDesignerVersionId, connectionId: 'openai-compatible', prompt: input.prompt, image: new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], { type: 'image/png' }) });
      if (!task) {
        notify(t(locale, '模型连接不可用，任务未提交。', 'Model connection unavailable; task was not submitted.'));
        return;
      }
      notify(t(locale, `${input.tool} 任务已排队。`, `${input.tool} task queued.`));
    } catch {
      notify(t(locale, '图像任务提交失败，请检查连接。', 'Image task submission failed. Check the connection.'));
    }
  };
  const submitProjectImageGeneration = async (project: Project, prompt: string, baseRevisionId: string | null): Promise<void> => {
    if (!workspace || workspace.openMode !== 'writable' || !project.workspaceId) {
      notify(t(locale, '请先打开可写工作区。', 'Open a writable workspace first.'));
      return;
    }
    const documentId = project.id === selected?.id ? (activeDocumentId ?? project.documentId) : project.documentId;
    if (!documentId) {
      notify(t(locale, '请先打开文档。', 'Open a document first.'));
      return;
    }
    try {
      const task = await getDesktopApi().submitImageGeneration?.({ workspaceId: workspace.workspaceId, projectId: project.id, documentId, baseRevisionId, designerVersionId: project.activeDesignerVersionId, connectionId: 'openai-compatible', prompt, size: `${project.documentEntries?.find((entry) => entry.id === documentId)?.width ?? 1080}x${project.documentEntries?.find((entry) => entry.id === documentId)?.height ?? 1440}`, count: 2 });
      if (!task) {
        notify(t(locale, '模型连接不可用，任务未提交。', 'Model connection unavailable; task was not submitted.'));
        return;
      }
      notify(t(locale, '生成任务已排队。', 'Generation task queued.'));
    } catch {
      notify(t(locale, '生成任务提交失败，请检查连接。', 'Generation task submission failed. Check the connection.'));
    }
  };
  const openNewDesign = (mode: NewDesignDraft['mode'], personaId?: string) => {
    newDesignReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDraft((previous) => ({
      ...previous,
      mode,
      personaId: personaId ?? previous.personaId,
    }));
    setSurface('new-design');
    setView('projects');
    setSelected(null);
    setDocumentOpen(false);
  };
  const backFromNewDesign = () => {
    setSurface('projects');
    window.requestAnimationFrame(() => {
      const projectCreateButton = Array.from(
        document.querySelectorAll<HTMLButtonElement>('.studio-toolbar .toolbar-actions button'),
      ).find((button) => button.textContent?.includes('新建项目') || button.textContent?.includes('New project'));
      (projectCreateButton ?? newDesignReturnFocus.current)?.focus({ preventScroll: true });
    });
  };
  const breadcrumbTitle =
    surface === 'new-design'
      ? t(locale, '新建设计', 'New design')
      : selected
        ? projectName(selected)
        : t(locale, title.zh, title.en);
  const toolbarActions =
    surface === 'projects' && view === 'projects' && !documentOpen && !selected ? (
      <>
        <Button
          icon="message-square"
          variant="ai"
          onClick={() => openNewDesign('conversation')}
        >
          {t(locale, '对话创建', 'Create with chat')}
        </Button>
        <Button
          icon="plus"
          variant="primary"
          onClick={() => openNewDesign('manual')}
        >
          {t(locale, '新建项目', 'New project')}
        </Button>
      </>
    ) : surface === 'projects' && view === 'projects' && !documentOpen && selected ? (
      <>
        <Button icon="download" onClick={() => openDelivery(selected)}>
          {t(locale, '导出交付', 'Delivery')}
        </Button>
        <Button
          variant="primary"
          icon="file-image"
          onClick={() => setDocumentOpen(true)}
        >
          {t(locale, '继续编辑', 'Open workbench')}
        </Button>
      </>
    ) : view === 'assets' ? (
      <span className="disabled-action">
        <Button icon="upload" disabled>
          {t(locale, '导入', 'Import')}
        </Button>
        <small>{t(locale, '需要桌面文件能力', 'Desktop file access required')}</small>
      </span>
    ) : null;
  return (
    <>
      <WindowBar
        copy={getMessages(locale)}
        locale={locale}
        theme={theme}
        nativeControlSide={nativeControlSide}
        onLocaleChange={onLocaleChange}
        onThemeChange={onThemeChange}
        previewLabel={workspace ? undefined : t(locale, '示例预览', 'Example preview')}
        themeLabel={t(locale, '切换主题', 'Switch theme')}
        workspace={{
          name: workspace?.name ?? t(locale, '我的设计空间', 'My design studio'),
          detail: workspace
            ? workspace.openMode === 'read-only'
              ? t(locale, '只读工作区', 'Read-only workspace')
              : t(locale, '本地工作区', 'Local workspace')
            : t(locale, '示例工作区', 'Example workspace'),
          label: t(locale, '切换工作区', 'Switch workspace'),
          onClick: () => setDialog('workspace'),
        }}
      />
      <div className={`studio ${collapsed ? 'studio--compact' : ''}`}>
        <aside className="studio-sidebar">
        <nav
          aria-label={t(locale, '主导航', 'Main navigation')}
          className="main-navigation"
        >
          {navigation.map((item, index) => (
            <div key={item.view}>
              {(index === 4 || index === 7) && <div className="nav-divider" />}
              <button
                onClick={() => navigate(item.view)}
                aria-current={view === item.view ? 'page' : undefined}
                aria-label={t(locale, item.zh, item.en)}
                title={t(locale, item.zh, item.en)}
                className={`nav-item ${view === item.view ? 'is-active' : ''}`}
              >
                <Icon name={item.icon} />
                <span className="sidebar-label">
                  {t(locale, item.zh, item.en)}
                </span>
                {item.view === 'projects' && (
                  <span className="nav-count sidebar-label">
                    {projects.length}
                  </span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <Icon name="hard-drive" size={16} />
            <span className="sidebar-label">
              {t(locale, '创作由你掌握', 'Your work, your space')}
              <small>
                {t(
                  locale,
                  '本地优先 · 无需账号',
                  'Local first · No account needed',
                )}
              </small>
            </span>
          </div>
          <button
            className="operator"
            onClick={() => navigate('settings')}
            title={t(locale, '本机操作者设置', 'Local operator settings')}
          >
            <span className="operator-avatar">{(operatorName.trim() || 'S').slice(0, 1).toUpperCase()}</span>
            <span className="sidebar-label">
              {operatorName.trim() || t(locale, '本机操作者', 'Local operator')}
              <small>
                {t(locale, '仅用于创作署名', 'For creative attribution')}
              </small>
            </span>
            <Icon name="settings" size={15} />
          </button>
        </div>
        </aside>
        <div className="studio-main">
        <header
          className="studio-toolbar"
          aria-label={t(locale, '工作区工具栏', 'Workspace toolbar')}
        >
          <div className="toolbar-location">
            <IconButton
              name="panel-left"
              label={t(locale, '切换侧栏', 'Toggle sidebar')}
              onClick={() => setCollapsed(!collapsed)}
            />
            {surface === 'new-design' && (
              <IconButton
                name="arrow-left"
                label={t(locale, '返回', 'Back')}
                onClick={backFromNewDesign}
              />
            )}
            <span className="toolbar-divider" />
            <span className="toolbar-workspace">
              {workspace?.name ?? t(locale, '我的设计空间', 'My design studio')}
            </span>
            <Icon name="chevron-right" size={14} />
            <span className="breadcrumb-current">
              {breadcrumbTitle}
            </span>
          </div>
          <div className="toolbar-actions">{toolbarActions}</div>
        </header>
        <div className="studio-body">
          {surface === 'new-design' && (
            <NewDesignPage
              locale={locale}
              draft={draft}
              onDraftChange={setDraft}
              onCreate={createProject}
              onBack={backFromNewDesign}
              profiles={designerOptions}
              persisted={workspace?.openMode === 'writable'}
              conversationResult={conversationResult}
              onConfirmConversation={(taskId) => {
                if (!conversationResult || conversationResult.taskId !== taskId) return;
                setDraft((current) => ({ ...current, mode: 'manual', goal: conversationResult.text }));
                notify(t(locale, '简报已确认，请创建项目。', 'Brief confirmed. Create the project when ready.'));
              }}
            />
          )}
          {surface === 'projects' && view === 'projects' && !selected && (
            <section className="page-content projects-page">
              <PageHeader
                title={t(locale, '项目库', 'Projects')}
                description={t(
                  locale,
                  '从一个想法，到一组完整的作品。',
                  'From the first idea to a complete collection.',
                )}
                eyebrow={t(locale, '工作区 / 创作', 'WORKSPACE / CREATE')}
              >
                {workspace?.openMode === 'writable' && <Button aria-label={t(locale, '导入项目包', 'Import package')} icon="upload" onClick={() => { void importProjectPackage(); }}>{t(locale, '导入', 'Import')}</Button>}
              </PageHeader>
              <div className="project-controls">
                <div
                  className="tab-strip"
                  aria-label={t(locale, '项目状态', 'Project status')}
                >
                  {(['active', 'archived', 'all'] as const).map((value) => (
                    <button
                      key={value}
                      className={filter === value ? 'is-active' : ''}
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                    >
                      {value === 'active'
                        ? t(locale, '进行中', 'Active')
                        : value === 'archived'
                          ? t(locale, '已归档', 'Archived')
                          : t(locale, '全部项目', 'All projects')}
                      {value === 'active' && (
                        <span>
                          {
                            projects.filter((project) => !project.archived)
                              .length
                          }
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="project-search-tools">
                  <label className="search-input">
                    <Icon name="search" size={16} />
                    <input
                      type="search"
                      aria-label={t(locale, '搜索项目', 'Search projects')}
                      placeholder={t(locale, '搜索项目…', 'Search projects…')}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  <div className="view-toggle">
                    <IconButton
                      name="layout-grid"
                      label={t(locale, '网格视图', 'Grid view')}
                      aria-pressed={display === 'grid'}
                      onClick={() => setDisplay('grid')}
                    />
                    <IconButton
                      name="list"
                      label={t(locale, '列表视图', 'List view')}
                      aria-pressed={display === 'list'}
                      onClick={() => setDisplay('list')}
                    />
                  </div>
                </div>
              </div>
              {visibleProjects.length ? (
                <div
                  className={`project-collection project-collection--${display}`}
                >
                  {visibleProjects.map((project) => (
                    <button
                      className="project-card"
                      key={project.id}
                      onClick={() => openProject(project)}
                      aria-label={projectName(project)}
                    >
                      <div className="project-cover">
                        <ArtworkPreview kind={project.artwork} />
                        <span className="project-open">
                          <Icon name="arrow-up-right" size={20} />
                        </span>
                        <span className="cover-caption">
                          {project.documents} {t(locale, '份文档', 'documents')}
                        </span>
                      </div>
                      <div className="project-card-body">
                        <div className="project-title-line">
                          <h2>{projectName(project)}</h2>
                          <Icon name="arrow-up-right" size={16} />
                        </div>
                        <p>
                          {t(
                            locale,
                            project.description,
                            project.enDescription,
                          )}
                        </p>
                        <div className="project-meta">
                          <span className="design-attribution">
                            <PersonaArtwork personaId={projectPersonaId(project)} crop="avatar" />
                            <strong>
                              {projectDesignerLabel(project)} · {getPersona(projectPersonaId(project))?.version ?? (project.designerSnapshot as { version?: string } | undefined)?.version ?? 'v1.0'}
                            </strong>
                          </span>
                          <span className="project-meta-end">
                            {project.workspaceId ? t(locale, '本地', 'Local') : t(locale, '示例', 'Example')}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="search"
                  title={t(locale, '没有匹配的项目', 'No matching projects')}
                  description={t(
                    locale,
                    '试试其他关键词，或查看全部项目。',
                    'Try another keyword or view all projects.',
                  )}
                >
                  <Button
                    onClick={() => {
                      setQuery('');
                      setFilter('all');
                    }}
                  >
                    {t(locale, '清除搜索', 'Clear search')}
                  </Button>
                </EmptyState>
              )}
              <div className="creation-note">
                <span className="creation-note-symbol">
                  <Icon name="sparkles" size={22} />
                </span>
                <div>
                  <h2>
                    {t(
                      locale,
                      '下一次创作，从这里开始',
                      'Start your next creative direction',
                    )}
                  </h2>
                  <p>
                    {t(
                      locale,
                      '选择设计师、整理简报，或直接打开空白文档。',
                      'Choose a designer, write a brief, or start with a blank document.',
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  icon="arrow-right"
                  onClick={() => openNewDesign('manual')}
                >
                  {t(locale, '开始创作', 'Start creating')}
                </Button>
              </div>
              <p className="example-footnote">
                <Icon name="circle-help" size={14} />
                {t(
                  locale,
                  '这些示例用于浏览界面。预览中的修改仅在本次会话保留。',
                  'Explore with example content. Preview changes last for this session only.',
                )}
              </p>
            </section>
          )}
          {surface === 'projects' && view === 'projects' && selected && !documentOpen && (
            <section className="page-content project-detail">
              <PageHeader
                title={projectName(selected)}
                description={t(
                  locale,
                  selected.description,
                  selected.enDescription,
                )}
                eyebrow={t(
                  locale,
                  selected.workspaceId ? '设计项目 / 本地' : '设计项目 / 示例',
                  selected.workspaceId ? 'DESIGN PROJECT / LOCAL' : 'DESIGN PROJECT / EXAMPLE',
                )}
              >
                {workspace?.openMode === 'writable' && selected.workspaceId && <>
                  <Button icon="settings" onClick={() => { setProjectNameDraft(selected.name); setProjectDialog('rename'); }}>{t(locale, '重命名', 'Rename')}</Button>
                  <Button icon="copy" onClick={() => { void duplicateSelected(); }}>{t(locale, '复制', 'Duplicate')}</Button>
                  {!selected.archived && <Button icon="folder" onClick={() => { void updateProject({ archived: true }); }}>{t(locale, '归档', 'Archive')}</Button>}
                </>}
              </PageHeader>
              <DesignerHero
                personaId={projectPersonaId(selected)}
                profile={designerOptions.find((profile) => profile.id === projectPersonaId(selected))}
                locale={locale}
                label={t(locale, '当前设计师', 'Active designer')}
              />
              {workspace?.openMode === 'writable' && selected.workspaceId && <Field label={t(locale, '设计师', 'Designer')}>
                <select value={projectPersonaId(selected)} onChange={(event) => { void switchProjectDesigner(event.target.value); }}>
                  {designerOptions.filter((profile) => profile.status !== 'archived').map((profile) => <option key={profile.id} value={profile.id}>{localize(locale, profile.name)} · {profile.version}</option>)}
                </select>
              </Field>}
              {workspace?.openMode === 'writable' && selected.workspaceId && <fieldset className="project-contributors">
                <legend>{t(locale, '版本署名', 'Revision credits')}</legend>
                <p className="muted">{t(locale, '可为同一版本添加多位设计师。当前设计师始终作为主署名。', 'Add multiple designers to the same revision. The active designer remains the lead credit.')}</p>
                <div className="project-contributors__list">
                  {designerOptions.filter((profile) => profile.status !== 'archived').map((profile) => {
                    const contributorIds = selected.contributorDesignerVersionIds ?? (selected.activeDesignerVersionId ? [selected.activeDesignerVersionId] : []);
                    return <label key={profile.id} className="project-contributor-option">
                      <input type="checkbox" checked={contributorIds.includes(profile.id)} disabled={profile.id === selected.activeDesignerVersionId} onChange={() => { void toggleProjectContributor(profile.id); }} />
                      <span>{localize(locale, profile.name)} · {profile.version}</span>
                    </label>;
                  })}
                </div>
              </fieldset>}
              <div className="project-context">
                <div>
                  <small>{t(locale, '活跃版本', 'ACTIVE VERSION')}</small>
                  <strong>{getPersona(projectPersonaId(selected))?.version ?? 'v1.0'}</strong>
                </div>
                <div>
                  <small>{t(locale, '项目状态', 'PROJECT STATUS')}</small>
                    <strong>{selected.workspaceId ? t(locale, '进行中', 'Active') : t(locale, '预览草稿', 'Preview draft')}</strong>
                </div>
                <div>
                  <small>{t(locale, '品牌上下文', 'BRAND CONTEXT')}</small>
                  <strong>
                    {t(locale, '未附加品牌包', 'No brand kit attached')}
                  </strong>
                </div>
                <div>
                  <small>{t(locale, '内容保留', 'RETENTION')}</small>
                  <strong>
                    {selected.workspaceId ? t(locale, '本地保存', 'Saved locally') : t(locale, '仅本次预览', 'This preview only')}
                  </strong>
                </div>
              </div>
              <div className="section-title">
                <h2>{t(locale, '设计文档', 'Design documents')}</h2>
                <div className="section-title__actions">
                  <span>
                    {selected.documents} {t(locale, '份物料', 'deliverables')}
                  </span>
                  {workspace?.openMode === 'writable' && selected.workspaceId && (
                    <Button icon="plus" onClick={openRelatedDialog}>
                      {t(locale, '新建尺寸', 'New size')}
                    </Button>
                  )}
                </div>
              </div>
              <div className="document-collection">
                {Array.from({ length: selected.documents }, (_, index) => {
                  const entry = selected.documentEntries?.[index];
                  const fallbackName = index === 0 ? t(locale, '主海报', 'Main poster') : index === 1 ? t(locale, '社媒方图', 'Social square') : t(locale, '活动横幅', 'Campaign banner');
                  const fallbackSize = index === 0 ? '1080 × 1440' : index === 1 ? '1080 × 1080' : '1920 × 1080';
                  return <button
                    className="document-card"
                    key={entry?.id ?? index}
                    onClick={() => {
                      if (entry?.id || index === 0) openDocument(selected, entry?.id);
                      else notify(t(locale, '当前可打开主海报预览，其他尺寸稿将在文档能力接入后提供。', 'Open the main poster preview. Other sizes will be available with document storage.'));
                    }}
                    aria-label={index === 0 ? t(locale, '打开主海报', 'Open main poster') : t(locale, `查看尺寸稿 ${index}`, `View size variant ${index}`)}
                  >
                    <div
                      className={`document-cover document-cover--${index % 3}`}
                    >
                      <ArtworkPreview kind={selected.artwork} />
                    </div>
                    <div className="document-card-body">
                      <h3>{entry?.name ?? fallbackName}</h3>
                      <span>
                        {entry ? `${entry.width} × ${entry.height}` : fallbackSize}{' '}
                        px <Badge>{selected.workspaceId ? t(locale, '本地', 'Local') : t(locale, '示例', 'Example')}</Badge>
                      </span>
                    </div>
                  </button>
                })}
              </div>
              <div className="brief-summary">
                <h2>{t(locale, '设计简报', 'Design brief')}</h2>
                <p>{t(locale, selected.description, selected.enDescription)}</p>
                <p className="muted">
                  {t(
                    locale,
                    '参考素材、固定文案和设计约束会随正式项目一同保留。',
                    'Reference assets, fixed copy and creative constraints will be retained with a real project.',
                  )}
                </p>
              </div>
            </section>
          )}
          {projects.map((project) => (
            <div
              className="destination"
              key={project.id}
                hidden={
                  surface !== 'projects' ||
                  view !== 'projects' ||
                !documentOpen ||
                selected?.id !== project.id
              }
            >
              <Workbench
                locale={locale}
                project={project}
                workspaceId={project.workspaceId}
                documentId={project.id === selected?.id ? (activeDocumentId ?? project.documentId) : project.documentId}
                onBack={() => setDocumentOpen(false)}
                onExport={() => openDelivery({ ...project, documentId: project.id === selected?.id ? (activeDocumentId ?? project.documentId) : project.documentId })}
                onConnections={() => navigate('connections')}
                onSubmitConversation={(message) => submitProjectConversation(project, message)}
                onSubmitImageTask={(input) => submitProjectImageTask(project, input)}
                onSubmitImageGeneration={(prompt, baseRevisionId) => submitProjectImageGeneration(project, prompt, baseRevisionId)}
                assetAction={project.id === selected?.id ? pendingAssetAction ?? undefined : undefined}
                onAssetActionHandled={(actionId) => setPendingAssetAction((current) => current?.id === actionId ? null : current)}
                operatorName={operatorName}
                modelConnected={modelConnected}
                notify={notify}
              />
            </div>
          ))}
          {navigation
            .filter((item) => item.view !== 'projects')
            .map((item) => (
              <div
                className="destination"
                key={item.view}
                hidden={surface !== item.view || view !== item.view}
              >
                <LibraryPages
                  locale={locale}
                  view={item.view as Exclude<View, 'projects'>}
                  deliveryProject={deliveryProject}
                  workspaceId={workspace?.workspaceId}
                  projectId={selected?.id ?? projects[0]?.id}
                  readOnly={workspace?.openMode === 'read-only'}
                  notify={notify}
                  navigate={navigate}
                  onUseForNew={(personaId) => openNewDesign('manual', personaId)}
                  onAssetAction={routeAssetAction}
                  theme={theme}
                  onThemeChange={onThemeChange}
                  onLocaleChange={onLocaleChange}
                  onWorkspaceChange={onWorkspaceChange}
                  operatorName={operatorName}
                  onOperatorNameChange={updateOperatorName}
                />
              </div>
            ))}
        </div>
        <footer className="studio-status">
          <span>
            <Icon name="hard-drive" size={12} />
            {t(
              locale,
              workspace
                ? workspace.openMode === 'read-only'
                  ? '只读工作区'
                  : '本地工作区'
                : '示例工作区 · 仅本次预览',
              workspace
                ? workspace.openMode === 'read-only'
                  ? 'Read-only workspace'
                  : 'Local workspace'
                : 'Example workspace · Session only',
            )}
          </span>
          <span>
            <Icon name="plug" size={12} />
            {t(locale, '模型未连接', 'No model connected')}
          </span>
          <span className="status-end">
            DesignHub <span className="mono">0.1</span>
          </span>
        </footer>
        </div>
      </div>
      {notice && (
        <div role="status" className="studio-toast">
          <Icon name="circle-help" size={18} />
          <span>{notice}</span>
          <IconButton
            name="x"
            label={t(locale, '关闭提示', 'Dismiss notification')}
            onClick={() => setNotice('')}
          />
        </div>
      )}
      {dialog === 'workspace' && (
        <Modal
          title={t(locale, '切换工作区', 'Switch workspace')}
          onClose={() => setDialog(null)}
          locale={locale}
        >
          <p className="muted">
            {workspace
              ? workspace.openMode === 'read-only'
                ? t(locale, '当前工作区为只读模式。', 'This workspace is read-only.')
                : t(locale, '当前工作区保存在本机目录。', 'This workspace is stored in a local folder.')
              : t(locale, '示例修改仅在本次预览中保留，离开示例后会清除。', 'Example edits stay in this preview and are cleared when you leave it.')}
          </p>
          <button className="workspace-choice" onClick={() => setDialog(null)}>
            <span className="workspace-monogram">{workspace?.name.slice(0, 1).toUpperCase() ?? 'D'}</span>
            <span>
              <strong>{workspace?.name ?? t(locale, '我的设计空间', 'My design studio')}</strong>
              <small>
                {workspace
                  ? workspace.openMode === 'read-only'
                    ? t(locale, '只读工作区 · 当前', 'Read-only workspace · Current')
                    : t(locale, '本地工作区 · 当前', 'Local workspace · Current')
                  : t(locale, '示例工作区 · 当前', 'Example workspace · Current')}
              </small>
            </span>
            <Icon name="check" />
          </button>
          <div className="dialog-actions">
            <Button onClick={onExit} icon="folder-open">
              {t(locale, '工作区', 'Workspace welcome')}
            </Button>
            <Button onClick={() => setDialog(null)} variant="primary">
              {t(locale, '继续浏览', 'Continue browsing')}
            </Button>
          </div>
        </Modal>
      )}
      {projectDialog === 'rename' && selected && (
        <Modal title={t(locale, '重命名项目', 'Rename project')} locale={locale} onClose={() => setProjectDialog(null)}>
          <Field label={t(locale, '项目名称', 'Project name')}>
            <input autoFocus value={projectNameDraft} onChange={(event) => setProjectNameDraft(event.target.value)} />
          </Field>
          <div className="dialog-actions">
            <Button onClick={() => setProjectDialog(null)}>{t(locale, '取消', 'Cancel')}</Button>
            <Button variant="primary" icon="check" disabled={!projectNameDraft.trim()} onClick={() => { setProjectDialog(null); void updateProject({ name: projectNameDraft }); }}>{t(locale, '保存', 'Save')}</Button>
          </div>
        </Modal>
      )}
      {relatedDialog && selected && (
        <Modal title={t(locale, '创建关联尺寸', 'Create related size')} locale={locale} onClose={() => setRelatedDialog(false)}>
          <form onSubmit={(event) => { void createRelatedSize(event); }}>
            <Field label={t(locale, '文档名称', 'Document name')}>
              <input autoFocus value={relatedName} onChange={(event) => setRelatedName(event.target.value)} />
            </Field>
            <div className="form-grid form-grid--two">
              <Field label={t(locale, '宽度', 'Width')}>
                <input type="number" min="1" step="1" value={relatedWidth} onChange={(event) => setRelatedWidth(event.target.value)} />
              </Field>
              <Field label={t(locale, '高度', 'Height')}>
                <input type="number" min="1" step="1" value={relatedHeight} onChange={(event) => setRelatedHeight(event.target.value)} />
              </Field>
            </div>
            <p className="inline-notice"><Icon name="git-branch" size={16} />{t(locale, '新文档会记录源文档与定稿版本，但拥有独立画布。', 'The new document records its source and final revision while keeping an independent canvas.')}</p>
            <div className="dialog-actions">
              <Button type="button" onClick={() => setRelatedDialog(false)}>{t(locale, '取消', 'Cancel')}</Button>
              <Button type="submit" variant="primary" icon="check" disabled={!relatedName.trim()}>{t(locale, '创建尺寸', 'Create size')}</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};
