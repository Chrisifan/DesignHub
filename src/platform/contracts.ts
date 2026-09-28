import type { ActiveProject, CreateProjectContainerInput, CreateProjectContainerResult, DuplicateProjectInput, ImportProjectPackageResult, RestoreProjectResult, TrashedProject, TrashProjectInput, UpdateProjectMetadataInput } from '../features/workspace/project-store';
import type { BackupArtifact, RestoreBackupResult } from '../features/workspace/backup';
import type { ProjectCanvasLayout, ProjectDesign, ProjectMetadata } from '../features/projects/metadata';
import type { DesignerLibraryState } from '../features/designers/persistence';
import type { AssetImportInput, AssetReadInput, AssetStoreInput } from '../features/assets/asset-store';
import type { AssetImportResult, ManagedAsset } from '../features/assets/import-assets';
import type { DesignScene } from '../features/canvas/scene';
import type { TaskRecord } from '../features/tasks/state';
import type { TaskSource } from '../features/tasks/state';
import type { CommitRevisionInput, RevisionRecord, RevisionTimelineEvent } from '../features/revisions/model';
import type { BrandLibraryState } from '../features/brands/constraints';
import type { ConversationImageAttachment, ConversationTestResult, DesignerArtworkGenerationInput, DesignGenerationInput, DesignGenerationSlotRetryInput, ImageEditInput, ImageGenerationInput, ImageGenerationTestResult } from '../features/agent/task-service';
import type { WorkspaceSettings } from '../features/workspace/settings';
import type { SearchIndexItem, SearchQuery, SearchRecord } from '../features/library/indexer';
import type { ExportHistoryRecord } from '../features/delivery/export-history';
import type { ProviderConfigMap, ProviderConfigSaveInput } from '../features/providers/config';
import type { ProjectLibraryDescriptor, ProjectLibraryStatus } from '../features/project-library/open-project-library';
import type { AppProfile } from '../features/profile/model';
import type { BatchImageTool, ImageToolItem, ImageToolJob } from '../features/image-tools/jobs';
import type { ToolParams } from '../features/image-tools/target';

export type ProfileAvatarInput = {
  mimeType: string;
  bytes: Uint8Array;
};

export type PortfolioUploadFile = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type ImageToolSelection = { path: string; kind: 'file' | 'directory'; displayName: string };
export type ImageToolJobSnapshot = { job: ImageToolJob; items: ImageToolItem[] };

export type PortfolioInspectionRequest =
  | { kind: 'local-files' }
  | { kind: 'uploaded-files'; files: PortfolioUploadFile[] };

export type PortfolioInspectionCandidate = {
  id: string;
  label: string;
  description: string;
  origin: 'local-image' | 'zip-image';
  previewUrl: string;
};

export type PortfolioInspection = {
  id: string;
  candidates: PortfolioInspectionCandidate[];
};

export type PortfolioSelectionInput = {
  libraryId: string;
  source: { kind: 'designer-draft'; id: string };
  connectionId: string;
  selections: Array<{ inspectionId: string; sourceIds: string[] }>;
  rightsConfirmed: boolean;
};

export type ConversationTaskInput = {
  libraryId: string;
  projectId?: string;
  source?: TaskSource;
  documentId?: string;
  analysisThreadId?: string;
  conversationParentTaskId?: string;
  referencedAssetIds?: string[];
  designerVersionId?: string;
  baseRevisionId?: string | null;
  connectionId: string;
  model?: string;
  message: string;
  attachments?: ConversationImageAttachment[];
};

export type ExportDocumentInput = {
  libraryId: string;
  projectId: string;
  documentId: string;
  format: 'png' | 'jpeg' | 'webp' | 'pdf';
  scene: DesignScene;
  background?: string;
  archiveCopy?: boolean;
};

export type DesktopApi = {
  loadProfile?: () => Promise<AppProfile | null>;
  saveProfile?: (input: { displayName?: string; avatar?: ProfileAvatarInput | null; onboarding?: Partial<AppProfile['onboarding']> }) => Promise<AppProfile | null>;
  getProjectLibraryStatus?: () => Promise<ProjectLibraryStatus | null>;
  chooseProjectLibrary?: () => Promise<ProjectLibraryDescriptor | null>;
  listActiveProjects?: (libraryId: string) => Promise<ActiveProject[] | null>;
  createProjectContainer?: (input: CreateProjectContainerInput) => Promise<CreateProjectContainerResult | null>;
  duplicateProject?: (input: DuplicateProjectInput) => Promise<CreateProjectContainerResult | null>;
  importProjectPackage?: (input: { libraryId: string }) => Promise<ImportProjectPackageResult | null>;
  getProjectMetadata?: (libraryId: string, projectId: string) => Promise<ProjectMetadata | null>;
  updateProjectMetadata?: (input: UpdateProjectMetadataInput) => Promise<ProjectMetadata | null>;
  addProjectDesigns?: (input: { libraryId: string; projectId: string; designs: ProjectDesign[] }) => Promise<ProjectDesign[] | null>;
  listProjectDesigns?: (input: { libraryId: string; projectId: string }) => Promise<ProjectDesign[] | null>;
  loadProjectCanvasLayout?: (input: { libraryId: string; projectId: string }) => Promise<ProjectCanvasLayout | null>;
  saveProjectCanvasLayout?: (input: { libraryId: string; projectId: string; layout: ProjectCanvasLayout }) => Promise<ProjectCanvasLayout | null>;
  listTrashedProjects?: (libraryId: string) => Promise<TrashedProject[] | null>;
  moveProjectToTrash?: (input: TrashProjectInput) => Promise<TrashedProject | null>;
  restoreProjectFromTrash?: (input: TrashProjectInput) => Promise<RestoreProjectResult | null>;
  purgeProjectFromTrash?: (input: TrashProjectInput) => Promise<boolean | null>;
  createWorkspaceBackup?: (libraryId: string, destinationParentDirectory: string) => Promise<BackupArtifact | null>;
  restoreWorkspaceBackup?: (input: { backupDirectory: string; destinationParentDirectory: string }) => Promise<RestoreBackupResult | null>;
  loadWorkspaceSettings?: (libraryId: string) => Promise<WorkspaceSettings | null>;
  saveWorkspaceSettings?: (libraryId: string, settings: WorkspaceSettings) => Promise<boolean>;
  rebuildSearchIndex?: (libraryId: string, records: readonly SearchRecord[]) => Promise<boolean>;
  searchProjects?: (options: SearchQuery) => Promise<SearchIndexItem[] | null>;
  exportProjectPackage?: (input: { libraryId: string; projectId: string }) => Promise<{ path: string; sha256: string } | null>;
  loadDesignerState?: (libraryId: string) => Promise<DesignerLibraryState | null>;
  saveDesignerState?: (libraryId: string, state: DesignerLibraryState) => Promise<boolean>;
  readDesignerArtwork?: (input: { libraryId: string; artworkId: string }) => Promise<{ artworkId: string; dataUrl: string } | null>;
  loadBrandState?: (libraryId: string) => Promise<BrandLibraryState | null>;
  saveBrandState?: (libraryId: string, state: BrandLibraryState) => Promise<boolean>;
  listAssets?: (input: AssetStoreInput) => Promise<ManagedAsset[] | null>;
  importAssets?: (input: AssetImportInput) => Promise<AssetImportResult[] | null>;
  readAsset?: (input: AssetReadInput) => Promise<Uint8Array | null>;
  loadDocumentScene?: (libraryId: string, projectId: string, documentId: string) => Promise<DesignScene | null>;
  saveDocumentScene?: (input: { libraryId: string; projectId: string; documentId: string; scene: DesignScene }) => Promise<boolean>;
  loadDocumentRevisions?: (libraryId: string, projectId: string, documentId: string) => Promise<{ revisions: RevisionRecord[]; timeline: RevisionTimelineEvent[]; finalRevisionId: string | null } | null>;
  commitDocumentRevision?: (input: CommitRevisionInput & { libraryId: string }) => Promise<{ revisionId: string } | null>;
  setFinalDocumentRevision?: (input: { libraryId: string; projectId: string; documentId: string; revisionId: string }) => Promise<boolean | null>;
  storeCredential?: (connectionId: string, secret: string) => Promise<boolean>;
  deleteCredential?: (connectionId: string) => Promise<boolean>;
  hasCredential?: (connectionId: string) => Promise<boolean>;
  loadProviderConfigs?: () => Promise<ProviderConfigMap | null>;
  saveProviderConfig?: (input: ProviderConfigSaveInput) => Promise<boolean>;
  listTasks?: (libraryId: string) => Promise<TaskRecord[] | null>;
  submitConversation?: (input: ConversationTaskInput) => Promise<TaskRecord | null>;
  submitDesignGeneration?: (input: DesignGenerationInput & { libraryId: string }) => Promise<TaskRecord | null>;
  retryDesignGenerationSlot?: (input: DesignGenerationSlotRetryInput) => Promise<TaskRecord | null>;
  testConversation?: (input: { libraryId: string; connectionId: string; model?: string }) => Promise<ConversationTestResult | null>;
  inspectPortfolioSources?: (input: { libraryId: string; request: PortfolioInspectionRequest }) => Promise<PortfolioInspection | null>;
  submitPortfolioSelection?: (input: PortfolioSelectionInput) => Promise<TaskRecord | null>;
  discardPortfolioInspection?: (input: { libraryId: string; inspectionId: string }) => Promise<boolean>;
  submitImageGeneration?: (input: ImageGenerationInput & { libraryId: string }) => Promise<TaskRecord | null>;
  testImageGeneration?: (input: { libraryId: string; connectionId: string; prompt: string; model?: string; size?: string }) => Promise<ImageGenerationTestResult | null>;
  submitDesignerArtworkGeneration?: (input: DesignerArtworkGenerationInput & { libraryId: string }) => Promise<TaskRecord | null>;
  submitImageEdit?: (input: ImageEditInput & { libraryId: string }) => Promise<TaskRecord | null>;
  cancelTask?: (libraryId: string, taskId: string) => Promise<boolean>;
  retryTask?: (libraryId: string, taskId: string) => Promise<TaskRecord | null>;
  exportDocument?: (input: ExportDocumentInput) => Promise<{ path: string; sha256: string; archived?: boolean; archiveError?: string } | null>;
  listExportHistory?: (libraryId: string, projectId: string) => Promise<ExportHistoryRecord[] | null>;
  exportDiagnostics?: (input: { runtime: string; errorCode?: string | null }) => Promise<string | null>;
  chooseImageToolInput?: () => Promise<ImageToolSelection | null>;
  chooseImageToolOutput?: () => Promise<ImageToolSelection | null>;
  scanImageToolSources?: (input: { libraryId: string; sourcePath: string; outputRoot: string; tool: BatchImageTool; params: ToolParams }) => Promise<{ sourceRoot: string; source: 'file' | 'directory'; accepted: Array<{ absolutePath: string; relativePath: string; bytes?: number }>; rejected: Array<{ path: string; code: string; detail?: string }>; outputPaths: string[] } | null>;
  createImageToolJob?: (input: { libraryId: string; tool: BatchImageTool; params: ToolParams; sourcePath: string; outputRoot: string; connectionId?: string; modelId?: string }) => Promise<ImageToolJobSnapshot | null>;
  listImageToolJobs?: (libraryId: string) => Promise<ImageToolJobSnapshot[] | null>;
  getImageToolJob?: (input: { libraryId: string; jobId: string }) => Promise<ImageToolJobSnapshot | null>;
  pauseImageToolJob?: (input: { libraryId: string; jobId: string }) => Promise<ImageToolJobSnapshot | null>;
  resumeImageToolJob?: (input: { libraryId: string; jobId: string }) => Promise<ImageToolJobSnapshot | null>;
  cancelImageToolJob?: (input: { libraryId: string; jobId: string }) => Promise<ImageToolJobSnapshot | null>;
  retryImageToolItem?: (input: { libraryId: string; jobId: string; itemId: string }) => Promise<ImageToolJobSnapshot | null>;
  openImageToolResult?: (input: { libraryId: string; jobId: string; path: string }) => Promise<boolean>;
  revealImageToolResult?: (input: { libraryId: string; jobId: string; path: string }) => Promise<boolean>;
  openImageToolOutput?: (input: { libraryId: string; jobId: string; path: string }) => Promise<boolean>;
  importImageToolResult?: (input: { libraryId: string; projectId: string; jobId: string; path: string }) => Promise<ManagedAsset | null>;
};

declare global {
  interface Window {
    designhub: DesktopApi;
  }
}
