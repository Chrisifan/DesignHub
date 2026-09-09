import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopProbe', {
  getSecuritySnapshot: () => ipcRenderer.invoke('probe:get-security-snapshot')
});
