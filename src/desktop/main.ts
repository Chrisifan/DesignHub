import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createWorkspaceHandler, workspaceChannel } from './ipc/workspace';
import { recreateWindowOnActivate } from './lifecycle';
import { createWindowOptions } from './window-options';

let activeWindow: BrowserWindow | null = null;
let activeTrustedUrl: string | null = null;

const createWindow = (): { window: BrowserWindow; trustedUrl: string } => {
  const options = createWindowOptions(process.platform);
  const window = new BrowserWindow({ ...options, webPreferences: { ...options.webPreferences, preload: join(__dirname, 'preload.cjs') } });
  const trustedUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL ?? pathToFileURL(join(__dirname, '../renderer/index.html')).toString();
  window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': ["default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'"] } });
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== trustedUrl) event.preventDefault();
  });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
  activeWindow = window;
  activeTrustedUrl = trustedUrl;
  return { window, trustedUrl };
};

app.whenReady().then(() => {
  createWindow();
  ipcMain.handle(workspaceChannel, async (event) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return createWorkspaceHandler(activeWindow, activeTrustedUrl, (browserWindow) => dialog.showOpenDialog(browserWindow, { properties: ['openDirectory', 'createDirectory'] }))(event);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  recreateWindowOnActivate(() => BrowserWindow.getAllWindows().length > 0, () => {
    createWindow();
  });
});
