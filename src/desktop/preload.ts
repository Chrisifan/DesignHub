import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopApi } from '../platform/contracts';
import { credentialDeleteChannel, credentialStatusChannel, credentialStoreChannel } from './ipc/credentials';
import { designerLoadChannel, designerSaveChannel } from './ipc/designers';
import { assetImportChannel, assetListChannel, assetReadChannel } from './ipc/assets';
import { sceneLoadChannel, sceneSaveChannel } from './ipc/scenes';
import { taskListChannel } from './ipc/tasks';
import { conversationSubmitChannel, imageEditSubmitChannel, imageGenerationSubmitChannel, portfolioAnalysisSubmitChannel, taskCancelChannel, taskRetryChannel } from './ipc/agent';
import { exportDocumentChannel } from './ipc/export';
import { diagnosticsExportChannel } from './ipc/diagnostics';
import { backupCreateChannel, backupRestoreChannel } from './ipc/backup';
import { projectListTrashChannel, projectTrashChannel, projectRestoreTrashChannel, projectPurgeTrashChannel } from './ipc/projects';
import { projectPackageExportChannel, projectPackageImportChannel } from './ipc/package';
import { revisionCommitChannel, revisionFinalizeChannel, revisionLoadChannel } from './ipc/revisions';
import { brandLoadChannel, brandSaveChannel } from './ipc/brands';
import { settingsLoadChannel, settingsSaveChannel } from './ipc/settings';
import { searchQueryChannel, searchRebuildChannel } from './ipc/search';
import { exportHistoryListChannel } from './ipc/export-history';

const api: DesktopApi = {
  chooseWorkspaceDirectory: () => ipcRenderer.invoke('workspace:choose-directory') as Promise<string | null>,
  createWorkspace: (input) => ipcRenderer.invoke('workspace:create', input),
  openWorkspace: (directory) => ipcRenderer.invoke('workspace:open', directory),
  listActiveProjects: (workspaceId) => ipcRenderer.invoke('project:list-active', workspaceId),
  createProjectContainer: (input) => ipcRenderer.invoke('project:create', input),
  duplicateProject: (input) => ipcRenderer.invoke('project:duplicate', input),
  importProjectPackage: (input) => ipcRenderer.invoke(projectPackageImportChannel, input),
  getProjectMetadata: (workspaceId, projectId) => ipcRenderer.invoke('project:get-metadata', { workspaceId, projectId }),
  updateProjectMetadata: (input) => ipcRenderer.invoke('project:update-metadata', input),
  listTrashedProjects: (workspaceId) => ipcRenderer.invoke(projectListTrashChannel, workspaceId),
  moveProjectToTrash: (input) => ipcRenderer.invoke(projectTrashChannel, input),
  restoreProjectFromTrash: (input) => ipcRenderer.invoke(projectRestoreTrashChannel, input),
  purgeProjectFromTrash: (input) => ipcRenderer.invoke(projectPurgeTrashChannel, input),
  createWorkspaceBackup: (workspaceId, destinationParentDirectory) => ipcRenderer.invoke(backupCreateChannel, { workspaceId, destinationParentDirectory }),
  restoreWorkspaceBackup: (input) => ipcRenderer.invoke(backupRestoreChannel, input),
  loadWorkspaceSettings: (workspaceId) => ipcRenderer.invoke(settingsLoadChannel, workspaceId),
  saveWorkspaceSettings: (workspaceId, settings) => ipcRenderer.invoke(settingsSaveChannel, { workspaceId, settings }),
  rebuildSearchIndex: (workspaceId, records) => ipcRenderer.invoke(searchRebuildChannel, { workspaceId, records }),
  searchProjects: (options) => ipcRenderer.invoke(searchQueryChannel, options),
  exportProjectPackage: (input) => ipcRenderer.invoke(projectPackageExportChannel, input),
  loadDesignerState: (workspaceId) => ipcRenderer.invoke(designerLoadChannel, workspaceId),
  saveDesignerState: (workspaceId, state) => ipcRenderer.invoke(designerSaveChannel, { workspaceId, state }),
  loadBrandState: (workspaceId) => ipcRenderer.invoke(brandLoadChannel, workspaceId),
  saveBrandState: (workspaceId, state) => ipcRenderer.invoke(brandSaveChannel, { workspaceId, state }),
  listAssets: (input) => ipcRenderer.invoke(assetListChannel, input),
  importAssets: (input) => ipcRenderer.invoke(assetImportChannel, input),
  readAsset: (input) => ipcRenderer.invoke(assetReadChannel, input),
  loadDocumentScene: (workspaceId, projectId, documentId) => ipcRenderer.invoke(sceneLoadChannel, { workspaceId, projectId, documentId }),
  saveDocumentScene: (input) => ipcRenderer.invoke(sceneSaveChannel, input),
  loadDocumentRevisions: (workspaceId, projectId, documentId) => ipcRenderer.invoke(revisionLoadChannel, { workspaceId, projectId, documentId }),
  commitDocumentRevision: (input) => ipcRenderer.invoke(revisionCommitChannel, input),
  setFinalDocumentRevision: (input) => ipcRenderer.invoke(revisionFinalizeChannel, input),
  storeCredential: (connectionId, secret) => ipcRenderer.invoke(credentialStoreChannel, connectionId, secret),
  deleteCredential: (connectionId) => ipcRenderer.invoke(credentialDeleteChannel, connectionId),
  hasCredential: (connectionId) => ipcRenderer.invoke(credentialStatusChannel, connectionId),
  listTasks: (workspaceId) => ipcRenderer.invoke(taskListChannel, workspaceId),
  submitConversation: (input) => ipcRenderer.invoke(conversationSubmitChannel, input),
  submitPortfolioAnalysis: (input) => ipcRenderer.invoke(portfolioAnalysisSubmitChannel, input),
  submitImageGeneration: (input) => ipcRenderer.invoke(imageGenerationSubmitChannel, input),
  submitImageEdit: (input) => ipcRenderer.invoke(imageEditSubmitChannel, input),
  cancelTask: (workspaceId, taskId) => ipcRenderer.invoke(taskCancelChannel, { workspaceId, taskId }),
  retryTask: (workspaceId, taskId) => ipcRenderer.invoke(taskRetryChannel, { workspaceId, taskId }),
  exportDocument: (input) => ipcRenderer.invoke(exportDocumentChannel, input),
  listExportHistory: (workspaceId, projectId) => ipcRenderer.invoke(exportHistoryListChannel, { workspaceId, projectId }),
  exportDiagnostics: (input) => ipcRenderer.invoke(diagnosticsExportChannel, input),
};

contextBridge.exposeInMainWorld('designhub', api);
