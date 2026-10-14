import { contextBridge, ipcRenderer } from 'electron';
import { providerStatusLoadChannel, providerStatusSaveChannel } from './ipc/providers';

import type { DesktopApi } from '../platform/contracts';
import { credentialDeleteChannel, credentialStatusChannel, credentialStoreChannel } from './ipc/credentials';
import { designerArtworkReadChannel, designerLoadChannel, designerSaveChannel } from './ipc/designers';
import { assetImportChannel, assetListChannel, assetReadChannel } from './ipc/assets';
import { taskListChannel } from './ipc/tasks';
import { conversationSubmitChannel, conversationTestChannel, designGenerationSlotRetryChannel, designGenerationSubmitChannel, designerArtworkGenerationSubmitChannel, imageEditSubmitChannel, imageGenerationSubmitChannel, imageGenerationTestChannel, taskCancelChannel, taskRetryChannel } from './ipc/agent';
import { portfolioDiscardChannel, portfolioInspectChannel, portfolioSelectChannel } from './ipc/portfolio';
import { exportProjectDesignChannel } from './ipc/export';
import { diagnosticsExportChannel } from './ipc/diagnostics';
import { backupChooseDirectoryChannel, backupCreateChannel, backupRestoreChannel } from './ipc/backup';
import { projectCanvasLayoutLoadChannel, projectCanvasLayoutSaveChannel, projectDesignsAddChannel, projectDesignsListChannel, projectListTrashChannel, projectTrashChannel, projectRestoreTrashChannel, projectPurgeTrashChannel } from './ipc/projects';
import { projectPackageImportChannel } from './ipc/package';
import { settingsLoadChannel, settingsSaveChannel } from './ipc/settings';
import { searchQueryChannel, searchRebuildChannel } from './ipc/search';
import { exportHistoryListChannel } from './ipc/export-history';
import { providerConfigLoadChannel, providerConfigSaveChannel } from './ipc/providers';
import { projectLibraryChooseChannel, projectLibraryStatusChannel } from './ipc/project-library';
import { profileLoadChannel, profileSaveChannel } from './ipc/profile';
import { imageToolCancelChannel, imageToolCancelItemChannel, imageToolChooseInputChannel, imageToolChooseOutputChannel, imageToolCreateChannel, imageToolGetChannel, imageToolImportResultChannel, imageToolListChannel, imageToolOpenOutputChannel, imageToolOpenResultChannel, imageToolPauseChannel, imageToolQueryChannel, imageToolReadResultChannel, imageToolResumeChannel, imageToolRetryChannel, imageToolRevealResultChannel, imageToolScanChannel } from './ipc/image-tools-channels';

const api: DesktopApi = {
  loadProfile: () => ipcRenderer.invoke(profileLoadChannel),
  saveProfile: (input) => ipcRenderer.invoke(profileSaveChannel, input),
  getProjectLibraryStatus: () => ipcRenderer.invoke(projectLibraryStatusChannel),
  chooseProjectLibrary: () => ipcRenderer.invoke(projectLibraryChooseChannel),
  listActiveProjects: (libraryId) => ipcRenderer.invoke('project:list-active', libraryId),
  createProjectContainer: (input) => ipcRenderer.invoke('project:create', input),
  duplicateProject: (input) => ipcRenderer.invoke('project:duplicate', input),
  importProjectPackage: (input) => ipcRenderer.invoke(projectPackageImportChannel, input),
  getProjectMetadata: (libraryId, projectId) => ipcRenderer.invoke('project:get-metadata', { libraryId, projectId }),
  updateProjectMetadata: (input) => ipcRenderer.invoke('project:update-metadata', input),
  addProjectDesigns: (input) => ipcRenderer.invoke(projectDesignsAddChannel, input),
  listProjectDesigns: (input) => ipcRenderer.invoke(projectDesignsListChannel, input),
  loadProjectCanvasLayout: (input) => ipcRenderer.invoke(projectCanvasLayoutLoadChannel, input),
  saveProjectCanvasLayout: (input) => ipcRenderer.invoke(projectCanvasLayoutSaveChannel, input),
  listTrashedProjects: (libraryId) => ipcRenderer.invoke(projectListTrashChannel, libraryId),
  moveProjectToTrash: (input) => ipcRenderer.invoke(projectTrashChannel, input),
  restoreProjectFromTrash: (input) => ipcRenderer.invoke(projectRestoreTrashChannel, input),
  purgeProjectFromTrash: (input) => ipcRenderer.invoke(projectPurgeTrashChannel, input),
  chooseWorkspaceBackupDirectory: (kind) => ipcRenderer.invoke(backupChooseDirectoryChannel, kind),
  createWorkspaceBackup: (libraryId, destinationParentDirectory) => ipcRenderer.invoke(backupCreateChannel, { libraryId, destinationParentDirectory }),
  restoreWorkspaceBackup: (input) => ipcRenderer.invoke(backupRestoreChannel, input),
  loadWorkspaceSettings: (libraryId) => ipcRenderer.invoke(settingsLoadChannel, libraryId),
  saveWorkspaceSettings: (libraryId, settings) => ipcRenderer.invoke(settingsSaveChannel, { libraryId, settings }),
  rebuildSearchIndex: (libraryId, records) => ipcRenderer.invoke(searchRebuildChannel, { libraryId, records }),
  searchProjects: (options) => ipcRenderer.invoke(searchQueryChannel, options),
  loadDesignerState: (libraryId) => ipcRenderer.invoke(designerLoadChannel, libraryId),
  saveDesignerState: (libraryId, state) => ipcRenderer.invoke(designerSaveChannel, { libraryId, state }),
  readDesignerArtwork: (input) => ipcRenderer.invoke(designerArtworkReadChannel, input),
  listAssets: (input) => ipcRenderer.invoke(assetListChannel, input),
  importAssets: (input) => ipcRenderer.invoke(assetImportChannel, input),
  readAsset: (input) => ipcRenderer.invoke(assetReadChannel, input),
  storeCredential: (connectionId, secret) => ipcRenderer.invoke(credentialStoreChannel, connectionId, secret),
  deleteCredential: (connectionId) => ipcRenderer.invoke(credentialDeleteChannel, connectionId),
  hasCredential: (connectionId) => ipcRenderer.invoke(credentialStatusChannel, connectionId),
  loadProviderConfigs: () => ipcRenderer.invoke(providerConfigLoadChannel),
  saveProviderConfig: (input) => ipcRenderer.invoke(providerConfigSaveChannel, input),
  loadProviderConnectionStatuses: () => ipcRenderer.invoke(providerStatusLoadChannel),
  saveProviderConnectionStatuses: (statuses) => ipcRenderer.invoke(providerStatusSaveChannel, statuses),
  listTasks: (libraryId) => ipcRenderer.invoke(taskListChannel, libraryId),
  submitConversation: (input) => ipcRenderer.invoke(conversationSubmitChannel, input),
  submitDesignGeneration: (input) => ipcRenderer.invoke(designGenerationSubmitChannel, input),
  retryDesignGenerationSlot: (input) => ipcRenderer.invoke(designGenerationSlotRetryChannel, input),
  testConversation: (input) => ipcRenderer.invoke(conversationTestChannel, input),
  inspectPortfolioSources: (input) => ipcRenderer.invoke(portfolioInspectChannel, input),
  submitPortfolioSelection: (input) => ipcRenderer.invoke(portfolioSelectChannel, input),
  discardPortfolioInspection: (input) => ipcRenderer.invoke(portfolioDiscardChannel, input),
  submitImageGeneration: (input) => ipcRenderer.invoke(imageGenerationSubmitChannel, input),
  testImageGeneration: (input) => ipcRenderer.invoke(imageGenerationTestChannel, input),
  submitDesignerArtworkGeneration: (input) => ipcRenderer.invoke(designerArtworkGenerationSubmitChannel, input),
  submitImageEdit: (input) => ipcRenderer.invoke(imageEditSubmitChannel, input),
  cancelTask: (libraryId, taskId) => ipcRenderer.invoke(taskCancelChannel, { libraryId, taskId }),
  retryTask: (libraryId, taskId) => ipcRenderer.invoke(taskRetryChannel, { libraryId, taskId }),
  exportProjectDesign: (input) => ipcRenderer.invoke(exportProjectDesignChannel, input),
  listExportHistory: (libraryId, projectId) => ipcRenderer.invoke(exportHistoryListChannel, { libraryId, projectId }),
  exportDiagnostics: (input) => ipcRenderer.invoke(diagnosticsExportChannel, input),
  chooseImageToolInput: () => ipcRenderer.invoke(imageToolChooseInputChannel),
  chooseImageToolOutput: () => ipcRenderer.invoke(imageToolChooseOutputChannel),
  scanImageToolSources: (input) => ipcRenderer.invoke(imageToolScanChannel, input),
  createImageToolJob: (input) => ipcRenderer.invoke(imageToolCreateChannel, input),
  listImageToolJobs: (libraryId) => ipcRenderer.invoke(imageToolListChannel, libraryId),
  getImageToolJob: (input) => ipcRenderer.invoke(imageToolGetChannel, input),
  pauseImageToolJob: (input) => ipcRenderer.invoke(imageToolPauseChannel, input),
  resumeImageToolJob: (input) => ipcRenderer.invoke(imageToolResumeChannel, input),
  cancelImageToolJob: (input) => ipcRenderer.invoke(imageToolCancelChannel, input),
  retryImageToolItem: (input) => ipcRenderer.invoke(imageToolRetryChannel, input),
  queryImageToolItem: (input) => ipcRenderer.invoke(imageToolQueryChannel, input),
  cancelImageToolItem: (input) => ipcRenderer.invoke(imageToolCancelItemChannel, input),
  readImageToolResult: (input) => ipcRenderer.invoke(imageToolReadResultChannel, input),
  openImageToolResult: (input) => ipcRenderer.invoke(imageToolOpenResultChannel, input),
  revealImageToolResult: (input) => ipcRenderer.invoke(imageToolRevealResultChannel, input),
  openImageToolOutput: (input) => ipcRenderer.invoke(imageToolOpenOutputChannel, input),
  importImageToolResult: (input) => ipcRenderer.invoke(imageToolImportResultChannel, input),
};

contextBridge.exposeInMainWorld('designhub', api);
