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
import { createProjectContainerHandler, getProjectMetadataHandler, listActiveProjectsHandler, projectCreateChannel, projectListChannel, projectMetadataGetChannel, projectMetadataUpdateChannel, updateProjectMetadataHandler } from './ipc/projects';
import { designerLoadChannel, designerSaveChannel, loadDesignerStateHandler, saveDesignerStateHandler } from './ipc/designers';
import { assetImportChannel, assetListChannel, assetReadChannel, importAssetsHandler, listAssetsHandler, readAssetHandler } from './ipc/assets';
import { createAssetStore } from './storage/asset-store';
import { loadDesignerState, saveDesignerState } from './storage/designer-store';
import { loadDocumentScene, saveDocumentScene } from './storage/scene-store';
import { loadDocumentSceneHandler, saveDocumentSceneHandler, sceneLoadChannel, sceneSaveChannel } from './ipc/scenes';
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
  ipcMain.handle(projectListChannel, async (event, workspaceId) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return listActiveProjectsHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace) => createProjectStore(workspace).listActiveProjects())(event, workspaceId);
  });
  ipcMain.handle(projectCreateChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return createProjectContainerHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, projectInput) => createProjectStore(workspace).createProjectContainer(projectInput))(event, input);
  });
  ipcMain.handle(projectMetadataGetChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return getProjectMetadataHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, projectId) => createProjectStore(workspace).getProjectMetadata(projectId))(event, input);
  });
  ipcMain.handle(projectMetadataUpdateChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return updateProjectMetadataHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, metadataInput) => createProjectStore(workspace).updateProjectMetadata(metadataInput))(event, input);
  });
  ipcMain.handle(designerLoadChannel, async (event, workspaceId) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return loadDesignerStateHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, loadDesignerState)(event, workspaceId);
  });
  ipcMain.handle(designerSaveChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return false;
    return saveDesignerStateHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, state) => saveDesignerState(workspace, workspace.workspace.workspaceId, state))(event, input);
  });
  ipcMain.handle(assetListChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return listAssetsHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, assetInput) => createAssetStore(workspace).listAssets(assetInput))(event, input);
  });
  ipcMain.handle(assetImportChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return importAssetsHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, assetInput) => createAssetStore(workspace).importAssets(assetInput))(event, input);
  });
  ipcMain.handle(assetReadChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return readAssetHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, assetInput) => createAssetStore(workspace).readAsset(assetInput))(event, input);
  });
  ipcMain.handle(sceneLoadChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return loadDocumentSceneHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, projectId, documentId) => loadDocumentScene(workspace, workspace.workspace.workspaceId, projectId, documentId))(event, input);
  });
  ipcMain.handle(sceneSaveChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return false;
    return saveDocumentSceneHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, projectId, documentId, scene) => saveDocumentScene(workspace, workspace.workspace.workspaceId, projectId, documentId, scene))(event, input);
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
