import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getMessages, type Locale } from '../i18n';
import { WindowBar } from '../shell/WindowBar';
import { LibraryPages } from './LibraryPages';
import { NewProjectForm } from './NewDesignPage';
import { Drawer } from './Drawer';
import { PageToolbarHost, PageToolbarProvider } from './PageToolbar';
import { PersonaArtwork } from './PersonaArtwork';
import { ProjectCoverImage } from './ProjectCoverImage';
import { ProjectDetailPage } from './ProjectDetailPage';
import { localize, type PersonaProfile } from './personas';
import { legacySeededDesignerIds } from '../../features/designers/persistence';
import { Workbench } from './Workbench';
import type { CanvasAssetAction } from '../../features/canvas/CanvasWorkspace';
import type { WorkspaceDescriptor } from '../../features/workspace/open-workspace';
import type { ActiveProject } from '../../features/workspace/project-store';
import { getDesktopApi } from '../../platform/runtime';
import {
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
import type { ImageTool, ToolParams } from '../../features/image-tools/target';
import { resizeScene } from '../../features/image-tools/local-transform';
import { buildSearchIndex, searchIndex } from '../../features/library/indexer';
import { parseDocumentSize } from '../../features/projects/size';
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
    documents: documentEntries?.length ?? 0,
    documentEntries,
    archived: entry.archived,
  };
};

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
  const [display, setDisplay] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<Project | null>(null);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [deliveryProject, setDeliveryProject] = useState<Project | null>(null);
  const [dialog, setDialog] = useState<'workspace' | null>(null);
  const [collapsed, setCollapsed] = useState(false);
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
  const [projectDialog, setProjectDialog] = useState<'rename' | null>(null);
  const [relatedDialog, setRelatedDialog] = useState(false);
  const [relatedName, setRelatedName] = useState('');
  const [relatedWidth, setRelatedWidth] = useState('1080');
  const [relatedHeight, setRelatedHeight] = useState('1080');
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [designerOptions, setDesignerOptions] = useState<PersonaProfile[]>(initialDesignerOptions);
  const [modelConnected, setModelConnected] = useState(false);
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
    setNewProjectDrawerOpen(false);
    setView('projects');
    setSurface('projects');
    return () => { cancelled = true; };
  }, [initialDesignerOptions, initialProjects, workspace?.workspaceId, locale, projectsReloadKey]);
  useEffect(() => {
    let cancelled = false;
    if (!workspace) { setModelConnected(false); return () => { cancelled = true; }; }
    const request = Promise.all([
      getDesktopApi().hasCredential?.('openai-compatible:conversation') ?? Promise.resolve(false),
      getDesktopApi().hasCredential?.('openai-compatible:image') ?? Promise.resolve(false),
    ]);
    void request.then(([conversation, image]) => { if (!cancelled) setModelConnected(Boolean(conversation || image)); }).catch(() => undefined);
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
        coverAssetId: metadata.coverAssetId,
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
        coverAssetId: metadata.coverAssetId,
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
  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const documentId = crypto.randomUUID();
    let documentSize;
    try {
      documentSize = parseDocumentSize(draft.size);
    } catch {
      notify(t(locale, '尺寸无效，请重新选择。', 'Invalid document size. Choose another preset.'));
      return;
    }
    if (workspace?.openMode === 'writable') {
      const selectedDesigner = designerOptions.find((profile) => profile.id === draft.personaId);
      const submittedCover = draft.cover;
      const created = await getDesktopApi().createProjectContainer?.({
        workspaceId: workspace.workspaceId,
        operationId: crypto.randomUUID(),
        name: draft.name.trim(),
        brief: draft.goal || undefined,
        ...(selectedDesigner ? { activeDesignerVersionId: selectedDesigner.id, designerSnapshot: structuredClone(selectedDesigner) } : {}),
        documents: [{ id: documentId, name: t(locale, '主海报', 'Main poster'), width: documentSize.width, height: documentSize.height }],
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
        documentId,
        name: draft.name.trim(),
        enName: draft.name.trim(),
        description: draft.goal,
        enDescription: draft.goal,
        designers: selectedDesigner ? [localize(locale, selectedDesigner.name)] : [],
        ...(selectedDesigner ? { activeDesignerVersionId: selectedDesigner.id, designerSnapshot: structuredClone(selectedDesigner) } : {}),
        ...(coverAssetId ? { coverAssetId } : {}),
        artwork: 'blank',
        documents: 1,
        documentEntries: [{ id: documentId, name: t(locale, '主海报', 'Main poster'), width: documentSize.width, height: documentSize.height }],
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
      documents: 1,
      documentEntries: [{ id: documentId, name: t(locale, '主海报', 'Main poster'), width: documentSize.width, height: documentSize.height }],
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
  const projectPersonaId = (project: Project) => project.activeDesignerVersionId ?? '';
  const projectDesignerLabel = (project: Project): string => {
    const snapshot = project.designerSnapshot as { name?: { zh?: string; en?: string } } | undefined;
    const localizedName = snapshot?.name?.[locale === 'zh-CN' ? 'zh' : 'en'];
    if (localizedName) return localizedName;
    return project.designers[0] ?? t(locale, '未设置设计师', 'No designer selected');
  };
  const projectContributorIds = (project: Project): string[] => {
    const ids = [...new Set(project.contributorDesignerVersionIds?.length
      ? project.contributorDesignerVersionIds
      : (project.activeDesignerVersionId ? [project.activeDesignerVersionId] : []))];
    if (ids.length > 0) return ids;
    return [];
  };
  const projectContributorLabel = (project: Project): string => projectContributorIds(project).map((id, index) => {
    if (index === 0) return projectDesignerLabel(project);
    const profile = designerOptions.find((entry) => entry.id === id);
    return profile ? localize(locale, profile.name) : id;
  }).join(' · ');
  const openDelivery = (project: Project) => {
    setDeliveryProject(project);
    navigate('delivery');
  };
  const openDocument = (project: Project, documentId?: string): void => {
    setSelected(project);
    setActiveDocumentId(documentId ?? project.documentEntries?.[0]?.id ?? project.documentId ?? null);
    setDocumentOpen(true);
    setCollapsed(true);
    setSurface('projects');
    setView('projects');
  };
  const submitProjectConversation = async (project: Project, message: string, attachments: import('../../features/agent/task-service').ConversationImageAttachment[] = [], context: { analysisThreadId?: string; conversationParentTaskId?: string; referencedAssetIds?: string[] } = {}): Promise<import('../../features/tasks/state').TaskRecord | null> => {
    if (!workspace || workspace.openMode !== 'writable' || !project.workspaceId) {
      notify(t(locale, '请先打开可写工作区。', 'Open a writable workspace first.'));
      return null;
    }
    try {
      const documentId = project.id === selected?.id ? (activeDocumentId ?? project.documentId) : project.documentId;
      const task = await getDesktopApi().submitConversation?.({
        workspaceId: workspace.workspaceId,
        projectId: project.id,
        ...(documentId ? { documentId } : {}),
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
  const submitProjectDesignGeneration = async (project: Project, conversationTaskId: string, baseRevisionId: string | null): Promise<import('../../features/tasks/state').TaskRecord | null> => {
    if (!workspace || workspace.openMode !== 'writable' || !project.workspaceId) {
      notify(t(locale, '请先打开可写工作区。', 'Open a writable workspace first.'));
      return null;
    }
    const documentId = project.id === selected?.id ? (activeDocumentId ?? project.documentId) : project.documentId;
    if (!documentId) {
      notify(t(locale, '请先打开文档。', 'Open a document first.'));
      return null;
    }
    try {
      const task = await getDesktopApi().submitDesignGeneration?.({
        workspaceId: workspace.workspaceId,
        projectId: project.id,
        documentId,
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
    surface === 'projects' && view === 'projects' && !documentOpen && !selected ? (
      <>
        <div className="toolbar-segmented" role="group" aria-label={t(locale, '项目状态', 'Project status')}>
          {(['active', 'archived', 'all'] as const).map((value) => (
            <button
              type="button"
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
              {value === 'active' && <span>{projects.filter((project) => !project.archived).length}</span>}
            </button>
          ))}
        </div>
        <label className="toolbar-search">
          <Icon name="search" size={16} />
          <span className="sr-only">{t(locale, '搜索项目', 'Search projects')}</span>
          <input
            type="search"
            aria-label={t(locale, '搜索项目', 'Search projects')}
            placeholder={t(locale, '搜索项目…', 'Search projects…')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="view-toggle" role="group" aria-label={t(locale, '展示方式', 'Display mode')}>
          <IconButton name="layout-grid" label={t(locale, '网格视图', 'Grid view')} aria-pressed={display === 'grid'} onClick={() => setDisplay('grid')} />
          <IconButton name="list" label={t(locale, '列表视图', 'List view')} aria-pressed={display === 'list'} onClick={() => setDisplay('list')} />
        </div>
        {workspace?.openMode === 'writable' && <IconButton name="upload" label={t(locale, '导入项目包', 'Import package')} onClick={() => { void importProjectPackage(); }} />}
        <IconButton name="plus" label={t(locale, '新建项目', 'New project')} onClick={() => openNewDesign()} />
      </>
    ) : surface === 'projects' && view === 'projects' && !documentOpen && selected ? (
      <>
        <IconButton name="download" label={t(locale, '导出交付', 'Delivery')} onClick={() => openDelivery(selected)} />
        <IconButton name="file-image" label={t(locale, '继续编辑', 'Open workbench')} onClick={() => setDocumentOpen(true)} />
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
        <div className="studio-main" data-drawer-host>
        <PageToolbarProvider>
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
            <span className="toolbar-divider" />
            <span className="toolbar-workspace">
              {workspace?.name ?? t(locale, '我的设计空间', 'My design studio')}
            </span>
            <Icon name="chevron-right" size={14} />
            <span className="breadcrumb-current">
              {breadcrumbTitle}
            </span>
          </div>
          <PageToolbarHost>{toolbarActions}</PageToolbarHost>
        </header>
        <div className="studio-body">
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
              />
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
                        <ProjectCoverImage
                          workspaceId={project.workspaceId}
                          projectId={project.id}
                          coverAssetId={project.coverAssetId}
                          previewUrl={project.coverPreviewUrl}
                          alt={t(locale, `${projectName(project)}项目封面`, `${projectName(project)} project cover`)}
                        />
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
                        <p className="project-card-description">
                          {t(
                            locale,
                            project.description,
                            project.enDescription,
                          )}
                        </p>
                        <div className="project-meta">
                          <span className="design-attribution">
                            <span className="design-attribution-avatars">
                              {projectContributorIds(project).slice(0, 3).map((designerId) => <PersonaArtwork key={designerId} locale={locale} personaId={designerId} crop="avatar" profile={designerOptions.find((profile) => profile.id === designerId)} />)}
                            </span>
                            <strong>
                              {projectDesignerLabel(project)}{(project.designerSnapshot as { version?: string } | undefined)?.version ? ` · ${(project.designerSnapshot as { version?: string }).version}` : ''}
                            </strong>
                            {projectContributorIds(project).length > 1 && <span className="design-attribution-contributors" aria-label={t(locale, '版本署名', 'Revision credits')}>{projectContributorLabel(project)}</span>}
                          </span>
                          <span className="project-meta-end">
                            {project.workspaceId ? t(locale, '本地', 'Local') : t(locale, '未保存', 'Unsaved')}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="page-empty-state">
                  <EmptyState
                    icon={projectsLoadFailed ? 'alert-triangle' : projects.length === 0 ? 'folder-open' : 'search'}
                    title={projectsLoadFailed ? t(locale, '项目读取失败', 'Could not load projects') : projects.length === 0 ? t(locale, '暂无项目', 'No projects yet') : t(locale, '没有匹配的项目', 'No matching projects')}
                    description={t(
                      locale,
                      projectsLoadFailed ? '请重试或检查工作区权限。' : projects.length === 0 ? '创建项目后会显示在这里。' : '试试其他关键词，或查看全部项目。',
                      projectsLoadFailed ? 'Retry or check workspace permissions.' : projects.length === 0 ? 'Create a project to see it here.' : 'Try another keyword or view all projects.',
                    )}
                  >
                    {(projectsLoadFailed || projects.length > 0) && <Button
                      onClick={() => {
                        if (projectsLoadFailed) setProjectsReloadKey((key) => key + 1);
                        else { setQuery(''); setFilter('all'); }
                      }}
                    >
                      {projectsLoadFailed ? t(locale, '重试', 'Retry') : t(locale, '清除搜索', 'Clear search')}
                    </Button>}
                  </EmptyState>
                </div>
              )}
            </section>
          )}
          {surface === 'projects' && view === 'projects' && selected && !documentOpen && (
            <ProjectDetailPage
              locale={locale}
              project={selected}
              profiles={designerOptions}
              writable={workspace?.openMode === 'writable' && Boolean(selected.workspaceId)}
              projectTitle={projectName(selected)}
              activeDesignerId={projectPersonaId(selected)}
              designerLabel={projectDesignerLabel(selected)}
              contributorIds={projectContributorIds(selected)}
              contributorLabel={projectContributorLabel(selected)}
              onOpenDocument={(documentId, index) => {
                if (documentId || index === 0) {
                  openDocument(selected, documentId);
                  return;
                }
                notify(t(
                  locale,
                  '当前可打开主海报预览，其他尺寸稿将在文档能力接入后提供。',
                  'Open the main poster preview. Other sizes will be available with document storage.',
                ));
              }}
              onExport={() => openDelivery(selected)}
              onCreateDocument={openRelatedDialog}
              onSwitchDesigner={(designerId) => { void switchProjectDesigner(designerId); }}
              onToggleContributor={(designerId) => { void toggleProjectContributor(designerId); }}
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
                onExport={() => openDelivery({ ...project, documentId: project.id === selected?.id ? (activeDocumentId ?? project.documentId) : project.documentId })}
                onConnections={() => navigate('connections')}
                onTasks={() => navigate('tasks')}
                onSubmitConversation={(message, attachments, context) => submitProjectConversation(project, message, attachments, context)}
                onSubmitDesignGeneration={(conversationTaskId, baseRevisionId) => submitProjectDesignGeneration(project, conversationTaskId, baseRevisionId)}
                onSubmitImageTask={(input) => submitProjectImageTask(project, input)}
                onSubmitImageGeneration={(prompt, baseRevisionId) => submitProjectImageGeneration(project, prompt, baseRevisionId)}
                assetAction={project.id === selected?.id ? pendingAssetAction ?? undefined : undefined}
                onAssetActionHandled={(actionId) => setPendingAssetAction((current) => current?.id === actionId ? null : current)}
                operatorName={operatorName}
                modelConnected={modelConnected}
                readOnly={workspace?.openMode === 'read-only'}
                notify={notify}
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
        <footer className="studio-status">
          <span>
            <Icon name="hard-drive" size={12} />
            {t(
              locale,
              workspace
                ? workspace.openMode === 'read-only'
                  ? '只读工作区'
                  : '本地工作区'
                : '未打开工作区',
              workspace
                ? workspace.openMode === 'read-only'
                  ? 'Read-only workspace'
                  : 'Local workspace'
                : 'No workspace open',
            )}
          </span>
          <span>
            <Icon name="plug" size={12} />
            {modelConnected
              ? t(locale, '模型已连接', 'Model connected')
              : t(locale, '模型未连接', 'No model connected')}
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
