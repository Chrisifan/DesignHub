import type { WorkspaceDescriptor } from '../features/workspace/open-workspace';
import type { ActiveProject, CreateProjectContainerInput, CreateProjectContainerResult } from '../features/workspace/project-store';

export type WorkspaceCreateInput = {
  parentDirectory: string;
  name: string;
};

export type DesktopApi = {
  chooseWorkspaceDirectory: () => Promise<string | null>;
  createWorkspace?: (input: WorkspaceCreateInput) => Promise<WorkspaceDescriptor | null>;
  openWorkspace?: (directory: string) => Promise<WorkspaceDescriptor | null>;
  listActiveProjects?: (workspaceId: string) => Promise<ActiveProject[] | null>;
  createProjectContainer?: (input: CreateProjectContainerInput) => Promise<CreateProjectContainerResult | null>;
  storeCredential?: (connectionId: string, secret: string) => Promise<boolean>;
  deleteCredential?: (connectionId: string) => Promise<boolean>;
};

declare global {
  interface Window {
    designhub: DesktopApi;
  }
}
