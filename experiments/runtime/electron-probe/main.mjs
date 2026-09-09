import { app, BrowserWindow, ipcMain } from 'electron';

let probeWindow = null;
const useSolidFallback = process.env.DESIGNHUB_PROBE_FORCE_SOLID === '1';
const requestedWindowConfiguration = {
  titleBarStyle: 'hidden',
  trafficLightPosition: { x: 12, y: 12 },
  requestedMacOSVibrancy: 'sidebar',
  solidFallbackBackground: '#17181c',
  transparent: false
};

const createProbeWindow = () => {
  probeWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    show: false,
    titleBarStyle: requestedWindowConfiguration.titleBarStyle,
    trafficLightPosition: requestedWindowConfiguration.trafficLightPosition,
    vibrancy: process.platform === 'darwin' && !useSolidFallback ? requestedWindowConfiguration.requestedMacOSVibrancy : undefined,
    visualEffectState: 'active',
    backgroundColor: requestedWindowConfiguration.solidFallbackBackground,
    transparent: requestedWindowConfiguration.transparent,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: new URL('./preload.cjs', import.meta.url).pathname
    }
  });

  probeWindow.loadFile(new URL('./renderer.html', import.meta.url).pathname);
  probeWindow.once('ready-to-show', () => probeWindow?.show());
  probeWindow.on('closed', () => {
    probeWindow = null;
  });
};

ipcMain.handle('probe:get-security-snapshot', (event) => {
  const isExpectedRenderer = event.senderFrame.url.startsWith('file:');

  if (!isExpectedRenderer || probeWindow === null || event.sender !== probeWindow.webContents) {
    throw new Error('Unexpected probe IPC sender');
  }

  return {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    nodeIntegration: probeWindow.webContents.getLastWebPreferences().nodeIntegration,
    contextIsolation: probeWindow.webContents.getLastWebPreferences().contextIsolation,
    sandbox: probeWindow.webContents.getLastWebPreferences().sandbox,
    requestedWindowConfiguration,
    activeMaterialMode: useSolidFallback ? 'solid-fallback-requested' : 'platform-material-requested'
  };
});

app.whenReady().then(createProbeWindow);

app.on('window-all-closed', () => {
  app.quit();
});
