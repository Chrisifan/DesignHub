import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopApi } from '../platform/contracts';
import { credentialDeleteChannel, credentialStoreChannel } from './ipc/credentials';
import { designerLoadChannel, designerSaveChannel } from './ipc/designers';

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
  storeCredential: (connectionId, secret) => ipcRenderer.invoke(credentialStoreChannel, connectionId, secret),
  deleteCredential: (connectionId) => ipcRenderer.invoke(credentialDeleteChannel, connectionId),
};

contextBridge.exposeInMainWorld('designhub', api);
