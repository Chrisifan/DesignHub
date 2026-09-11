import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopApi } from '../platform/contracts';

const api: DesktopApi = {
  chooseWorkspaceDirectory: () => ipcRenderer.invoke('workspace:choose-directory') as Promise<string | null>,
  createWorkspace: (input) => ipcRenderer.invoke('workspace:create', input),
  openWorkspace: (directory) => ipcRenderer.invoke('workspace:open', directory),
};

contextBridge.exposeInMainWorld('designhub', api);
