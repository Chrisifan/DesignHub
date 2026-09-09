const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopProbe', {
  getSecuritySnapshot: () => ipcRenderer.invoke('probe:get-security-snapshot')
});
