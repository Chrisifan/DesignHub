import type { ActiveProject, CreateProjectContainerInput, CreateProjectContainerResult, UpdateProjectMetadataInput } from '../../features/workspace/project-store';
import type { ProjectMetadata } from '../../features/projects/metadata';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { isTrustedWorkspaceRequest } from './workspace';

export const projectListChannel = 'project:list-active';
export const projectCreateChannel = 'project:create';
export const projectMetadataGetChannel = 'project:get-metadata';
export const projectMetadataUpdateChannel = 'project:update-metadata';

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

const isCreateInput = (value: unknown): value is CreateProjectContainerInput => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return isWorkspaceId(input.workspaceId)
    && typeof input.operationId === 'string'
    && input.operationId.trim().length > 0
    && typeof input.name === 'string'
    && input.name.trim().length > 0;
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
