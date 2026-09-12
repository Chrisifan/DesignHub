import type { WorkspaceDescriptor } from '../features/workspace/open-workspace';
import type { ActiveProject, CreateProjectContainerInput, CreateProjectContainerResult, UpdateProjectMetadataInput } from '../features/workspace/project-store';
import type { ProjectMetadata } from '../features/projects/metadata';
import type { DesignerLibraryState } from '../features/designers/persistence';
import type { AssetImportInput, AssetReadInput, AssetStoreInput } from '../features/assets/asset-store';
import type { AssetImportResult, ManagedAsset } from '../features/assets/import-assets';
import type { DesignScene } from '../features/canvas/scene';

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
  listAssets?: (input: AssetStoreInput) => Promise<ManagedAsset[] | null>;
  importAssets?: (input: AssetImportInput) => Promise<AssetImportResult[] | null>;
  readAsset?: (input: AssetReadInput) => Promise<Uint8Array | null>;
  loadDocumentScene?: (workspaceId: string, projectId: string, documentId: string) => Promise<DesignScene | null>;
  saveDocumentScene?: (input: { workspaceId: string; projectId: string; documentId: string; scene: DesignScene }) => Promise<boolean>;
  storeCredential?: (connectionId: string, secret: string) => Promise<boolean>;
  deleteCredential?: (connectionId: string) => Promise<boolean>;
};

declare global {
  interface Window {
    designhub: DesktopApi;
  }
}
