import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getMessages, type Locale } from '../i18n';
import { WindowBar } from '../shell/WindowBar';
import { LibraryPages } from './LibraryPages';
import { NewProjectForm } from './NewDesignPage';
import { Drawer } from './Drawer';
import { PageToolbarHost, PageToolbarProvider } from './PageToolbar';
import { ProjectCanvas } from './ProjectCanvas';
import { ProjectDetailPage } from './ProjectDetailPage';
import { StudioHome } from './StudioHome';
import { StudioUserMenu } from './StudioUserMenu';
import { DesignerLibrary } from './DesignerLibrary';
import { createAutomaticProjectName } from './auto-project-name';
import { localize, type PersonaProfile } from './personas';
import { legacySeededDesignerIds } from '../../features/designers/persistence';
import type { CanvasAssetAction } from '../../features/canvas/CanvasWorkspace';
import type { ProjectLibraryDescriptor } from '../../features/project-library/open-project-library';
import type { AppProfile } from '../../features/profile/model';
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
import type { ProjectDesign, ProjectMetadata, ProjectMetadataPatch } from '../../features/projects/metadata';
import type { ImageTool, ToolParams } from '../../features/image-tools/target';
import { createCompositionEntryCandidate, createMockupEntryCandidate } from '../../features/composition/studio-entry';
import type { DesignSceneCandidate } from '../../features/composition/design-scene-candidate';
import { builtInMockupTemplates, validateMockupRenderInput } from '../../features/mockups/template';
import { selectConfiguredConnection } from '../../features/providers/connection';
import { getProviderProfileStatus } from '../../features/providers/status';
import type { ProviderConfigMap } from '../../features/providers/config';
import { rasterizeMask } from '../../features/image-tools/mask-rasterizer';
import { buildSearchIndex, searchIndex } from '../../features/library/indexer';
import '../styles/studio.css';
import { Workbench } from './Workbench';

const navigation: { view: View; icon: string; zh: string; en: string }[] = [
  { view: 'projects', icon: 'layout-grid', zh: '项目库', en: 'Projects' },
  { view: 'assets', icon: 'image', zh: '素材库', en: 'Assets' },
  { view: 'brands', icon: 'palette', zh: '品牌包', en: 'Brand kits' },
  { view: 'connections', icon: 'plug', zh: '模型连接', en: 'Connections' },
  { view: 'tasks', icon: 'clock', zh: '模型任务', en: 'Model tasks' },
  { view: 'image-tool-remove-background', icon: 'wand-sparkles', zh: '去除背景', en: 'Remove background' },
  { view: 'image-tool-upscale', icon: 'image', zh: '放大图像', en: 'Upscale image' },
  { view: 'image-tool-resize', icon: 'maximize-2', zh: '尺寸转换', en: 'Resize' },
  { view: 'image-tool-format-convert', icon: 'file-image', zh: '格式转换', en: 'Format conversion' },
  { view: 'delivery', icon: 'download', zh: '导出交付', en: 'Delivery' },
  { view: 'storage', icon: 'hard-drive', zh: '废纸篓与备份', en: 'Trash & backups' },
];

const destinations: { view: View; icon: string; zh: string; en: string }[] = [
  ...navigation,
  { view: 'image-tools', icon: 'wand-sparkles', zh: '图像工具', en: 'Image tools' },
  { view: 'settings', icon: 'settings', zh: '设置', en: 'Settings' },
];
const viewOrder = destinations.map(({ view }) => view);

const emptyProjects: Project[] = [];
const emptyDesignerOptions: PersonaProfile[] = [];
const emptyAssets: NonNullable<Parameters<typeof LibraryPages>[0]['initialAssets']> = [];
const emptyBrands: NonNullable<Parameters<typeof LibraryPages>[0]['initialBrands']> = [];

const fileBytes = async (file: File): Promise<Uint8Array> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
  reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
  reader.readAsArrayBuffer(file);
});

const readOperatorName = (): string => {
  try { return localStorage.getItem('designhub.operator.name') ?? ''; } catch { return ''; }
};

const toStudioProject = (entry: ActiveProject, libraryId: string): Project => {
  const snapshot = entry.designerSnapshot as { name?: { zh?: string; en?: string } } | undefined;
  const primaryDesigner = snapshot?.name?.zh ?? snapshot?.name?.en;
  const documentEntries = entry.documents?.map(({ id, name, width, height, sourceDocumentId, sourceRevisionId, finalizedRevisionId }) => ({ id, name, width, height, sourceDocumentId, sourceRevisionId, finalizedRevisionId }));
  return {
    id: entry.projectId,
    libraryId,
    documentId: entry.documents?.[0]?.id,
    name: entry.name,
    enName: entry.name,
    generationRatio: entry.generationRatio ?? '3:4',
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
  generationRatio: metadata.generationRatio ?? current.generationRatio ?? '3:4',
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
  profile?: Pick<AppProfile, 'displayName' | 'avatarDataUrl'> | null;
  library?: ProjectLibraryDescriptor | null;
  onLocaleChange: (locale: Locale) => void;
  onThemeChange: (theme: Theme) => void;
  onExit?: () => void;
  initialProjects?: Project[];
  initialDesignerOptions?: PersonaProfile[];
  initialAssets?: Parameters<typeof LibraryPages>[0]['initialAssets'];
  initialBrands?: Parameters<typeof LibraryPages>[0]['initialBrands'];
};

export const Studio = ({
  locale,
  theme,
  library: workspace = null,
  profile = null,
  onLocaleChange,
  onThemeChange,
  initialProjects = emptyProjects,
  initialDesignerOptions = emptyDesignerOptions,
  initialAssets = emptyAssets,
  initialBrands = emptyBrands,
}: StudioProps) => {
  const [view, setView] = useState<View>('projects');
  const [surface, setSurface] = useState<StudioSurface>('projects');
  const [transitionDirection, setTransitionDirection] = useState<'forward' | 'backward'>('forward');
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [projectsLoadFailed, setProjectsLoadFailed] = useState(false);
  const [projectsReloadKey, setProjectsReloadKey] = useState(0);
  const [, setHomeCreationBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [selected, setSelected] = useState<Project | null>(null);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [openToolsRequest, setOpenToolsRequest] = useState(0);
  const [deliveryProject] = useState<Project | null>(null);
  const [connectionsDialogOpen, setConnectionsDialogOpen] = useState(false);
  const [providerRefreshKey, setProviderRefreshKey] = useState(0);
  const [designerCreateRequestId, setDesignerCreateRequestId] = useState(0);
  const [notice, setNotice] = useState('');
  const [newProjectDrawerOpen, setNewProjectDrawerOpen] = useState(false);
  const [entryCandidate, setEntryCandidate] = useState<{ projectId: string; candidate: DesignSceneCandidate } | null>(null);
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
  const [conversationConnectionId, setConversationConnectionId] = useState<string | null>(null);
  const [imageConnectionId, setImageConnectionId] = useState<string | null>(null);
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfigMap | null>(null);
  const [pendingHomeConversation, setPendingHomeConversation] = useState<PendingHomeConversation | null>(null);
  const [operatorName, setOperatorName] = useState(() => profile?.displayName ?? readOperatorName());
  useEffect(() => {
    if (profile?.displayName !== undefined) setOperatorName(profile.displayName);
  }, [profile?.displayName]);
  const [pendingAssetAction, setPendingAssetAction] = useState<(CanvasAssetAction & { projectId?: string }) | null>(null);
  useEffect(() => () => {
    previewCoverUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewCoverUrls.current.clear();
  }, []);
  const updateOperatorName = (value: string): void => {
    const next = value.slice(0, 80);
    setOperatorName(next);
    void getDesktopApi().saveProfile?.({ displayName: next });
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
      const request = getDesktopApi().listActiveProjects?.(workspace.libraryId);
      if (!request) {
        setProjects([]);
        setProjectsLoadFailed(true);
      }
      void request?.then((entries) => {
        if (cancelled) return;
        if (!entries) { setProjects([]); setProjectsLoadFailed(true); return; }
        setProjectsLoadFailed(false);
        setProjects(entries.map((entry) => toStudioProject(entry, workspace.libraryId)));
      }).catch(() => { if (!cancelled) { setProjects([]); setProjectsLoadFailed(true); } });
    }
    setSelected(null);
    setDocumentOpen(false);
    setActiveDocumentId(null);
    setPendingHomeConversation(null);
    setNewProjectDrawerOpen(false);
    setView('projects');
    setSurface('projects');
    setTransitionDirection('forward');
    return () => { cancelled = true; };
  }, [initialDesignerOptions, initialProjects, workspace?.libraryId, locale, projectsReloadKey]);
  useEffect(() => {
    let cancelled = false;
    if (!workspace) {
      setConversationConnected(false);
      setConversationConnectionId(null);
      setImageConnectionId(null);
      setProviderConfigs(null);
      return () => { cancelled = true; };
    }
    const api = getDesktopApi();
    const configsRequest = api.loadProviderConfigs?.() ?? Promise.resolve(null);
    const credentialRequest = Promise.all([
      api.hasCredential?.('openai-compatible:conversation') ?? Promise.resolve(false),
      api.hasCredential?.('openai-compatible:image') ?? Promise.resolve(false),
    ]);
    const statusRequest = api.loadProviderConnectionStatuses?.() ?? Promise.resolve(null);
    void Promise.all([configsRequest, credentialRequest, statusRequest]).then(([configs, [conversationCredential, imageCredential], statuses]) => {
      if (cancelled) return;
      const normalizedConfigs = configs ?? {};
      const statusAware = Boolean(api.loadProviderConnectionStatuses);
      const conversationHealthy = !statusAware || getProviderProfileStatus(statuses, 'openai-compatible', 'conversation', normalizedConfigs) === 'connected';
      const nextConversationId = conversationCredential && conversationHealthy
        ? selectConfiguredConnection('conversation', normalizedConfigs, ['openai-compatible:conversation'])
        : null;
      const nextImageId = imageCredential
        ? selectConfiguredConnection('image-editing', normalizedConfigs, ['openai-compatible:image'])
        : null;
      setProviderConfigs(configs);
      setConversationConnectionId(nextConversationId);
      setImageConnectionId(nextImageId);
      setConversationConnected(Boolean(nextConversationId));
    }).catch(() => {
      if (cancelled) return;
      setProviderConfigs(null);
      setConversationConnectionId(null);
      setImageConnectionId(null);
      setConversationConnected(false);
    });
    return () => { cancelled = true; };
  }, [providerRefreshKey, workspace?.libraryId]);
  useEffect(() => {
    let cancelled = false;
    if (!workspace) { setDesignerOptions(initialDesignerOptions); return () => { cancelled = true; }; }
    const request = getDesktopApi().loadDesignerState?.(workspace.libraryId);
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
    if (next === 'designers') {
      setDesignerCreateRequestId((current) => current + 1);
      return;
    }
    if (next === 'connections') {
      setConnectionsDialogOpen(true);
      return;
    }
    const currentIndex = viewOrder.indexOf(view);
    const nextIndex = viewOrder.indexOf(next);
    setTransitionDirection(nextIndex >= currentIndex ? 'forward' : 'backward');
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
    setTransitionDirection('forward');
    setSurface('projects');
    setView('projects');
    notify(t(locale, input.mode === 'replace' ? '已准备替换图像' : input.mode === 'reference' ? '已准备参考图层' : '已准备放入画布', input.mode === 'replace' ? 'Ready to replace the selected image' : input.mode === 'reference' ? 'Ready to add a reference layer' : 'Ready to place on canvas'));
  };
  const notify = (message: string) => setNotice(message);
  const updateProject = async (patch: ProjectMetadataPatch): Promise<ProjectMetadata | null> => {
    if (!workspace || !selected || workspace.openMode !== 'writable') return null;
    try {
      const metadata = await getDesktopApi().updateProjectMetadata?.({ libraryId: workspace.libraryId, projectId: selected.id, patch });
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
      const result = await getDesktopApi().duplicateProject?.({ libraryId: workspace.libraryId, sourceProjectId: selected.id, operationId: crypto.randomUUID() });
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
      const result = await getDesktopApi().importProjectPackage?.({ libraryId: workspace.libraryId });
      if (!result) return;
      const entries = await getDesktopApi().listActiveProjects?.(workspace.libraryId);
      if (entries) {
        setProjects(entries.map((entry) => toStudioProject(entry, workspace.libraryId)));
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
      libraryId: project.libraryId ?? 'preview',
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
    if (!workspace?.libraryId || projects.length === 0) {
      setPersistedSearchIds(null);
      return undefined;
    }
    let cancelled = false;
    const rebuilt = getDesktopApi().rebuildSearchIndex?.(workspace.libraryId, searchRecords) ?? Promise.resolve(true);
    void rebuilt.then(() => getDesktopApi().searchProjects?.({ libraryId: workspace.libraryId, query }) ?? null).then((results) => {
      if (!cancelled && results) setPersistedSearchIds(results.map((item) => item.projectId));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [projects, query, workspace?.libraryId]);
  const visibleProjectIds = new Set((persistedSearchIds ?? searchIndex(indexedProjects, { libraryId: workspace?.libraryId ?? 'preview', query }).map((item) => item.projectId)));
  const visibleProjects = projects.filter((project) =>
    (filter === 'all' || Boolean(project.archived) === (filter === 'archived')) && visibleProjectIds.has(project.id),
  );
  const openProject = (project: Project) => {
    setSelected(project);
    setTransitionDirection('forward');
    setSurface('projects');
    setDocumentOpen(false);
    setActiveDocumentId(null);
    setView('projects');
  };
  const openCanvasImageTools = (): void => {
    const project = (selected && (selected.documentEntries?.length || selected.documentId) ? selected : undefined)
      ?? projects.find((entry) => Boolean(entry.documentEntries?.length || entry.documentId))
      ?? selected
      ?? projects[0];
    const documentId = project?.documentEntries?.[0]?.id ?? project?.documentId;
    if (!project || !documentId) {
      notify(t(locale, '请先创建包含文档的项目', 'Create a project with a document first'));
      return;
    }
    setSelected(project);
    setActiveDocumentId(documentId);
    setDocumentOpen(true);
    setSurface('projects');
    setView('projects');
    setTransitionDirection('forward');
    setOpenToolsRequest((current) => current + 1);
  };
  const createProjectFromHome = async (request: HomeConversationRequest, submitConversation = true): Promise<boolean> => {
    if (!workspace || workspace.openMode !== 'writable' || (submitConversation && !conversationConnected)) return false;
    setHomeCreationBusy(true);
    const initiatingWorkspaceId = workspace.libraryId;
    const selectedDesigner = request.designerId
      ? designerOptions.find((profile) => profile.id === request.designerId && profile.status !== 'archived')
      : undefined;
    const name = createAutomaticProjectName(locale, projects.map((project) => project.name));
    try {
      const created = await getDesktopApi().createProjectContainer?.({
        libraryId: workspace.libraryId,
        operationId: crypto.randomUUID(),
        name,
        generationRatio: request.generationRatio,
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
      if (activeWorkspaceRef.current?.libraryId !== initiatingWorkspaceId) {
        setHomeCreationBusy(false);
        return false;
      }
      const project: Project = {
        id: created.projectId,
        libraryId: workspace.libraryId,
        name,
        enName: name,
        generationRatio: request.generationRatio,
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
      setTransitionDirection('forward');
      setDocumentOpen(false);
      setView('projects');
      setSurface('projects');
      if (submitConversation) void submitProjectConversation(project, request.message, request.attachments);
      else setHomeCreationBusy(false);
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
    const entryMode = draft.mode;
    if (entryMode !== 'manual' && workspace?.openMode !== 'writable') {
      notify(t(locale, '请先打开可写工作区以导入候选素材。', 'Open a writable workspace to import candidate assets.'));
      return;
    }
    const entryFiles = entryMode === 'composition'
      ? ([['core', draft.coreFile], ['optional', draft.optionalFile], ['reference', draft.referenceFile]] as const).filter((item): item is readonly [typeof item[0], File] => Boolean(item[1]))
      : entryMode === 'mockup' && draft.mockupFile ? [['core', draft.mockupFile] as const] : [];
    if (entryMode !== 'manual' && (entryFiles.length === 0 || (entryMode === 'composition' && !draft.coreFile))) {
      notify(t(locale, '请先选择核心素材。', 'Choose a core asset first.'));
      return;
    }
    let sourceSize: { width: number; height: number } | null = null;
    const template = builtInMockupTemplates.find((item) => item.id === (draft.templateId ?? builtInMockupTemplates[0]!.id));
    const templateColor = draft.templateColor ?? template?.colors[0] ?? '';
    if (entryMode === 'mockup') {
      try {
        const bitmap = await createImageBitmap(draft.mockupFile!);
        sourceSize = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
      } catch {
        notify(t(locale, '无法读取源设计图尺寸。', 'Could not read source artwork dimensions.'));
        return;
      }
      const valid = validateMockupRenderInput({ templateId: template?.id ?? '', sourceWidth: sourceSize.width, sourceHeight: sourceSize.height, color: templateColor });
      if (!valid.ok) {
        notify(valid.reason === 'SOURCE_TOO_SMALL' ? t(locale, '源设计图尺寸小于模板要求。', 'Source artwork is smaller than the template requires.') : t(locale, '样机模板或颜色无效。', 'Invalid mockup template or color.'));
        return;
      }
    }
    if (workspace?.openMode === 'writable') {
      const selectedDesigner = designerOptions.find((profile) => profile.id === draft.personaId);
      const submittedCover = draft.cover;
      const documentId = entryMode === 'manual' ? null : `document-${crypto.randomUUID()}`;
      const [width, height] = entryMode === 'mockup' && template
        ? [template.output.width, template.output.height]
        : draft.size.split(' × ').map(Number);
      const created = await getDesktopApi().createProjectContainer?.({
        libraryId: workspace.libraryId,
        operationId: crypto.randomUUID(),
        name: draft.name.trim(),
        brief: draft.goal || undefined,
        ...(selectedDesigner ? { activeDesignerVersionId: selectedDesigner.id, designerSnapshot: structuredClone(selectedDesigner) } : {}),
        designs: [],
        ...(documentId ? { documents: [{ id: documentId, name: draft.name.trim(), width, height }] } : {}),
      });
      if (!created) {
        notify(t(locale, '无法保存项目，请检查工作区。', 'Could not save the project. Check the workspace.'));
        return;
      }
      let localCandidate: DesignSceneCandidate | null = null;
      if (documentId && entryFiles.length) {
        try {
          const items = await Promise.all(entryFiles.map(async ([role, file]) => ({ name: file.name, mimeType: file.type, data: await fileBytes(file), metadata: { purpose: 'studio-entry', role } })));
          const imported = await getDesktopApi().importAssets?.({ libraryId: workspace.libraryId, projectId: created.projectId, items });
          if (!imported || imported.length !== entryFiles.length || imported.some((result) => result.status !== 'success')) throw new Error('ASSET_IMPORT_FAILED');
          const assets = imported.map((result, index) => ({ assetId: result.status === 'success' ? result.asset.id : '', role: entryFiles[index]![0] }));
          const identity = { id: `candidate-${crypto.randomUUID()}`, sourceTaskId: `local-entry-${crypto.randomUUID()}`, createdAt: new Date().toISOString() };
          const result = entryMode === 'mockup'
            ? createMockupEntryCandidate({ ...identity, sourceAssetId: assets[0]!.assetId, sourceWidth: sourceSize!.width, sourceHeight: sourceSize!.height, templateId: template!.id, color: templateColor })
            : createCompositionEntryCandidate({ ...identity, width, height, assets });
          if (!result.ok) throw new Error(result.reason);
          localCandidate = result.candidate;
          const publishCandidate = getDesktopApi().publishCompositionCandidate;
          if (publishCandidate) {
            const published = await publishCandidate({
              libraryId: workspace.libraryId,
              projectId: created.projectId,
              documentId,
              candidate: localCandidate,
            });
            const persistedCandidate = published?.result?.compositionCandidate;
            if (!persistedCandidate) throw new Error('CANDIDATE_PERSIST_FAILED');
            localCandidate = persistedCandidate;
          }
        } catch {
          localCandidate = null;
          notify(t(locale, '项目已创建，但候选素材导入失败。', 'Project created, but candidate asset import failed.'));
        }
      }
      let coverAssetId: string | undefined;
      let coverSaveFailed = false;
      if (submittedCover) {
        try {
          const results = await getDesktopApi().importAssets?.({
            libraryId: workspace.libraryId,
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
            libraryId: workspace.libraryId,
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
        libraryId: workspace.libraryId,
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
        documentEntries: documentId ? [{ id: documentId, name: draft.name.trim(), width, height }] : [],
        ...(documentId ? { documentId } : {}),
      };
      if (documentId) project.documents = 1;
      setProjects((previous) => [project, ...previous]);
      setNewProjectDrawerOpen(false);
      setTransitionDirection('forward');
      setSurface('projects');
      setSelected(project);
      if (documentId && localCandidate) {
        setEntryCandidate({ projectId: project.id, candidate: localCandidate });
        setActiveDocumentId(documentId);
        setDocumentOpen(true);
      }
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
    setTransitionDirection('forward');
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
  const documentIdForProject = (project: Project): string | undefined => (
    project.id === selected?.id
      ? activeDocumentId ?? project.documentId ?? project.documentEntries?.[0]?.id
      : project.documentId ?? project.documentEntries?.[0]?.id
  );
  const submitProjectConversation = async (project: Project, message: string, attachments: import('../../features/agent/task-service').ConversationImageAttachment[] = [], context: { analysisThreadId?: string; conversationParentTaskId?: string; referencedAssetIds?: string[] } = {}): Promise<import('../../features/tasks/state').TaskRecord | null> => {
    if (!workspace || workspace.openMode !== 'writable' || !project.libraryId) {
      notify(t(locale, '请先打开可写工作区。', 'Open a writable workspace first.'));
      return null;
    }
    if (!conversationConnectionId) {
      notify(t(locale, '请先配置对话模型连接。', 'Configure a conversation model connection first.'));
      return null;
    }
    try {
      const task = await getDesktopApi().submitConversation?.({
        libraryId: workspace.libraryId,
        projectId: project.id,
        ...(documentIdForProject(project) ? { documentId: documentIdForProject(project) } : {}),
        connectionId: conversationConnectionId,
        ...(providerConfigs?.[conversationConnectionId as keyof ProviderConfigMap]?.conversation.models.conversation ? { model: providerConfigs[conversationConnectionId as keyof ProviderConfigMap]!.conversation.models.conversation } : {}),
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
  const submitProjectDesignGeneration = async (project: Project, conversationTaskId: string, baseRevisionId: string | null = null, generationRatio: Project['generationRatio'] = project.generationRatio ?? '3:4', count: 1 | 3 = 3, documentId?: string): Promise<import('../../features/tasks/state').TaskRecord | null> => {
    if (!workspace || workspace.openMode !== 'writable' || !project.libraryId) {
      notify(t(locale, '请先打开可写工作区。', 'Open a writable workspace first.'));
      return null;
    }
    if (!imageConnectionId) {
      notify(t(locale, '请先配置图片生成连接。', 'Configure an image generation connection first.'));
      return null;
    }
    try {
      const task = await getDesktopApi().submitDesignGeneration?.({
        libraryId: workspace.libraryId,
        projectId: project.id,
        ...(documentId ? { documentId } : {}),
        conversationTaskId,
        baseRevisionId,
        connectionId: imageConnectionId,
        ...(providerConfigs?.[imageConnectionId as keyof ProviderConfigMap]?.image.models['image-generation'] ? { model: providerConfigs[imageConnectionId as keyof ProviderConfigMap]!.image.models['image-generation'] } : {}),
        generationRatio,
        count,
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
  const submitProjectDesignBackgroundRemoval = async (project: Project, design: ProjectDesign): Promise<void> => {
    if (!workspace || workspace.openMode !== 'writable' || !project.libraryId) {
      notify(t(locale, '请先打开可写工作区。', 'Open a writable workspace first.'));
      return;
    }
    if (!imageConnectionId) {
      notify(t(locale, '请先配置图片编辑连接。', 'Configure an image editing connection first.'));
      return;
    }
    try {
      const api = getDesktopApi();
      const bytes = await api.readAsset?.({ libraryId: workspace.libraryId, projectId: project.id, assetId: design.assetId });
      if (!bytes) {
        notify(t(locale, '无法读取目标设计稿。', 'Could not read the selected design.'));
        return;
      }
      const documentId = project.documentId ?? project.documentEntries?.[0]?.id ?? design.id;
      const task = await api.submitImageEdit?.({
        libraryId: workspace.libraryId,
        projectId: project.id,
        documentId,
        baseRevisionId: null,
        designerVersionId: project.activeDesignerVersionId,
        connectionId: imageConnectionId,
        ...(providerConfigs?.[imageConnectionId as keyof ProviderConfigMap]?.image.models['image-editing'] ? { model: providerConfigs[imageConnectionId as keyof ProviderConfigMap]!.image.models['image-editing'] } : {}),
        prompt: t(locale, '去除图片背景，保留主体并生成干净边缘。', 'Remove the image background while preserving the subject with clean edges.'),
        image: new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], { type: 'image/png' }),
        sourceAssetId: design.assetId,
        tool: 'remove-background',
        toolParams: { edgeRefinement: 50 },
        size: `${design.width}x${design.height}`,
        projectDesign: {
          sourceTaskId: design.sourceTaskId,
          ...(design.sourceConversationTaskId ? { sourceConversationTaskId: design.sourceConversationTaskId } : {}),
          width: design.width,
          height: design.height,
          title: t(locale, `${design.title}（去除背景）`, `${design.title} (background removed)`),
        },
      });
      if (!task) {
        notify(t(locale, '模型连接不可用，任务未提交。', 'Model connection unavailable; task was not submitted.'));
        return;
      }
      notify(t(locale, '去除背景任务已排队。', 'Background removal queued.'));
    } catch {
      notify(t(locale, '去除背景失败，请检查连接。', 'Background removal failed. Check the connection.'));
    }
  };
  const submitProjectImageTask = async (project: Project, input: { tool: ImageTool; prompt: string; params: ToolParams; baseRevisionId: string | null; targetLayerId?: string; region?: { x: number; y: number; width: number; height: number } }): Promise<void> => {
    if (!workspace || workspace.openMode !== 'writable' || !project.libraryId) {
      notify(t(locale, '请先打开可写工作区。', 'Open a writable workspace first.'));
      return;
    }
    const requiredConnection = input.tool === 'resize' ? null : imageConnectionId;
    if (input.tool !== 'resize' && !requiredConnection) {
      notify(t(locale, '请先配置图片编辑连接。', 'Configure an image editing connection first.'));
      return;
    }
    const documentId = project.id === selected?.id ? (activeDocumentId ?? project.documentId) : project.documentId;
    if (!documentId) {
      notify(t(locale, '请先打开文档。', 'Open a document first.'));
      return;
    }
    try {
      const api = getDesktopApi();
      const scene = await api.loadDocumentScene?.(workspace.libraryId, project.id, documentId);
      const imageLayer = scene?.layers.find((layer): layer is Extract<typeof layer, { type: 'image' }> => layer.type === 'image'
        && layer.assetId !== 'placeholder'
        && (input.tool === 'resize' ? true : layer.id === input.targetLayerId));
      if (!imageLayer) {
        notify(t(locale, '请选择一个有效的受管图片图层。', 'Select a valid managed image layer.'));
        return;
      }
      const bytes = await api.readAsset?.({ libraryId: workspace.libraryId, projectId: project.id, assetId: imageLayer.assetId });
      if (!bytes) {
        notify(t(locale, '无法读取目标图像。', 'Could not read the target image.'));
        return;
      }
      const editingModel = requiredConnection ? providerConfigs?.[requiredConnection as keyof ProviderConfigMap]?.image.models['image-editing'] : undefined;
      let maskAssetId: string | undefined;
      if (input.region && (input.tool === 'remove-object' || input.tool === 'inpaint' || input.tool === 'remove-watermark')) {
        if (!scene || !api.importAssets) throw new Error('MASK_PERSISTENCE_UNAVAILABLE');
        const mask = rasterizeMask({ width: Math.round(scene.width), height: Math.round(scene.height), shapes: [{ kind: 'rectangle', region: input.region }] });
        const imported = await api.importAssets({ libraryId: workspace.libraryId, projectId: project.id, items: [{ name: `mask-${crypto.randomUUID()}.png`, mimeType: mask.mimeType, data: mask.bytes, metadata: { purpose: 'image-tool-mask', tool: input.tool } }] });
        const saved = imported?.find((result): result is Extract<typeof result, { status: 'success' }> => result.status === 'success');
        if (!saved) throw new Error('MASK_PERSISTENCE_FAILED');
        maskAssetId = saved.asset.id;
      }
      const task = await api.submitImageEdit?.({ libraryId: workspace.libraryId, projectId: project.id, documentId, baseRevisionId: input.baseRevisionId, designerVersionId: project.activeDesignerVersionId, connectionId: requiredConnection ?? '', ...(editingModel ? { model: editingModel } : {}), prompt: input.prompt, image: new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], { type: 'image/png' }), sourceAssetId: imageLayer.assetId, targetLayerId: input.targetLayerId, ...(scene ? { beforeScene: scene } : {}), tool: input.tool, toolParams: input.params, ...(input.region ? { region: input.region } : {}), ...(maskAssetId ? { maskAssetId } : {}) });
      if (!task) {
        notify(t(locale, '模型连接不可用，任务未提交。', 'Model connection unavailable; task was not submitted.'));
        return;
      }
      const toolLabel = input.tool === 'remove-background'
        ? t(locale, '去除背景', 'Background removal')
        : input.tool;
      notify(t(locale, `${toolLabel}任务已排队。`, `${toolLabel} task queued.`));
    } catch {
      notify(t(locale, '图像任务提交失败，请检查连接。', 'Image task submission failed. Check the connection.'));
    }
  };
  const submitProjectImageGeneration = async (project: Project, prompt: string, baseRevisionId: string | null): Promise<void> => {
    if (!workspace || workspace.openMode !== 'writable' || !project.libraryId) {
      notify(t(locale, '请先打开可写工作区。', 'Open a writable workspace first.'));
      return;
    }
    if (!imageConnectionId) {
      notify(t(locale, '请先配置图片生成连接。', 'Configure an image generation connection first.'));
      return;
    }
    const documentId = project.id === selected?.id ? (activeDocumentId ?? project.documentId) : project.documentId;
    if (!documentId) {
      notify(t(locale, '请先打开文档。', 'Open a document first.'));
      return;
    }
    try {
      const api = getDesktopApi();
      const count = providerConfigs?.[imageConnectionId as keyof ProviderConfigMap]?.image?.imageTransport === 'responses' ? 1 : 2;
      const generationModel = providerConfigs?.[imageConnectionId as keyof ProviderConfigMap]?.image.models['image-generation'];
      const task = await api.submitImageGeneration?.({ libraryId: workspace.libraryId, projectId: project.id, documentId, baseRevisionId, designerVersionId: project.activeDesignerVersionId, connectionId: imageConnectionId, ...(generationModel ? { model: generationModel } : {}), prompt, size: `${project.documentEntries?.find((entry) => entry.id === documentId)?.width ?? 1080}x${project.documentEntries?.find((entry) => entry.id === documentId)?.height ?? 1440}`, count });
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
  const toolbarActions =
    surface === 'projects' && view === 'projects' && !documentOpen && selected ? (
      <>
        {workspace?.openMode === 'writable' && selected.libraryId && <>
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
        userMenu={(
          <StudioUserMenu
            locale={locale}
            operatorName={operatorName}
            avatarDataUrl={profile?.avatarDataUrl}
            currentView={view}
            onNavigate={navigate}
            onImportProject={() => { void importProjectPackage(); }}
            onOpenCanvasImageTools={openCanvasImageTools}
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
            <IconButton
              name="arrow-left"
              label={t(locale, '返回项目', 'Back to projects')}
              className="studio-toolbar__back"
              onClick={() => navigate('projects')}
            />
            <span className="toolbar-page-title">{t(locale, title.zh, title.en)}</span>
          </div>
          <PageToolbarHost>{toolbarActions}</PageToolbarHost>
        </header> : null}
        <div className="studio-body">
          {surface === 'projects' && view === 'projects' && !selected && (
            <StudioHome
              libraryId={workspace?.libraryId}
              locale={locale}
              projects={projects}
              visibleProjects={visibleProjects}
              profiles={designerOptions}
              filter={filter}
              transitionDirection={transitionDirection}
              query={query}
              loadFailed={projectsLoadFailed}
              readOnly={workspace?.openMode !== 'writable'}
              conversationConnected={conversationConnected}
              onFilterChange={setFilter}
              onQueryChange={setQuery}
              onOpenProject={openProject}
              onRetry={() => setProjectsReloadKey((key) => key + 1)}
              onNewProject={({ designerId, generationRatio }) => {
                void createProjectFromHome({
                  message: '',
                  attachments: [],
                  generationRatio,
                  ...(designerId ? { designerId } : {}),
                }, false);
              }}
              onSubmit={createProjectFromHome}
              notify={notify}
            />
          )}
          {surface === 'projects' && view === 'projects' && selected && !documentOpen && !workspace && (
            <div className={`studio-view-shell studio-view-enter studio-view-enter-${transitionDirection}`}>
              <ProjectDetailPage
                locale={locale}
                project={selected}
                profiles={designerOptions}
                projectTitle={selected.name}
                activeDesignerId={selected.activeDesignerVersionId ?? ''}
                designerLabel={designerOptions.find((profile) => profile.id === selected.activeDesignerVersionId)?.name.zh ?? ''}
                contributorIds={[...(selected.activeDesignerVersionId ? [selected.activeDesignerVersionId] : []), ...(selected.contributorDesignerVersionIds ?? [])]}
                contributorLabel={selected.designers.join('、')}
                onOpenDocument={(documentId, index) => {
                  setActiveDocumentId(documentId ?? selected.documentEntries?.[index]?.id ?? selected.documentId ?? null);
                  setDocumentOpen(true);
                  setTransitionDirection('forward');
                }}
              />
            </div>
          )}
          {surface === 'projects' && view === 'projects' && selected && !documentOpen && workspace && (
            <div className={`studio-view-shell studio-view-enter studio-view-enter-${transitionDirection}`}>
              <ProjectCanvas
                locale={locale}
                project={selected}
                libraryId={workspace?.libraryId}
                readOnly={workspace?.openMode !== 'writable'}
                conversationConnected={conversationConnected}
                designer={designerOptions.find((profile) => profile.id === selected.activeDesignerVersionId) ?? null}
                designerOptions={designerOptions}
                onDesignsChange={(designs) => {
                  setProjects((current) => current.map((project) => project.id === selected.id ? { ...project, designs } : project));
                  setSelected((current) => current ? { ...current, designs } : current);
                }}
                onDesignerChange={(designerId) => {
                  const profile = designerOptions.find((entry) => entry.id === designerId && entry.status !== 'archived');
                  void updateProject({ activeDesignerVersionId: designerId, designerSnapshot: profile ? structuredClone(profile) : null });
                }}
                onGenerationRatioChange={(generationRatio) => { void updateProject({ generationRatio }); }}
                notify={notify}
                onOpenDocument={(documentId) => {
                  setActiveDocumentId(documentId);
                  setDocumentOpen(true);
                  setTransitionDirection('forward');
                }}
                onOpenImageTools={openCanvasImageTools}
              onBack={() => { setTransitionDirection('backward'); setSelected(null); }}
                onRename={() => { setProjectNameDraft(selected.name); setProjectDialog('rename'); }}
                onDuplicate={() => { void duplicateSelected(); }}
              onArchive={() => { void updateProject({ archived: true }); setTransitionDirection('backward'); setSelected(null); }}
                onConnections={() => navigate('connections')}
                onSubmitConversation={(message, attachments, context) => submitProjectConversation(selected, message, attachments, context)}
                onRemoveBackground={(design) => submitProjectDesignBackgroundRemoval(selected, design)}
                onSubmitDesignGeneration={(conversationTaskId, generationRatio, count) => submitProjectDesignGeneration(selected, conversationTaskId, null, generationRatio, count)}
              />
            </div>
          )}
          {projects.map((project) => (
            <div
                className={`destination${surface === 'projects' && view === 'projects' && documentOpen && selected?.id === project.id ? ` destination--active studio-view-enter studio-view-enter-${transitionDirection}` : ''}`}
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
                libraryId={project.libraryId}
                documentId={project.id === selected?.id ? (activeDocumentId ?? project.documentId) : project.documentId}
                initialCandidate={entryCandidate?.projectId === project.id ? entryCandidate.candidate : undefined}
                openToolsRequest={project.id === selected?.id ? openToolsRequest : 0}
                onEntryCandidateResolved={() => setEntryCandidate((current) => current?.projectId === project.id ? null : current)}
                onBack={() => { setTransitionDirection('backward'); setDocumentOpen(false); }}
                onConnections={() => navigate('connections')}
                designerOptions={designerOptions}
                onDesignerChange={(designerId) => {
                  const profile = designerOptions.find((entry) => entry.id === designerId && entry.status !== 'archived');
                  void updateProject({ activeDesignerVersionId: designerId, designerSnapshot: profile ? structuredClone(profile) : null });
                }}
                onGenerationRatioChange={(generationRatio) => { void updateProject({ generationRatio }); }}
                onTasks={() => navigate('tasks')}
                onSubmitConversation={(message, attachments, context) => submitProjectConversation(project, message, attachments, context)}
                onSubmitDesignGeneration={(conversationTaskId, baseRevisionId, generationRatio, count) => submitProjectDesignGeneration(project, conversationTaskId, baseRevisionId, generationRatio, count, activeDocumentId ?? project.documentId)}
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
                className={`destination${surface === item.view && view === item.view ? ` destination--active studio-view-enter studio-view-enter-${transitionDirection}` : ''}`}
                key={item.view}
                hidden={surface !== item.view || view !== item.view}
              >
                <LibraryPages
                  locale={locale}
                  view={item.view as Exclude<View, 'projects'>}
                  deliveryProject={deliveryProject}
                  libraryId={workspace?.libraryId}
                  projectId={selected?.id ?? projects[0]?.id}
                  readOnly={workspace?.openMode === 'read-only'}
                  notify={notify}
                  navigate={navigate}
                  onUseForNew={(personaId) => openNewDesign(personaId)}
                  onAssetAction={routeAssetAction}
                  theme={theme}
                  onThemeChange={onThemeChange}
                  onLocaleChange={onLocaleChange}
                  operatorName={operatorName}
                  onOperatorNameChange={updateOperatorName}
                  initialAssets={initialAssets}
                  initialBrands={initialBrands}
                  initialProfiles={initialDesignerOptions}
                  preview={!workspace}
                  active={surface === item.view && view === item.view}
                  connectionsDialogOpen={connectionsDialogOpen}
                  onConnectionsDialogClose={() => {
                    setConnectionsDialogOpen(false);
                    setProviderRefreshKey((current) => current + 1);
                  }}
                  designerCreateRequestId={designerCreateRequestId}
                  onDesignerProfilesChange={setDesignerOptions}
                />
              </div>
            ))}
          <DesignerLibrary
            locale={locale}
            notify={notify}
            onUseForNew={(personaId) => openNewDesign(personaId)}
            libraryId={workspace?.libraryId}
            preview={!workspace}
            initialProfiles={initialDesignerOptions}
            readOnly={workspace?.openMode === 'read-only'}
            toolbarActive={false}
            createRequestId={designerCreateRequestId}
            onProfilesChange={setDesignerOptions}
            onCreateUnavailable={(reason) => notify(reason === 'read-only'
              ? t(locale, '当前工作区为只读模式，无法创建设计师档案。', 'This workspace is read-only; designer profiles cannot be created.')
              : t(locale, '设计师档案读取失败，请重新打开应用后重试。', 'Designer profiles could not be loaded. Reload the app and try again.'))}
            showLibrary={false}
          />
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
