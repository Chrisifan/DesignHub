import type { ActiveProject, CreateProjectContainerInput, CreateProjectContainerResult, DuplicateProjectInput, RestoreProjectResult, TrashedProject, TrashProjectInput, UpdateProjectMetadataInput } from '../../features/workspace/project-store';
import type { ProjectMetadata } from '../../features/projects/metadata';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { isTrustedWorkspaceRequest } from './workspace';

export const projectListChannel = 'project:list-active';
export const projectCreateChannel = 'project:create';
export const projectDuplicateChannel = 'project:duplicate';
export const projectMetadataGetChannel = 'project:get-metadata';
export const projectMetadataUpdateChannel = 'project:update-metadata';
export const projectListTrashChannel = 'project:list-trash';
export const projectTrashChannel = 'project:trash';
export const projectRestoreTrashChannel = 'project:restore-trash';
export const projectPurgeTrashChannel = 'project:purge-trash';

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
  return isWorkspaceId(input.workspaceId) && isWorkspaceId(input.projectId);
};

const isCreateInput = (value: unknown): value is CreateProjectContainerInput => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return isWorkspaceId(input.workspaceId)
    && typeof input.operationId === 'string'
    && input.operationId.trim().length > 0
    && typeof input.name === 'string'
    && input.name.trim().length > 0;
};

const isDuplicateInput = (value: unknown): value is DuplicateProjectInput => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return isWorkspaceId(input.workspaceId)
    && isWorkspaceId(input.sourceProjectId)
    && typeof input.operationId === 'string'
    && input.operationId.trim().length > 0
    && (input.name === undefined || (typeof input.name === 'string' && input.name.trim().length > 0));
};

const isMetadataInput = (value: unknown): value is UpdateProjectMetadataInput => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  if (!isWorkspaceId(input.workspaceId) || !isWorkspaceId(input.projectId) || typeof input.patch !== 'object' || input.patch === null || Array.isArray(input.patch)) return false;
  return Object.keys(input.patch as Record<string, unknown>).every((key) => ['name', 'brief', 'activeDesignerVersionId', 'designerSnapshot', 'brandSnapshot', 'documents', 'archived'].includes(key));
};

export const listActiveProjectsHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  listProjects: (workspace: WorkspaceHandle) => Promise<ActiveProject[]>,
) => async (event: ProjectRequest, workspaceId: unknown): Promise<ActiveProject[] | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isWorkspaceId(workspaceId)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== workspaceId) return null;
  return listProjects(workspace);
};

export const createProjectContainerHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  createProject: (workspace: WorkspaceHandle, input: CreateProjectContainerInput) => Promise<CreateProjectContainerResult>,
) => async (event: ProjectRequest, input: unknown): Promise<CreateProjectContainerResult | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isCreateInput(input)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return null;
  return createProject(workspace, input);
};

export const duplicateProjectHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  duplicateProject: (workspace: WorkspaceHandle, input: DuplicateProjectInput) => Promise<CreateProjectContainerResult>,
) => async (event: ProjectRequest, input: unknown): Promise<CreateProjectContainerResult | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isDuplicateInput(input)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return null;
  return duplicateProject(workspace, input);
};

export const getProjectMetadataHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  getMetadata: (workspace: WorkspaceHandle, projectId: string) => Promise<ProjectMetadata | null>,
) => async (event: ProjectRequest, input: unknown): Promise<ProjectMetadata | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  if (!isWorkspaceId(value.workspaceId) || !isWorkspaceId(value.projectId)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== value.workspaceId) return null;
  return getMetadata(workspace, value.projectId);
};

export const updateProjectMetadataHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  updateMetadata: (workspace: WorkspaceHandle, input: UpdateProjectMetadataInput) => Promise<ProjectMetadata>,
) => async (event: ProjectRequest, input: unknown): Promise<ProjectMetadata | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isMetadataInput(input)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return null;
  return updateMetadata(workspace, input);
};

export const listTrashedProjectsHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  listProjects: (workspace: WorkspaceHandle) => Promise<TrashedProject[]>,
) => async (event: ProjectRequest, workspaceId: unknown): Promise<TrashedProject[] | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isWorkspaceId(workspaceId)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== workspaceId) return null;
  return listProjects(workspace);
};

export const moveProjectToTrashHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  moveProject: (workspace: WorkspaceHandle, input: TrashProjectInput) => Promise<TrashedProject>,
) => async (event: ProjectRequest, input: unknown): Promise<TrashedProject | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isTrashInput(input)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return null;
  return moveProject(workspace, input);
};

export const restoreProjectFromTrashHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  restoreProject: (workspace: WorkspaceHandle, input: TrashProjectInput) => Promise<RestoreProjectResult>,
) => async (event: ProjectRequest, input: unknown): Promise<RestoreProjectResult | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isTrashInput(input)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return null;
  return restoreProject(workspace, input);
};

export const purgeProjectFromTrashHandler = (
  window: ProjectWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  purgeProject: (workspace: WorkspaceHandle, input: TrashProjectInput) => Promise<void>,
) => async (event: ProjectRequest, input: unknown): Promise<boolean | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isTrashInput(input)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return null;
  await purgeProject(workspace, input);
  return true;
};
