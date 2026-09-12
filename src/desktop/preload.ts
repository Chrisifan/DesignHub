import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopApi } from '../platform/contracts';
import { credentialDeleteChannel, credentialStoreChannel } from './ipc/credentials';
import { designerLoadChannel, designerSaveChannel } from './ipc/designers';
import { assetImportChannel, assetListChannel, assetReadChannel } from './ipc/assets';
import { sceneLoadChannel, sceneSaveChannel } from './ipc/scenes';
import { taskListChannel } from './ipc/tasks';
import { conversationSubmitChannel, taskCancelChannel, taskRetryChannel } from './ipc/agent';

const api: DesktopApi = {
  chooseWorkspaceDirectory: () => ipcRenderer.invoke('workspace:choose-directory') as Promise<string | null>,
  createWorkspace: (input) => ipcRenderer.invoke('workspace:create', input),
  openWorkspace: (directory) => ipcRenderer.invoke('workspace:open', directory),
  listActiveProjects: (workspaceId) => ipcRenderer.invoke('project:list-active', workspaceId),
  createProjectContainer: (input) => ipcRenderer.invoke('project:create', input),
  getProjectMetadata: (workspaceId, projectId) => ipcRenderer.invoke('project:get-metadata', { workspaceId, projectId }),
  updateProjectMetadata: (input) => ipcRenderer.invoke('project:update-metadata', input),
  loadDesignerState: (workspaceId) => ipcRenderer.invoke(designerLoadChannel, workspaceId),
  saveDesignerState: (workspaceId, state) => ipcRenderer.invoke(designerSaveChannel, { workspaceId, state }),
  listAssets: (input) => ipcRenderer.invoke(assetListChannel, input),
  importAssets: (input) => ipcRenderer.invoke(assetImportChannel, input),
  readAsset: (input) => ipcRenderer.invoke(assetReadChannel, input),
  loadDocumentScene: (workspaceId, projectId, documentId) => ipcRenderer.invoke(sceneLoadChannel, { workspaceId, projectId, documentId }),
  saveDocumentScene: (input) => ipcRenderer.invoke(sceneSaveChannel, input),
  storeCredential: (connectionId, secret) => ipcRenderer.invoke(credentialStoreChannel, connectionId, secret),
  deleteCredential: (connectionId) => ipcRenderer.invoke(credentialDeleteChannel, connectionId),
  listTasks: (workspaceId) => ipcRenderer.invoke(taskListChannel, workspaceId),
  submitConversation: (input) => ipcRenderer.invoke(conversationSubmitChannel, input),
  cancelTask: (workspaceId, taskId) => ipcRenderer.invoke(taskCancelChannel, { workspaceId, taskId }),
  retryTask: (workspaceId, taskId) => ipcRenderer.invoke(taskRetryChannel, { workspaceId, taskId }),
};

contextBridge.exposeInMainWorld('designhub', api);
