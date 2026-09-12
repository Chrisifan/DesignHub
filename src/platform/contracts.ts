import type { WorkspaceDescriptor } from '../features/workspace/open-workspace';
import type { ActiveProject, CreateProjectContainerInput, CreateProjectContainerResult, UpdateProjectMetadataInput } from '../features/workspace/project-store';
import type { ProjectMetadata } from '../features/projects/metadata';
import type { DesignerLibraryState } from '../features/designers/persistence';

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
  getProjectMetadata?: (workspaceId: string, projectId: string) => Promise<ProjectMetadata | null>;
  updateProjectMetadata?: (input: UpdateProjectMetadataInput) => Promise<ProjectMetadata | null>;
  loadDesignerState?: (workspaceId: string) => Promise<DesignerLibraryState | null>;
  saveDesignerState?: (workspaceId: string, state: DesignerLibraryState) => Promise<boolean>;
  storeCredential?: (connectionId: string, secret: string) => Promise<boolean>;
  deleteCredential?: (connectionId: string) => Promise<boolean>;
};

declare global {
  interface Window {
    designhub: DesktopApi;
  }
}
