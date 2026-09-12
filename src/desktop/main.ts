import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createWorkspaceFromParentHandler,
  createWorkspaceHandler,
  openWorkspaceHandler,
  workspaceChannel,
  workspaceCreateChannel,
  workspaceOpenChannel,
} from './ipc/workspace';
import { createContentSecurityPolicy } from './csp';
import {
  createCredentialDeleteHandler,
  createCredentialStoreHandler,
  credentialDeleteChannel,
  credentialStoreChannel,
} from './ipc/credentials';
import { recreateWindowOnActivate } from './lifecycle';
import { createProjectStore } from './storage/project-store';
import { runStorageSmoke } from './storage/storage-smoke';
import { createWorkspace, openWorkspace } from './storage/workspace-store';
import type { WorkspaceHandle } from '../features/workspace/open-workspace';
import { createWindowOptions } from './window-options';
import { createCredentialBoundary, createUnavailableCredentialStore } from './security/credentials';

let activeWindow: BrowserWindow | null = null;
let activeTrustedUrl: string | null = null;
let activeWorkspaceHandle: WorkspaceHandle | null = null;
const credentialBoundary = createCredentialBoundary(createUnavailableCredentialStore());

export const createMainProjectStore = (workspace: WorkspaceHandle) => createProjectStore(workspace);

const storageSmokeResultPath = process.env.DESIGNHUB_STORAGE_SMOKE_RESULT;
const devServerUrl = typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === 'undefined' ? undefined : MAIN_WINDOW_VITE_DEV_SERVER_URL;

const createWindow = (): { window: BrowserWindow; trustedUrl: string } => {
  const options = createWindowOptions(process.platform);
  const window = new BrowserWindow({ ...options, webPreferences: { ...options.webPreferences, preload: join(__dirname, 'preload.cjs') } });
  const trustedUrl = devServerUrl ?? pathToFileURL(join(__dirname, '../renderer/index.html')).toString();
  const contentSecurityPolicy = createContentSecurityPolicy(Boolean(devServerUrl));
  window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [contentSecurityPolicy] } });
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== trustedUrl) event.preventDefault();
  });
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
  activeWindow = window;
  activeTrustedUrl = trustedUrl;
  window.on('closed', () => {
    if (activeWindow !== window) return;
    activeWindow = null;
    activeTrustedUrl = null;
    activeWorkspaceHandle?.close();
    activeWorkspaceHandle = null;
  });
  return { window, trustedUrl };
};

const activateWorkspace = (workspace: WorkspaceHandle): WorkspaceHandle => {
  activeWorkspaceHandle?.close();
  activeWorkspaceHandle = workspace;
  return workspace;
};

app.whenReady().then(() => {
  if (storageSmokeResultPath) {
    void runStorageSmoke(storageSmokeResultPath).finally(() => app.quit());
    return;
  }
  createWindow();
  ipcMain.handle(workspaceChannel, async (event) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return createWorkspaceHandler(activeWindow, activeTrustedUrl, (browserWindow) => dialog.showOpenDialog(browserWindow, { properties: ['openDirectory', 'createDirectory'] }))(event);
  });
  ipcMain.handle(workspaceCreateChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return createWorkspaceFromParentHandler(
      activeWindow,
      activeTrustedUrl,
      async (workspaceInput) => activateWorkspace(await createWorkspace(workspaceInput)),
    )(event, input);
  });
  ipcMain.handle(workspaceOpenChannel, async (event, directory) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return openWorkspaceHandler(
      activeWindow,
      activeTrustedUrl,
      async (workspaceDirectory) => activateWorkspace(await openWorkspace(workspaceDirectory)),
    )(event, directory);
  });
  ipcMain.handle(credentialStoreChannel, async (event, connectionId, secret) => {
    if (!activeWindow || !activeTrustedUrl) return false;
    return createCredentialStoreHandler(activeWindow, activeTrustedUrl, credentialBoundary)(event, connectionId, secret);
  });
  ipcMain.handle(credentialDeleteChannel, async (event, connectionId) => {
    if (!activeWindow || !activeTrustedUrl) return false;
    return createCredentialDeleteHandler(activeWindow, activeTrustedUrl, credentialBoundary)(event, connectionId);
  });
});

app.on('window-all-closed', () => {
  activeWorkspaceHandle?.close();
  activeWorkspaceHandle = null;
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  recreateWindowOnActivate(() => BrowserWindow.getAllWindows().length > 0, () => {
    createWindow();
  });
});
