import { contextBridge, ipcRenderer } from 'electron';

import type { DesktopApi } from '../platform/contracts';

const api: DesktopApi = {
  chooseWorkspaceDirectory: () => ipcRenderer.invoke('workspace:choose-directory') as Promise<string | null>
};

contextBridge.exposeInMainWorld('designhub', api);
