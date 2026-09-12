import type { ActiveProject, CreateProjectContainerInput, CreateProjectContainerResult } from '../../features/workspace/project-store';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { isTrustedWorkspaceRequest } from './workspace';

export const projectListChannel = 'project:list-active';
export const projectCreateChannel = 'project:create';

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
