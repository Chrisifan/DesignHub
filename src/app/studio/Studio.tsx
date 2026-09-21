import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getMessages, type Locale } from '../i18n';
import { WindowBar } from '../shell/WindowBar';
import { LibraryPages } from './LibraryPages';
import { NewProjectForm } from './NewDesignPage';
import { Drawer } from './Drawer';
import { PageToolbarHost, PageToolbarProvider } from './PageToolbar';
import { ProjectCanvas } from './ProjectCanvas';
import { StudioHome } from './StudioHome';
import { StudioUserMenu } from './StudioUserMenu';
import { createAutomaticProjectName } from './auto-project-name';
import { localize, type PersonaProfile } from './personas';
import { legacySeededDesignerIds } from '../../features/designers/persistence';
import { Workbench } from './Workbench';
import type { CanvasAssetAction } from '../../features/canvas/CanvasWorkspace';
import type { WorkspaceDescriptor } from '../../features/workspace/open-workspace';
import type { ActiveProject } from '../../features/workspace/project-store';
import { getDesktopApi } from '../../platform/runtime';
import {
  Button,
  Field,
  Icon,
  IconButton,
  Modal,
  t,
} from './ui';
import type { HomeConversationRequest, NewDesignDraft, PendingHomeConversation, Project, StudioSurface, Theme, View } from './types';
import type { ProjectDocumentMetadata, ProjectMetadata, ProjectMetadataPatch } from '../../features/projects/metadata';
import type { ImageTool, ToolParams } from '../../features/image-tools/target';
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
];

const destinations: { view: View; icon: string; zh: string; en: string }[] = [
  ...navigation,
  { view: 'settings', icon: 'settings', zh: '设置', en: 'Settings' },
];

const emptyProjects: Project[] = [];
const emptyDesignerOptions: PersonaProfile[] = [];
const emptyAssets: NonNullable<Parameters<typeof LibraryPages>[0]['initialAssets']> = [];
const emptyBrands: NonNullable<Parameters<typeof LibraryPages>[0]['initialBrands']> = [];

const readOperatorName = (): string => {
  try { return localStorage.getItem('designhub.operator.name') ?? ''; } catch { return ''; }
};

const toStudioProject = (entry: ActiveProject, workspaceId: string): Project => {
  const snapshot = entry.designerSnapshot as { name?: { zh?: string; en?: string } } | undefined;
  const primaryDesigner = snapshot?.name?.zh ?? snapshot?.name?.en;
  const documentEntries = entry.documents?.map(({ id, name, width, height, sourceDocumentId, sourceRevisionId, finalizedRevisionId }) => ({ id, name, width, height, sourceDocumentId, sourceRevisionId, finalizedRevisionId }));
  return {
    id: entry.projectId,
    workspaceId,
    documentId: entry.documents?.[0]?.id,
    name: entry.name,
    enName: entry.name,
    description: entry.brief ?? '',
    enDescription: entry.brief ?? '',
    designers: primaryDesigner ? [primaryDesigner] : [],
    activeDesignerVersionId: entry.activeDesignerVersionId,
    contributorDesignerVersionIds: entry.contributorDesignerVersionIds,
    designerSnapshot: entry.designerSnapshot,
    brandSnapshot: entry.brandSnapshot,
    coverAssetId: entry.coverAssetId,
    artwork: 'blank',
    designs: entry.designs,
    canvasLayout: entry.canvasLayout,
    documents: documentEntries?.length ?? 0,
    documentEntries,
    archived: entry.archived,
    updatedAt: entry.updatedAt,
  };
};

const mergeProjectMetadata = (current: Project, metadata: ProjectMetadata): Project => ({
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
  brandSnapshot: metadata.brandSnapshot,
  coverAssetId: metadata.coverAssetId,
  designs: metadata.designs,
  canvasLayout: metadata.canvasLayout,
});

type StudioProps = {
  locale: Locale;
  theme: Theme;
  workspace?: WorkspaceDescriptor | null;
  onLocaleChange: (locale: Locale) => void;
  onThemeChange: (theme: Theme) => void;
  onExit: () => void;
  onWorkspaceChange?: (workspace: WorkspaceDescriptor) => void;
  recentWorkspaces?: WorkspaceDescriptor[];
  onOpenWorkspace?: (directory: string) => Promise<WorkspaceDescriptor | null>;
  initialProjects?: Project[];
  initialDesignerOptions?: PersonaProfile[];
  initialAssets?: Parameters<typeof LibraryPages>[0]['initialAssets'];
  initialBrands?: Parameters<typeof LibraryPages>[0]['initialBrands'];
};

export const Studio = ({
  locale,
  theme,
  workspace = null,
  onLocaleChange,
  onThemeChange,
  onExit,
  onWorkspaceChange,
  recentWorkspaces = [],
  onOpenWorkspace,
  initialProjects = emptyProjects,
  initialDesignerOptions = emptyDesignerOptions,
  initialAssets = emptyAssets,
  initialBrands = emptyBrands,
}: StudioProps) => {
  const [view, setView] = useState<View>('projects');
  const [surface, setSurface] = useState<StudioSurface>('projects');
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [projectsLoadFailed, setProjectsLoadFailed] = useState(false);
  const [projectsReloadKey, setProjectsReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [selected, setSelected] = useState<Project | null>(null);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [deliveryProject] = useState<Project | null>(null);
  const [dialog, setDialog] = useState<'workspace' | null>(null);
  const [notice, setNotice] = useState('');
  const [newProjectDrawerOpen, setNewProjectDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<NewDesignDraft>({
    name: '',
    goal: '',
    brief: '',
    personaId: '',
    size: '1080 × 1440',
    mode: 'manual',
  });
  const previewCoverUrls = useRef(new Set<string>());
  const activeWorkspaceRef = useRef(workspace);
  activeWorkspaceRef.current = workspace;
  const [projectDialog, setProjectDialog] = useState<'rename' | null>(null);
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [designerOptions, setDesignerOptions] = useState<PersonaProfile[]>(initialDesignerOptions);
  const [conversationConnected, setConversationConnected] = useState(false);
  const [homeCreationBusy, setHomeCreationBusy] = useState(false);
  const [pendingHomeConversation, setPendingHomeConversation] = useState<PendingHomeConversation | null>(null);
  const [operatorName, setOperatorName] = useState(readOperatorName);
  const [pendingAssetAction, setPendingAssetAction] = useState<(CanvasAssetAction & { projectId?: string }) | null>(null);
  useEffect(() => () => {
    previewCoverUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewCoverUrls.current.clear();
  }, []);
  const updateOperatorName = (value: string): void => {
    const next = value.slice(0, 80);
    setOperatorName(next);
    try { localStorage.setItem('designhub.operator.name', next); } catch { /* in-memory fallback */ }
  };
  useEffect(() => {
    let cancelled = false;
    if (!workspace) {
      setProjects(initialProjects);
      setProjectsLoadFailed(false);
      setDesignerOptions(initialDesignerOptions);
      setDraft((current) => ({ ...current, personaId: '' }));
    } else {
      setProjects([]);
      setProjectsLoadFailed(false);
      setDesignerOptions([]);
      setDraft((current) => ({ ...current, personaId: '' }));
      const request = getDesktopApi().listActiveProjects?.(workspace.workspaceId);
      if (!request) {
        setProjects([]);
        setProjectsLoadFailed(true);
      }
      void request?.then((entries) => {
        if (cancelled) return;
        if (!entries) { setProjects([]); setProjectsLoadFailed(true); return; }
        setProjectsLoadFailed(false);
        setProjects(entries.map((entry) => toStudioProject(entry, workspace.workspaceId)));
      }).catch(() => { if (!cancelled) { setProjects([]); setProjectsLoadFailed(true); } });
    }
    setSelected(null);
    setDocumentOpen(false);
    setActiveDocumentId(null);
    setPendingHomeConversation(null);
    setNewProjectDrawerOpen(false);
    setView('projects');
    setSurface('projects');
    return () => { cancelled = true; };
  }, [initialDesignerOptions, initialProjects, workspace?.workspaceId, locale, projectsReloadKey]);
  useEffect(() => {
    let cancelled = false;
    if (!workspace) { setConversationConnected(false); return () => { cancelled = true; }; }
    const request = getDesktopApi().hasCredential?.('openai-compatible:conversation') ?? Promise.resolve(false);
    void request.then((connected) => { if (!cancelled) setConversationConnected(Boolean(connected)); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [workspace?.workspaceId]);
  useEffect(() => {
    let cancelled = false;
    if (!workspace) { setDesignerOptions(initialDesignerOptions); return () => { cancelled = true; }; }
    const request = getDesktopApi().loadDesignerState?.(workspace.workspaceId);
    void request?.then((state) => {
      if (cancelled) return;
      const profiles = (state?.profiles ?? [])
        .filter((profile) => !legacySeededDesignerIds.has(profile.id))
        .map((profile) => profile.status === 'built-in'
        ? { ...profile, status: 'published' as const }
        : profile);
      setDesignerOptions(profiles);
      setDraft((current) => ({
        ...current,
        personaId: profiles.some((profile) => profile.id === current.personaId)
          ? current.personaId
          : '',
      }));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [initialDesignerOptions, workspace]);
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
  const updateProject = async (patch: ProjectMetadataPatch): Promise<ProjectMetadata | null> => {
    if (!workspace || !selected || workspace.openMode !== 'writable') return null;
    try {
      const metadata = await getDesktopApi().updateProjectMetadata?.({ workspaceId: workspace.workspaceId, projectId: selected.id, patch });
      if (!metadata) {
        notify(t(locale, '项目更新失败，请重试', 'Project update failed; try again'));
        return null;
      }
      setProjects((current) => current.map((project) => project.id === selected.id ? mergeProjectMetadata(project, metadata) : project));
      setSelected((current) => current ? mergeProjectMetadata(current, metadata) : current);
      if (patch.name) notify(t(locale, '项目已重命名', 'Project renamed'));
      else if (patch.archived) notify(t(locale, '项目已归档', 'Project archived'));
      return metadata;
    } catch {
      notify(t(locale, '项目更新失败，请重试', 'Project update failed; try again'));
      return null;
    }
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
        setProjects(entries.map((entry) => toStudioProject(entry, workspace.workspaceId)));
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
  const title = destinations.find((item) => item.view === view)!;
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
  const [persistedSearchIds, setPersistedSearchIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (!workspace?.workspaceId || projects.length === 0) {
      setPersistedSearchIds(null);
      return undefined;
    }
    let cancelled = false;
    const rebuilt = getDesktopApi().rebuildSearchIndex?.(workspace.workspaceId, searchRecords) ?? Promise.resolve(true);
    void rebuilt.then(() => getDesktopApi().searchProjects?.({ workspaceId: workspace.workspaceId, query }) ?? null).then((results) => {
      if (!cancelled && results) setPersistedSearchIds(results.map((item) => item.projectId));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [projects, query, workspace?.workspaceId]);
  const visibleProjectIds = new Set((persistedSearchIds ?? searchIndex(indexedProjects, { workspaceId: workspace?.workspaceId ?? 'preview', query }).map((item) => item.projectId)));
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
  const createProjectFromHome = async (request: HomeConversationRequest): Promise<boolean> => {
    if (!workspace || workspace.openMode !== 'writable' || !conversationConnected) return false;
    setHomeCreationBusy(true);
    const initiatingWorkspaceId = workspace.workspaceId;
    const selectedDesigner = request.designerId
      ? designerOptions.find((profile) => profile.id === request.designerId && profile.status !== 'archived')
      : undefined;
    const name = createAutomaticProjectName(locale, projects.map((project) => project.name));
    try {
      const created = await getDesktopApi().createProjectContainer?.({
        workspaceId: workspace.workspaceId,
        operationId: crypto.randomUUID(),
        name,
        ...(selectedDesigner ? {
          activeDesignerVersionId: selectedDesigner.id,
          designerSnapshot: structuredClone(selectedDesigner),
        } : {}),
        designs: [],
      });
      if (!created) {
        setHomeCreationBusy(false);
        notify(t(locale, '无法创建项目，请重试。', 'Could not create the project. Try again.'));
        return false;
      }
      if (activeWorkspaceRef.current?.workspaceId !== initiatingWorkspaceId) {
        setHomeCreationBusy(false);
        return false;
      }
      const project: Project = {
        id: created.projectId,
        workspaceId: workspace.workspaceId,
        name,
        enName: name,
        description: '',
        enDescription: '',
        designers: selectedDesigner ? [localize(locale, selectedDesigner.name)] : [],
        ...(selectedDesigner ? {
          activeDesignerVersionId: selectedDesigner.id,
          designerSnapshot: structuredClone(selectedDesigner),
        } : {}),
        artwork: 'blank',
        designs: [],
        documents: 0,
        documentEntries: [],
        updatedAt: new Date().toISOString(),
      };
      setProjects((current) => [project, ...current]);
      setSelected(project);
      setDocumentOpen(false);
      setView('projects');
      setSurface('projects');
      void submitProjectConversation(project, request.message, request.attachments);
      return true;
    } catch {
      setHomeCreationBusy(false);
      notify(t(locale, '无法创建项目，请重试。', 'Could not create the project. Try again.'));
      return false;
    }
  };
  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    if (workspace?.openMode === 'writable') {
      const selectedDesigner = designerOptions.find((profile) => profile.id === draft.personaId);
      const submittedCover = draft.cover;
      const created = await getDesktopApi().createProjectContainer?.({
        workspaceId: workspace.workspaceId,
        operationId: crypto.randomUUID(),
        name: draft.name.trim(),
        brief: draft.goal || undefined,
        ...(selectedDesigner ? { activeDesignerVersionId: selectedDesigner.id, designerSnapshot: structuredClone(selectedDesigner) } : {}),
        designs: [],
      });
      if (!created) {
        notify(t(locale, '无法保存项目，请检查工作区。', 'Could not save the project. Check the workspace.'));
        return;
      }
      let coverAssetId: string | undefined;
      let coverSaveFailed = false;
      if (submittedCover) {
        try {
          const results = await getDesktopApi().importAssets?.({
            workspaceId: workspace.workspaceId,
            projectId: created.projectId,
            items: [{
              name: submittedCover.name,
              mimeType: submittedCover.mimeType,
              data: submittedCover.bytes,
              metadata: { purpose: 'project-cover' },
            }],
          });
          const imported = results?.find((result) => result.status === 'success');
          if (!imported) throw new Error('PROJECT_COVER_IMPORT_FAILED');
          const metadata = await getDesktopApi().updateProjectMetadata?.({
            workspaceId: workspace.workspaceId,
            projectId: created.projectId,
            patch: { coverAssetId: imported.asset.id },
          });
          if (!metadata?.coverAssetId) throw new Error('PROJECT_COVER_UPDATE_FAILED');
          coverAssetId = metadata.coverAssetId;
        } catch {
          coverSaveFailed = true;
        }
      }
      const project: Project = {
        id: created.projectId,
        workspaceId: workspace.workspaceId,
        name: draft.name.trim(),
        enName: draft.name.trim(),
        description: draft.goal,
        enDescription: draft.goal,
        designers: selectedDesigner ? [localize(locale, selectedDesigner.name)] : [],
        ...(selectedDesigner ? { activeDesignerVersionId: selectedDesigner.id, designerSnapshot: structuredClone(selectedDesigner) } : {}),
        ...(coverAssetId ? { coverAssetId } : {}),
        artwork: 'blank',
        designs: [],
        documents: 0,
        documentEntries: [],
      };
      setProjects((previous) => [project, ...previous]);
      setNewProjectDrawerOpen(false);
      setSurface('projects');
      setSelected(project);
      setView('projects');
      setQuery('');
      setFilter('active');
      if (submittedCover?.previewUrl) URL.revokeObjectURL(submittedCover.previewUrl);
      setDraft({ name: '', goal: '', brief: '', personaId: '', size: '1080 × 1440', mode: 'manual' });
      notify(coverSaveFailed
        ? t(locale, '项目已创建，但封面保存失败，已使用默认封面。', 'Project created, but the cover could not be saved. The default cover is being used.')
        : t(locale, '项目已保存到本地工作区。', 'Project saved to the local workspace.'));
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
        draft.goal ||
        t(locale, '本次预览中的项目草稿', 'A project draft for this preview'),
      enDescription: draft.goal || 'A project draft for this preview',
      designers: designerOptions.find((profile) => profile.id === draft.personaId) ? [localize(locale, designerOptions.find((profile) => profile.id === draft.personaId)!.name)] : [],
      ...(draft.cover?.previewUrl ? { coverPreviewUrl: draft.cover.previewUrl } : {}),
      artwork: 'blank',
      designs: [],
      documents: 0,
      documentEntries: [],
    };
    if (draft.cover?.previewUrl) previewCoverUrls.current.add(draft.cover.previewUrl);
    setProjects((previous) => [project, ...previous]);
    setNewProjectDrawerOpen(false);
    setSurface('projects');
    setSelected(project);
    setView('projects');
    setQuery('');
    setFilter('active');
    setDraft({
      name: '',
      goal: '',
      brief: '',
      personaId: '',
      size: '1080 × 1440',
      mode: 'manual',
    });
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
  const submitProjectConversation = async (project: Project, message: string, attachments: import('../../features/agent/task-service').ConversationImageAttachment[] = [], context: { analysisThreadId?: string; conversationParentTaskId?: string; referencedAssetIds?: string[] } = {}): Promise<import('../../features/tasks/state').TaskRecord | null> => {
    if (!workspace || workspace.openMode !== 'writable' || !project.workspaceId) {
      notify(t(locale, '请先打开可写工作区。', 'Open a writable workspace first.'));
      return null;
    }
    try {
      const task = await getDesktopApi().submitConversation?.({
        workspaceId: workspace.workspaceId,
        projectId: project.id,
        connectionId: 'openai-compatible',
        message,
        ...context,
        ...(attachments.length ? { attachments } : {}),
      });
      if (!task) {
        notify(t(locale, '模型连接不可用，任务未提交。', 'Model connection unavailable; task was not submitted.'));
        return null;
      }
      notify(t(locale, '任务已排队。', 'Task queued.'));
      return task;
    } catch {
      notify(t(locale, '任务提交失败，请检查连接。', 'Task submission failed. Check the connection.'));
      return null;
    }
  };
  const submitProjectDesignGeneration = async (project: Project, conversationTaskId: string, baseRevisionId: string | null = null): Promise<import('../../features/tasks/state').TaskRecord | null> => {
    if (!workspace || workspace.openMode !== 'writable' || !project.workspaceId) {
      notify(t(locale, '请先打开可写工作区。', 'Open a writable workspace first.'));
      return null;
    }
    try {
      const task = await getDesktopApi().submitDesignGeneration?.({
        workspaceId: workspace.workspaceId,
        projectId: project.id,
        conversationTaskId,
        baseRevisionId,
        connectionId: 'openai-compatible',
      });
      if (!task) {
        notify(t(locale, '模型连接不可用，任务未提交。', 'Model connection unavailable; task was not submitted.'));
        return null;
      }
      notify(t(locale, '设计稿生成任务已排队。', 'Design draft generation queued.'));
      return task;
    } catch {
      notify(t(locale, '设计稿生成失败，请重试。', 'Design draft generation failed; try again.'));
      return null;
    }
  };
  const submitProjectImageTask = async (project: Project, input: { tool: ImageTool; prompt: string; params: ToolParams; baseRevisionId: string | null; region?: { x: number; y: number; width: number; height: number } }): Promise<void> => {
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
      const task = await api.submitImageEdit?.({ workspaceId: workspace.workspaceId, projectId: project.id, documentId, baseRevisionId: input.baseRevisionId, designerVersionId: project.activeDesignerVersionId, connectionId: 'openai-compatible', prompt: input.prompt, image: new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], { type: 'image/png' }), sourceAssetId: imageLayer.assetId, tool: input.tool, toolParams: input.params, ...(input.region ? { region: input.region } : {}) });
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
      const api = getDesktopApi();
      const providerConfigs = await (api.loadProviderConfigs?.() ?? Promise.resolve(null)).catch(() => null);
      const count = providerConfigs?.['openai-compatible']?.image?.imageTransport === 'responses' ? 1 : 2;
      const task = await api.submitImageGeneration?.({ workspaceId: workspace.workspaceId, projectId: project.id, documentId, baseRevisionId, designerVersionId: project.activeDesignerVersionId, connectionId: 'openai-compatible', prompt, size: `${project.documentEntries?.find((entry) => entry.id === documentId)?.width ?? 1080}x${project.documentEntries?.find((entry) => entry.id === documentId)?.height ?? 1440}`, count });
      if (!task) {
        notify(t(locale, '模型连接不可用，任务未提交。', 'Model connection unavailable; task was not submitted.'));
        return;
      }
      notify(t(locale, '生成任务已排队。', 'Generation task queued.'));
    } catch {
      notify(t(locale, '生成任务提交失败，请检查连接。', 'Generation task submission failed. Check the connection.'));
    }
  };
  const openNewDesign = (personaId?: string) => {
    setDraft((previous) => ({
      ...previous,
      mode: 'manual',
      personaId: personaId ?? previous.personaId,
    }));
    setNewProjectDrawerOpen(true);
  };
  const breadcrumbTitle =
    selected
      ? projectName(selected)
      : t(locale, title.zh, title.en);
  const toolbarActions =
    surface === 'projects' && view === 'projects' && !documentOpen && selected ? (
      <>
        {workspace?.openMode === 'writable' && selected.workspaceId && <>
          <IconButton name="settings" label={t(locale, '重命名', 'Rename')} onClick={() => { setProjectNameDraft(selected.name); setProjectDialog('rename'); }} />
          <IconButton name="copy" label={t(locale, '复制', 'Duplicate')} onClick={() => { void duplicateSelected(); }} />
          {!selected.archived && <IconButton name="folder" label={t(locale, '归档', 'Archive')} onClick={() => { void updateProject({ archived: true }); }} />}
        </>}
      </>
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
        themeLabel={t(locale, '切换主题', 'Switch theme')}
        workspace={{
          name: workspace?.name ?? t(locale, '我的设计空间', 'My design studio'),
          detail: workspace
            ? workspace.openMode === 'read-only'
              ? t(locale, '只读工作区', 'Read-only workspace')
              : t(locale, '本地工作区', 'Local workspace')
            : t(locale, '未打开工作区', 'No workspace open'),
          label: t(locale, '切换工作区', 'Switch workspace'),
          disabled: homeCreationBusy,
          onClick: () => setDialog('workspace'),
        }}
        userMenu={(
          <StudioUserMenu
            locale={locale}
            operatorName={operatorName}
            currentView={view}
            onNavigate={navigate}
            onNewProject={() => openNewDesign()}
            onImportProject={() => { void importProjectPackage(); }}
            newProjectDisabled={workspace?.openMode === 'read-only'}
            importDisabled={workspace?.openMode !== 'writable'}
          />
        )}
      />
      <div className="studio">
        <div className="studio-main" data-drawer-host>
        <PageToolbarProvider>
        {!(surface === 'projects' && view === 'projects') ? <header
          className="studio-toolbar"
          aria-label={t(locale, '工作区工具栏', 'Workspace toolbar')}
        >
          <div className="toolbar-location">
            <span className="toolbar-workspace">
              {workspace?.name ?? t(locale, '我的设计空间', 'My design studio')}
            </span>
            <Icon name="chevron-right" size={14} />
            <span className="breadcrumb-current">
              {breadcrumbTitle}
            </span>
          </div>
          <PageToolbarHost>{toolbarActions}</PageToolbarHost>
        </header> : null}
        <div className="studio-body">
          {surface === 'projects' && view === 'projects' && !selected && (
            <StudioHome
              workspaceId={workspace?.workspaceId}
              locale={locale}
              projects={projects}
              visibleProjects={visibleProjects}
              profiles={designerOptions}
              filter={filter}
              query={query}
              loadFailed={projectsLoadFailed}
              readOnly={workspace?.openMode !== 'writable'}
              conversationConnected={conversationConnected}
              onFilterChange={setFilter}
              onQueryChange={setQuery}
              onOpenProject={openProject}
              onRetry={() => setProjectsReloadKey((key) => key + 1)}
              onViewAllDesigners={() => navigate('designers')}
              onNewProject={() => openNewDesign()}
              onSubmit={createProjectFromHome}
              notify={notify}
            />
          )}
          {surface === 'projects' && view === 'projects' && selected && !documentOpen && (
            <ProjectCanvas
              locale={locale}
              project={selected}
              workspaceId={workspace?.workspaceId}
              readOnly={workspace?.openMode !== 'writable'}
              conversationConnected={conversationConnected}
              designer={designerOptions.find((profile) => profile.id === selected.activeDesignerVersionId) ?? null}
              notify={notify}
              onBack={() => setSelected(null)}
              onRename={() => { setProjectNameDraft(selected.name); setProjectDialog('rename'); }}
              onDuplicate={() => { void duplicateSelected(); }}
              onArchive={() => { void updateProject({ archived: true }); setSelected(null); }}
              onConnections={() => navigate('connections')}
              onSubmitConversation={(message, attachments, context) => submitProjectConversation(selected, message, attachments, context)}
              onSubmitDesignGeneration={(conversationTaskId) => submitProjectDesignGeneration(selected, conversationTaskId, null)}
            />
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
                onConnections={() => navigate('connections')}
                onTasks={() => navigate('tasks')}
                onSubmitConversation={(message, attachments, context) => submitProjectConversation(project, message, attachments, context)}
                onSubmitDesignGeneration={(conversationTaskId, baseRevisionId) => submitProjectDesignGeneration(project, conversationTaskId, baseRevisionId)}
                onSubmitImageTask={(input) => submitProjectImageTask(project, input)}
                onSubmitImageGeneration={(prompt, baseRevisionId) => submitProjectImageGeneration(project, prompt, baseRevisionId)}
                assetAction={project.id === selected?.id ? pendingAssetAction ?? undefined : undefined}
                onAssetActionHandled={(actionId) => setPendingAssetAction((current) => current?.id === actionId ? null : current)}
                operatorName={operatorName}
                modelConnected={conversationConnected}
                readOnly={workspace?.openMode === 'read-only'}
                notify={notify}
                initialConversation={pendingHomeConversation?.projectId === project.id ? pendingHomeConversation : undefined}
                onInitialConversationConsumed={(id) => {
                  setPendingHomeConversation((current) => current?.id === id ? null : current);
                  setHomeCreationBusy(false);
                }}
              />
            </div>
          ))}
          {destinations
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
                  onUseForNew={(personaId) => openNewDesign(personaId)}
                  onAssetAction={routeAssetAction}
                  theme={theme}
                  onThemeChange={onThemeChange}
                  onLocaleChange={onLocaleChange}
                  onWorkspaceChange={onWorkspaceChange}
                  operatorName={operatorName}
                  onOperatorNameChange={updateOperatorName}
                  initialAssets={initialAssets}
                  initialBrands={initialBrands}
                  initialProfiles={initialDesignerOptions}
                  active={surface === item.view && view === item.view}
                />
              </div>
            ))}
        </div>
        </PageToolbarProvider>
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
      <Drawer
        open={newProjectDrawerOpen}
        title={t(locale, '新建项目', 'New project')}
        locale={locale}
        initialFocusSelector="[data-drawer-initial-focus]"
        onClose={() => setNewProjectDrawerOpen(false)}
        footer={(
          <div className="dialog-actions">
            <Button onClick={() => setNewProjectDrawerOpen(false)}>{t(locale, '取消', 'Cancel')}</Button>
            <Button
              type="submit"
              form="new-project-form"
              variant="primary"
              icon="plus"
              disabled={!draft.name.trim()}
            >
              {workspace?.openMode === 'writable' ? t(locale, '创建项目', 'Create project') : t(locale, '创建预览', 'Create preview')}
            </Button>
          </div>
        )}
      >
        <NewProjectForm
          locale={locale}
          formId="new-project-form"
          draft={draft}
          onDraftChange={setDraft}
          onCreate={createProject}
          profiles={designerOptions}
          persisted={workspace?.openMode === 'writable'}
        />
      </Drawer>
      {dialog === 'workspace' && (
        <Modal
          title={t(locale, '切换工作区', 'Switch workspace')}
          onClose={() => setDialog(null)}
          locale={locale}
        >
          {workspace?.openMode === 'read-only' && <p className="muted">
            {t(locale, '当前工作区为只读模式。', 'This workspace is read-only.')}
          </p>}
          <button className="workspace-choice" onClick={() => setDialog(null)}>
            <span className="workspace-monogram">{workspace?.name.slice(0, 1).toUpperCase() ?? 'D'}</span>
            <span>
              <strong>{workspace?.name ?? t(locale, '我的设计空间', 'My design studio')}</strong>
              <small>
                {workspace
                  ? workspace.openMode === 'read-only'
                    ? t(locale, '只读工作区 · 当前', 'Read-only workspace · Current')
                    : t(locale, '本地工作区 · 当前', 'Local workspace · Current')
                  : t(locale, '未打开工作区', 'No workspace open')}
              </small>
            </span>
            <Icon name="check" />
          </button>
          {recentWorkspaces.length > 0 && (
            <div className="workspace-recent-list" aria-label={t(locale, '最近访问', 'Recently opened')}>
              <p className="panel-label">{t(locale, '最近访问', 'Recently opened')}</p>
              {recentWorkspaces
                .filter((entry) => entry.workspaceId !== workspace?.workspaceId)
                .map((entry) => (
                  <button
                    type="button"
                    className="workspace-choice workspace-choice--recent"
                    key={`${entry.workspaceId}:${entry.directory}`}
                    onClick={() => {
                      if (!onOpenWorkspace) return;
                      setDialog(null);
                      void onOpenWorkspace(entry.directory).then((opened) => {
                        if (!opened) setDialog('workspace');
                      });
                    }}
                  >
                    <span className="workspace-monogram">{entry.name.slice(0, 1).toUpperCase()}</span>
                    <span>
                      <strong>{entry.name}</strong>
                      <small>{entry.directory}</small>
                    </span>
                    <Icon name="arrow-up-right" size={15} />
                  </button>
                ))}
            </div>
          )}
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
    </>
  );
};
