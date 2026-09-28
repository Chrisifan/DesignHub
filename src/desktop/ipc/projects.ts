import type { ActiveProject, CreateProjectContainerInput, CreateProjectContainerResult, DuplicateProjectInput, RestoreProjectResult, TrashedProject, TrashProjectInput, UpdateProjectMetadataInput } from '../../features/workspace/project-store';
import type { ProjectCanvasLayout, ProjectDesign, ProjectMetadata } from '../../features/projects/metadata';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { isTrustedProjectLibraryRequest } from './workspace';
import { isProjectGenerationRatio } from '../../features/projects/size';

export const projectListChannel = 'project:list-active';
export const projectCreateChannel = 'project:create';
export const projectDuplicateChannel = 'project:duplicate';
export const projectMetadataGetChannel = 'project:get-metadata';
export const projectMetadataUpdateChannel = 'project:update-metadata';
export const projectListTrashChannel = 'project:list-trash';
export const projectTrashChannel = 'project:trash';
export const projectRestoreTrashChannel = 'project:restore-trash';
export const projectPurgeTrashChannel = 'project:purge-trash';
export const projectDesignsAddChannel = 'project:add-designs';
export const projectDesignsListChannel = 'project:list-designs';
export const projectCanvasLayoutLoadChannel = 'project:load-canvas-layout';
export const projectCanvasLayoutSaveChannel = 'project:save-canvas-layout';

type ProjectSender = {
  mainFrame: { url: string };
  getURL: () => string;
};

type ProjectRequest = {
  sender: ProjectSender;
  senderFrame: { url: string } | null;
};

type ProjectWindow = { webContents: ProjectSender };

const isWorkspaceId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isTrashInput = (value: unknown): value is TrashProjectInput => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return isWorkspaceId(input.libraryId) && isWorkspaceId(input.projectId);
};

const isCreateInput = (value: unknown): value is CreateProjectContainerInput => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return isWorkspaceId(input.libraryId)
    && typeof input.operationId === 'string'
    && input.operationId.trim().length > 0
    && typeof input.name === 'string'
    && input.name.trim().length > 0
    && (input.generationRatio === undefined || isProjectGenerationRatio(input.generationRatio));
};

const isDuplicateInput = (value: unknown): value is DuplicateProjectInput => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return isWorkspaceId(input.libraryId)
    && isWorkspaceId(input.sourceProjectId)
    && typeof input.operationId === 'string'
    && input.operationId.trim().length > 0
    && (input.name === undefined || (typeof input.name === 'string' && input.name.trim().length > 0));
};

const isMetadataInput = (value: unknown): value is UpdateProjectMetadataInput => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  if (!isWorkspaceId(input.libraryId) || !isWorkspaceId(input.projectId) || typeof input.patch !== 'object' || input.patch === null || Array.isArray(input.patch)) return false;
  return Object.keys(input.patch as Record<string, unknown>).every((key) => ['name', 'brief', 'generationRatio', 'activeDesignerVersionId', 'contributorDesignerVersionIds', 'designerSnapshot', 'brandSnapshot', 'coverAssetId', 'documents', 'archived'].includes(key))
    && ((input.patch as Record<string, unknown>).generationRatio === undefined || isProjectGenerationRatio((input.patch as Record<string, unknown>).generationRatio));
};

const isProjectRef = (value: unknown): value is { libraryId: string; projectId: string } => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return isWorkspaceId(input.libraryId) && isWorkspaceId(input.projectId);
};
const isProjectDesign = (value: unknown): value is ProjectDesign => {
  if (!value || typeof value !== 'object') return false;
  const design = value as Record<string, unknown>;
  return isWorkspaceId(design.id) && isWorkspaceId(design.assetId) && isWorkspaceId(design.sourceTaskId)
    && isWorkspaceId(design.title) && typeof design.width === 'number' && design.width > 0
    && typeof design.height === 'number' && design.height > 0 && typeof design.createdAt === 'string';
};
const isProjectDesignsInput = (value: unknown): value is { libraryId: string; projectId: string; designs: ProjectDesign[] } => {
  if (!isProjectRef(value)) return false;
  const designs = (value as Record<string, unknown>).designs;
  return Array.isArray(designs) && designs.every(isProjectDesign);
};
const isCanvasLayoutInput = (value: unknown): value is { libraryId: string; projectId: string; layout: ProjectCanvasLayout } => {
  if (!isProjectRef(value)) return false;
  const layout = (value as Record<string, unknown>).layout;
  if (!layout || typeof layout !== 'object') return false;
  const viewport = (layout as Record<string, unknown>).viewport;
  return Boolean(viewport && typeof viewport === 'object' && typeof (viewport as Record<string, unknown>).zoom === 'number'
    && typeof (viewport as Record<string, unknown>).offsetX === 'number' && typeof (viewport as Record<string, unknown>).offsetY === 'number'
    && (layout as Record<string, unknown>).nodes && typeof (layout as Record<string, unknown>).nodes === 'object');
};

export const listActiveProjectsHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  listProjects: (workspace: ProjectLibraryHandle) => Promise<ActiveProject[]>,
) => async (event: ProjectRequest, libraryId: unknown): Promise<ActiveProject[] | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isWorkspaceId(libraryId)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== libraryId) return null;
  return listProjects(workspace);
};

export const createProjectContainerHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  createProject: (workspace: ProjectLibraryHandle, input: CreateProjectContainerInput) => Promise<CreateProjectContainerResult>,
) => async (event: ProjectRequest, input: unknown): Promise<CreateProjectContainerResult | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isCreateInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return createProject(workspace, input);
};

export const duplicateProjectHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  duplicateProject: (workspace: ProjectLibraryHandle, input: DuplicateProjectInput) => Promise<CreateProjectContainerResult>,
) => async (event: ProjectRequest, input: unknown): Promise<CreateProjectContainerResult | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isDuplicateInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return duplicateProject(workspace, input);
};

export const getProjectMetadataHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  getMetadata: (workspace: ProjectLibraryHandle, projectId: string) => Promise<ProjectMetadata | null>,
) => async (event: ProjectRequest, input: unknown): Promise<ProjectMetadata | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  if (!isWorkspaceId(value.libraryId) || !isWorkspaceId(value.projectId)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== value.libraryId) return null;
  return getMetadata(workspace, value.projectId);
};

export const updateProjectMetadataHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  updateMetadata: (workspace: ProjectLibraryHandle, input: UpdateProjectMetadataInput) => Promise<ProjectMetadata>,
) => async (event: ProjectRequest, input: unknown): Promise<ProjectMetadata | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isMetadataInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return updateMetadata(workspace, input);
};

export const addProjectDesignsHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  addDesigns: (workspace: ProjectLibraryHandle, input: { libraryId: string; projectId: string; designs: ProjectDesign[] }) => Promise<ProjectDesign[]>,
) => async (event: ProjectRequest, input: unknown): Promise<ProjectDesign[] | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isProjectDesignsInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId || workspace.library.openMode !== 'writable') return null;
  return addDesigns(workspace, input);
};

export const listProjectDesignsHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  listDesigns: (workspace: ProjectLibraryHandle, input: { libraryId: string; projectId: string }) => Promise<ProjectDesign[]>,
) => async (event: ProjectRequest, input: unknown): Promise<ProjectDesign[] | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isProjectRef(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return listDesigns(workspace, input);
};

export const loadProjectCanvasLayoutHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  loadLayout: (workspace: ProjectLibraryHandle, input: { libraryId: string; projectId: string }) => Promise<ProjectCanvasLayout | null>,
) => async (event: ProjectRequest, input: unknown): Promise<ProjectCanvasLayout | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isProjectRef(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return loadLayout(workspace, input);
};

export const saveProjectCanvasLayoutHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  saveLayout: (workspace: ProjectLibraryHandle, input: { libraryId: string; projectId: string; layout: ProjectCanvasLayout }) => Promise<ProjectCanvasLayout>,
) => async (event: ProjectRequest, input: unknown): Promise<ProjectCanvasLayout | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isCanvasLayoutInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId || workspace.library.openMode !== 'writable') return null;
  return saveLayout(workspace, input);
};

export const listTrashedProjectsHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  listProjects: (workspace: ProjectLibraryHandle) => Promise<TrashedProject[]>,
) => async (event: ProjectRequest, libraryId: unknown): Promise<TrashedProject[] | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isWorkspaceId(libraryId)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== libraryId) return null;
  return listProjects(workspace);
};

export const moveProjectToTrashHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  moveProject: (workspace: ProjectLibraryHandle, input: TrashProjectInput) => Promise<TrashedProject>,
) => async (event: ProjectRequest, input: unknown): Promise<TrashedProject | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isTrashInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return moveProject(workspace, input);
};

export const restoreProjectFromTrashHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  restoreProject: (workspace: ProjectLibraryHandle, input: TrashProjectInput) => Promise<RestoreProjectResult>,
) => async (event: ProjectRequest, input: unknown): Promise<RestoreProjectResult | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isTrashInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return restoreProject(workspace, input);
};

export const purgeProjectFromTrashHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  purgeProject: (workspace: ProjectLibraryHandle, input: TrashProjectInput) => Promise<void>,
) => async (event: ProjectRequest, input: unknown): Promise<boolean | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isTrashInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  await purgeProject(workspace, input);
  return true;
};
