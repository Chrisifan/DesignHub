import type { WorkspaceDescriptor } from '../features/workspace/open-workspace';
import type { ActiveProject, CreateProjectContainerInput, CreateProjectContainerResult, DuplicateProjectInput, ImportProjectPackageResult, RestoreProjectResult, TrashedProject, TrashProjectInput, UpdateProjectMetadataInput } from '../features/workspace/project-store';
import type { BackupArtifact, RestoreBackupResult } from '../features/workspace/backup';
import type { ProjectMetadata } from '../features/projects/metadata';
import type { DesignerLibraryState } from '../features/designers/persistence';
import type { AssetImportInput, AssetReadInput, AssetStoreInput } from '../features/assets/asset-store';
import type { AssetImportResult, ManagedAsset } from '../features/assets/import-assets';
import type { DesignScene } from '../features/canvas/scene';
import type { TaskRecord } from '../features/tasks/state';
import type { TaskSource } from '../features/tasks/state';
import type { CommitRevisionInput, RevisionRecord, RevisionTimelineEvent } from '../features/revisions/model';
import type { BrandLibraryState } from '../features/brands/constraints';
import type { DesignerArtworkGenerationInput, ImageEditInput, ImageGenerationInput, PortfolioAnalysisInput } from '../features/agent/task-service';
import type { WorkspaceSettings } from '../features/workspace/settings';
import type { SearchIndexItem, SearchQuery, SearchRecord } from '../features/library/indexer';
import type { ExportHistoryRecord } from '../features/delivery/export-history';
import type { ProviderConfigMap, ProviderConfigSaveInput } from '../features/providers/config';

export type ConversationTaskInput = {
  workspaceId: string;
  projectId?: string;
  source?: TaskSource;
  documentId?: string;
  designerVersionId?: string;
  baseRevisionId?: string | null;
  connectionId: string;
  message: string;
};

export type ExportDocumentInput = {
  workspaceId: string;
  projectId: string;
  documentId: string;
  format: 'png' | 'jpeg' | 'webp' | 'pdf';
  scene: DesignScene;
  background?: string;
  archiveCopy?: boolean;
};

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
  duplicateProject?: (input: DuplicateProjectInput) => Promise<CreateProjectContainerResult | null>;
  importProjectPackage?: (input: { workspaceId: string }) => Promise<ImportProjectPackageResult | null>;
  getProjectMetadata?: (workspaceId: string, projectId: string) => Promise<ProjectMetadata | null>;
  updateProjectMetadata?: (input: UpdateProjectMetadataInput) => Promise<ProjectMetadata | null>;
  listTrashedProjects?: (workspaceId: string) => Promise<TrashedProject[] | null>;
  moveProjectToTrash?: (input: TrashProjectInput) => Promise<TrashedProject | null>;
  restoreProjectFromTrash?: (input: TrashProjectInput) => Promise<RestoreProjectResult | null>;
  purgeProjectFromTrash?: (input: TrashProjectInput) => Promise<boolean | null>;
  createWorkspaceBackup?: (workspaceId: string, destinationParentDirectory: string) => Promise<BackupArtifact | null>;
  restoreWorkspaceBackup?: (input: { backupDirectory: string; destinationParentDirectory: string }) => Promise<RestoreBackupResult | null>;
  loadWorkspaceSettings?: (workspaceId: string) => Promise<WorkspaceSettings | null>;
  saveWorkspaceSettings?: (workspaceId: string, settings: WorkspaceSettings) => Promise<boolean>;
  rebuildSearchIndex?: (workspaceId: string, records: readonly SearchRecord[]) => Promise<boolean>;
  searchProjects?: (options: SearchQuery) => Promise<SearchIndexItem[] | null>;
  exportProjectPackage?: (input: { workspaceId: string; projectId: string }) => Promise<{ path: string; sha256: string } | null>;
  loadDesignerState?: (workspaceId: string) => Promise<DesignerLibraryState | null>;
  saveDesignerState?: (workspaceId: string, state: DesignerLibraryState) => Promise<boolean>;
  readDesignerArtwork?: (input: { workspaceId: string; artworkId: string }) => Promise<{ artworkId: string; dataUrl: string } | null>;
  loadBrandState?: (workspaceId: string) => Promise<BrandLibraryState | null>;
  saveBrandState?: (workspaceId: string, state: BrandLibraryState) => Promise<boolean>;
  listAssets?: (input: AssetStoreInput) => Promise<ManagedAsset[] | null>;
  importAssets?: (input: AssetImportInput) => Promise<AssetImportResult[] | null>;
  readAsset?: (input: AssetReadInput) => Promise<Uint8Array | null>;
  loadDocumentScene?: (workspaceId: string, projectId: string, documentId: string) => Promise<DesignScene | null>;
  saveDocumentScene?: (input: { workspaceId: string; projectId: string; documentId: string; scene: DesignScene }) => Promise<boolean>;
  loadDocumentRevisions?: (workspaceId: string, projectId: string, documentId: string) => Promise<{ revisions: RevisionRecord[]; timeline: RevisionTimelineEvent[]; finalRevisionId: string | null } | null>;
  commitDocumentRevision?: (input: CommitRevisionInput & { workspaceId: string }) => Promise<{ revisionId: string } | null>;
  setFinalDocumentRevision?: (input: { workspaceId: string; projectId: string; documentId: string; revisionId: string }) => Promise<boolean | null>;
  storeCredential?: (connectionId: string, secret: string) => Promise<boolean>;
  deleteCredential?: (connectionId: string) => Promise<boolean>;
  hasCredential?: (connectionId: string) => Promise<boolean>;
  loadProviderConfigs?: () => Promise<ProviderConfigMap | null>;
  saveProviderConfig?: (input: ProviderConfigSaveInput) => Promise<boolean>;
  listTasks?: (workspaceId: string) => Promise<TaskRecord[] | null>;
  submitConversation?: (input: ConversationTaskInput) => Promise<TaskRecord | null>;
  submitPortfolioAnalysis?: (input: PortfolioAnalysisInput & { workspaceId: string }) => Promise<TaskRecord | null>;
  submitImageGeneration?: (input: ImageGenerationInput & { workspaceId: string }) => Promise<TaskRecord | null>;
  submitDesignerArtworkGeneration?: (input: DesignerArtworkGenerationInput & { workspaceId: string }) => Promise<TaskRecord | null>;
  submitImageEdit?: (input: ImageEditInput & { workspaceId: string }) => Promise<TaskRecord | null>;
  cancelTask?: (workspaceId: string, taskId: string) => Promise<boolean>;
  retryTask?: (workspaceId: string, taskId: string) => Promise<TaskRecord | null>;
  exportDocument?: (input: ExportDocumentInput) => Promise<{ path: string; sha256: string; archived?: boolean; archiveError?: string } | null>;
  listExportHistory?: (workspaceId: string, projectId: string) => Promise<ExportHistoryRecord[] | null>;
  exportDiagnostics?: (input: { runtime: string; errorCode?: string | null }) => Promise<string | null>;
};

declare global {
  interface Window {
    designhub: DesktopApi;
  }
}
