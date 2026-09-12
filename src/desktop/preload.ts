import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopApi } from '../platform/contracts';
import { credentialDeleteChannel, credentialStoreChannel } from './ipc/credentials';

const api: DesktopApi = {
  chooseWorkspaceDirectory: () => ipcRenderer.invoke('workspace:choose-directory') as Promise<string | null>,
  createWorkspace: (input) => ipcRenderer.invoke('workspace:create', input),
  openWorkspace: (directory) => ipcRenderer.invoke('workspace:open', directory),
  storeCredential: (connectionId, secret) => ipcRenderer.invoke(credentialStoreChannel, connectionId, secret),
  deleteCredential: (connectionId) => ipcRenderer.invoke(credentialDeleteChannel, connectionId),
};

contextBridge.exposeInMainWorld('designhub', api);
