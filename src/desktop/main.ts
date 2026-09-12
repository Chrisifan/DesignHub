import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';

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
  createCredentialStatusHandler,
  createCredentialStoreHandler,
  credentialDeleteChannel,
  credentialStatusChannel,
  credentialStoreChannel,
} from './ipc/credentials';
import { recreateWindowOnActivate } from './lifecycle';
import { createProjectStore, resolveProjectDirectory } from './storage/project-store';
import { createProjectContainerHandler, duplicateProjectHandler, getProjectMetadataHandler, listActiveProjectsHandler, listTrashedProjectsHandler, moveProjectToTrashHandler, projectCreateChannel, projectDuplicateChannel, projectListChannel, projectListTrashChannel, projectMetadataGetChannel, projectMetadataUpdateChannel, projectPurgeTrashChannel, projectRestoreTrashChannel, projectTrashChannel, purgeProjectFromTrashHandler, restoreProjectFromTrashHandler, updateProjectMetadataHandler } from './ipc/projects';
import { designerLoadChannel, designerSaveChannel, loadDesignerStateHandler, saveDesignerStateHandler } from './ipc/designers';
import { brandLoadChannel, brandSaveChannel, loadBrandStateHandler, saveBrandStateHandler } from './ipc/brands';
import { assetImportChannel, assetListChannel, assetReadChannel, importAssetsHandler, listAssetsHandler, readAssetHandler } from './ipc/assets';
import { createAssetStore } from './storage/asset-store';
import { loadDesignerState, saveDesignerState } from './storage/designer-store';
import { loadBrandState, saveBrandState } from './storage/brand-store';
import { loadDocumentScene, saveDocumentScene } from './storage/scene-store';
import { commitDocumentRevision, loadDocumentRevisions, setFinalDocumentRevision } from './storage/revision-store';
import { loadDocumentSceneHandler, saveDocumentSceneHandler, sceneLoadChannel, sceneSaveChannel } from './ipc/scenes';
import { commitRevisionHandler, finalizeRevisionHandler, loadRevisionsHandler, revisionCommitChannel, revisionFinalizeChannel, revisionLoadChannel } from './ipc/revisions';
import { runStorageSmoke } from './storage/storage-smoke';
import { createWorkspace, openWorkspace } from './storage/workspace-store';
import type { WorkspaceHandle } from '../features/workspace/open-workspace';
import { createWindowOptions } from './window-options';
import { createCredentialBoundary, createUnavailableCredentialStore, type SystemCredentialStore, type CredentialBoundary } from './security/credentials';
import { listTasksHandler, taskListChannel } from './ipc/tasks';
import { loadTaskState } from './storage/task-store';
import { saveTaskState } from './storage/task-store';
import { createTaskRuntime, type TaskRuntime } from '../features/tasks/runtime';
import { createAgentTaskService, type AgentTaskService } from '../features/agent/task-service';
import { createOpenAICompatibleAdapter } from '../features/providers/adapter';
import { bindAgentTaskService, cancelTaskHandler, createConversationHandler, createImageEditHandler, createImageGenerationHandler, imageEditSubmitChannel, imageGenerationSubmitChannel, retryTaskHandler, taskCancelChannel, taskRetryChannel, conversationSubmitChannel } from './ipc/agent';
import { exportDocumentChannel, exportDocumentHandler } from './ipc/export';
import { exportSceneToFile } from './export-scene';
import { diagnosticsExportChannel, exportDiagnosticsHandler } from './ipc/diagnostics';
import { backupCreateChannel, backupRestoreChannel, createBackupHandler, restoreBackupHandler } from './ipc/backup';
import { createWorkspaceBackupStore } from './storage/backup-store';
import { loadWorkspaceSettings, saveWorkspaceSettings } from './storage/settings-store';
import { loadSettingsHandler, saveSettingsHandler, settingsLoadChannel, settingsSaveChannel } from './ipc/settings';
import { rebuildSearchHandler, searchQueryHandler, searchQueryChannel, searchRebuildChannel } from './ipc/search';
import { createSearchIndexStore } from './storage/search-index-store';
import { exportProjectPackageHandler, importProjectPackageHandler, projectPackageExportChannel, projectPackageImportChannel } from './ipc/package';
import { createProjectPackage, encodeProjectPackage } from '../features/delivery/project-package';
import { classifyPackageEntry, type PackageEntryKind } from '../features/delivery/package-policy';
import { appendWorkspaceExportHistory, loadWorkspaceExportHistory } from './storage/export-history-store';
import { exportHistoryListChannel, listExportHistoryHandler } from './ipc/export-history';

let activeWindow: BrowserWindow | null = null;
let activeTrustedUrl: string | null = null;
let activeWorkspaceHandle: WorkspaceHandle | null = null;
let taskServicePromise: Promise<AgentTaskService> | null = null;
let credentialStore: SystemCredentialStore = createUnavailableCredentialStore();
let credentialBoundary: CredentialBoundary = createCredentialBoundary(credentialStore);

const createElectronCredentialStore = (directory: string): SystemCredentialStore => {
  const file = join(directory, 'credentials.bin');
  let cache: Record<string, string> | null = null;
  const load = async (): Promise<Record<string, string>> => {
    if (cache) return cache;
    try {
      const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
      cache = parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {};
    } catch { cache = {}; }
    return cache;
  };
  const persist = async (next: Record<string, string>): Promise<void> => {
    await mkdir(directory, { recursive: true });
    const temporary = `${file}.tmp-${randomUUID()}`;
    try { await writeFile(temporary, JSON.stringify(next), { encoding: 'utf8', flag: 'wx' }); await rename(temporary, file); }
    catch (error) { await rm(temporary, { force: true }); throw error; }
  };
  return {
    setCredential: async (connectionId, secret) => {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('SYSTEM_CREDENTIAL_STORE_UNAVAILABLE');
      const current = await load();
      current[connectionId] = safeStorage.encryptString(secret).toString('base64');
      await persist(current);
    },
    deleteCredential: async (connectionId) => { const current = await load(); delete current[connectionId]; await persist(current); },
    getCredential: async (connectionId) => {
      if (!safeStorage.isEncryptionAvailable()) return null;
      const current = await load();
      const encoded = current[connectionId];
      if (!encoded) return null;
      try { return safeStorage.decryptString(Buffer.from(encoded, 'base64')); } catch { return null; }
    },
  };
};

export const createMainProjectStore = (workspace: WorkspaceHandle) => createProjectStore(workspace);

const collectProjectPackageEntries = (projectDirectory: string) => {
  const entries: Array<{ path: string; bytes: Uint8Array; kind: PackageEntryKind }> = [];
  const visit = (directory: string): void => {
    readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name)).forEach((entry) => {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('INVALID_PROJECT_PACKAGE_SOURCE');
      if (entry.isDirectory()) { visit(path); return; }
      if (!entry.isFile()) throw new Error('INVALID_PROJECT_PACKAGE_SOURCE');
      const relativePath = relative(projectDirectory, path).split(sep).join('/');
      entries.push({ path: relativePath, bytes: new Uint8Array(readFileSync(path)), kind: classifyPackageEntry(relativePath) });
    });
  };
  visit(projectDirectory);
  return entries;
};

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
  taskServicePromise = null;
  return workspace;
};

const getAgentTaskService = (): Promise<AgentTaskService> => {
  if (!activeWorkspaceHandle) return Promise.reject(new Error('WORKSPACE_NOT_OPEN'));
  if (taskServicePromise) return taskServicePromise;
  const workspace = activeWorkspaceHandle;
  taskServicePromise = (async () => {
    const initialTasks = await loadTaskState(workspace, workspace.workspace.workspaceId);
    const runtime: TaskRuntime = createTaskRuntime({
      initialTasks,
      persist: async (tasks) => {
        await saveTaskState(workspace, workspace.workspace.workspaceId, tasks);
      },
    });
    const service = createAgentTaskService({
      runtime,
      persistGeneratedImages: async ({ projectId, images }) => {
        const items = await Promise.all(images.map(async (image, index) => {
          const fromBase64 = image.base64 ? Buffer.from(image.base64, 'base64') : null;
          let bytes: Uint8Array;
          let mimeType = 'image/png';
          if (fromBase64) bytes = new Uint8Array(fromBase64);
          else if (image.url) {
            const response = await fetch(image.url);
            if (!response.ok) throw new Error('GENERATED_IMAGE_DOWNLOAD_FAILED');
            mimeType = response.headers.get('content-type')?.split(';', 1)[0] || mimeType;
            bytes = new Uint8Array(await response.arrayBuffer());
          } else throw new Error('GENERATED_IMAGE_EMPTY');
          const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
          return { name: `generated-${index + 1}.${extension}`, mimeType, data: bytes };
        }));
        const imported = await createAssetStore(workspace).importAssets({ workspaceId: workspace.workspace.workspaceId, projectId, items });
        const failures = imported.filter((result) => result.status === 'error');
        if (failures.length > 0) throw new Error(failures[0].error);
        return imported.filter((result): result is Extract<typeof result, { status: 'success' }> => result.status === 'success').map((result) => result.asset.id);
      },
      loadSourceImage: async ({ projectId, assetId }) => {
        const bytes = await createAssetStore(workspace).readAsset({ workspaceId: workspace.workspace.workspaceId, projectId, assetId });
        return bytes ? new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], { type: 'image/png' }) : null;
      },
      resolveAdapter: async (connectionId) => {
        if (connectionId !== 'openai-compatible') throw new Error('PROVIDER_NOT_CONFIGURED');
        const baseUrl = process.env.DESIGNHUB_PROVIDER_BASE_URL ?? '';
        const apiKey = await credentialStore.getCredential?.(connectionId) ?? process.env.DESIGNHUB_PROVIDER_API_KEY ?? '';
        return createOpenAICompatibleAdapter({ baseUrl, apiKey });
      },
    });
    return bindAgentTaskService(service);
  })();
  return taskServicePromise;
};

app.whenReady().then(() => {
  credentialStore = createElectronCredentialStore(join(app.getPath('userData'), 'secure'));
  credentialBoundary = createCredentialBoundary(credentialStore);
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
  ipcMain.handle(projectDuplicateChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return duplicateProjectHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, projectInput) => createProjectStore(workspace).duplicateProject(projectInput))(event, input);
  });
  ipcMain.handle(projectPackageExportChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return exportProjectPackageHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, async (workspace, projectId) => {
      const projectDirectory = resolveProjectDirectory(workspace, projectId);
      if (!projectDirectory) throw new Error('PROJECT_NOT_FOUND');
      const result = await dialog.showSaveDialog(activeWindow!, { defaultPath: `designhub-${projectId}.designhub.zip`, filters: [{ name: 'DesignHub package', extensions: ['zip'] }] });
      if (result.canceled || !result.filePath) return null;
      const packageData = await createProjectPackage({ packageId: randomUUID(), projectId, entries: collectProjectPackageEntries(projectDirectory) });
      const archive = await encodeProjectPackage(packageData);
      const { writeFile } = await import('node:fs/promises');
      await writeFile(result.filePath, archive, { flag: 'wx' });
      return { path: result.filePath, sha256: createHash('sha256').update(archive).digest('hex') };
    })(event, input);
  });
  ipcMain.handle(projectPackageImportChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return importProjectPackageHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, async (workspace) => {
      const result = await dialog.showOpenDialog(activeWindow!, { properties: ['openFile'], filters: [{ name: 'DesignHub package', extensions: ['zip'] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      const archive = await readFile(result.filePaths[0]);
      return createProjectStore(workspace).importProjectPackage({ workspaceId: workspace.workspace.workspaceId, operationId: randomUUID(), archive: new Uint8Array(archive) });
    })(event, input);
  });
  ipcMain.handle(projectMetadataGetChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return getProjectMetadataHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, projectId) => createProjectStore(workspace).getProjectMetadata(projectId))(event, input);
  });
  ipcMain.handle(projectMetadataUpdateChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return updateProjectMetadataHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, metadataInput) => createProjectStore(workspace).updateProjectMetadata(metadataInput))(event, input);
  });
  ipcMain.handle(projectListTrashChannel, async (event, workspaceId) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return listTrashedProjectsHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace) => createProjectStore(workspace).listTrashedProjects())(event, workspaceId);
  });
  ipcMain.handle(projectTrashChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return moveProjectToTrashHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, projectInput) => createProjectStore(workspace).moveProjectToTrash(projectInput))(event, input);
  });
  ipcMain.handle(projectRestoreTrashChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return restoreProjectFromTrashHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, projectInput) => createProjectStore(workspace).restoreProjectFromTrash(projectInput))(event, input);
  });
  ipcMain.handle(projectPurgeTrashChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return purgeProjectFromTrashHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, projectInput) => createProjectStore(workspace).purgeProjectFromTrash(projectInput))(event, input);
  });
  ipcMain.handle(designerLoadChannel, async (event, workspaceId) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return loadDesignerStateHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, loadDesignerState)(event, workspaceId);
  });
  ipcMain.handle(designerSaveChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return false;
    return saveDesignerStateHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, state) => saveDesignerState(workspace, workspace.workspace.workspaceId, state))(event, input);
  });
  ipcMain.handle(brandLoadChannel, async (event, workspaceId) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return loadBrandStateHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, loadBrandState)(event, workspaceId);
  });
  ipcMain.handle(brandSaveChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return false;
    return saveBrandStateHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, state) => saveBrandState(workspace, workspace.workspace.workspaceId, state))(event, input);
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
  ipcMain.handle(revisionLoadChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return loadRevisionsHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, target) => loadDocumentRevisions(workspace, target.workspaceId, target.projectId, target.documentId))(event, input);
  });
  ipcMain.handle(revisionCommitChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return commitRevisionHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, revisionInput) => commitDocumentRevision(workspace, revisionInput))(event, input);
  });
  ipcMain.handle(revisionFinalizeChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return finalizeRevisionHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, revisionInput) => setFinalDocumentRevision(workspace, revisionInput))(event, input);
  });
  ipcMain.handle(credentialStoreChannel, async (event, connectionId, secret) => {
    if (!activeWindow || !activeTrustedUrl) return false;
    return createCredentialStoreHandler(activeWindow, activeTrustedUrl, credentialBoundary)(event, connectionId, secret);
  });
  ipcMain.handle(credentialDeleteChannel, async (event, connectionId) => {
    if (!activeWindow || !activeTrustedUrl) return false;
    return createCredentialDeleteHandler(activeWindow, activeTrustedUrl, credentialBoundary)(event, connectionId);
  });
  ipcMain.handle(credentialStatusChannel, async (event, connectionId) => {
    if (!activeWindow || !activeTrustedUrl) return false;
    return createCredentialStatusHandler(activeWindow, activeTrustedUrl, credentialBoundary)(event, connectionId);
  });
  ipcMain.handle(taskListChannel, async (event, workspaceId) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return listTasksHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, loadTaskState)(event, workspaceId);
  });
  ipcMain.handle(conversationSubmitChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return createConversationHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, async (_workspace, conversation) => {
      const service = await getAgentTaskService();
      return service.submitConversation(conversation);
    })(event, input);
  });
  ipcMain.handle(imageGenerationSubmitChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return createImageGenerationHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, async (_workspace, imageInput) => {
      const service = await getAgentTaskService();
      return service.submitImageGeneration(imageInput);
    })(event, input);
  });
  ipcMain.handle(imageEditSubmitChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return createImageEditHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, async (_workspace, imageInput) => {
      const service = await getAgentTaskService();
      return service.submitImageEdit(imageInput);
    })(event, input);
  });
  ipcMain.handle(taskCancelChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return false;
    return cancelTaskHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, async (_workspace, taskId) => {
      const service = await getAgentTaskService();
      return Boolean(service.cancel(taskId));
    })(event, input);
  });
  ipcMain.handle(taskRetryChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return retryTaskHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, async (_workspace, taskId) => {
      const service = await getAgentTaskService();
      return service.retry(taskId);
    })(event, input);
  });
  ipcMain.handle(exportDocumentChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return exportDocumentHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, async (_workspace, exportInput) => {
      const extension = exportInput.format === 'jpeg' ? 'jpg' : exportInput.format;
      const result = await dialog.showSaveDialog(activeWindow!, {
        defaultPath: `designhub-${exportInput.documentId}.${extension}`,
        filters: [{ name: exportInput.format.toUpperCase(), extensions: [extension] }],
      });
      if (result.canceled || !result.filePath) return null;
      try {
        const exported = await exportSceneToFile({
          scene: exportInput.scene,
          format: exportInput.format,
          targetPath: result.filePath,
          background: exportInput.background,
          ...(exportInput.archiveCopy ? {
            archiveCopy: async ({ path }) => {
              if (_workspace.workspace.openMode !== 'writable') throw new Error('ARCHIVE_REQUIRES_WRITABLE');
              const projectDirectory = resolveProjectDirectory(_workspace, exportInput.projectId);
              if (!projectDirectory) throw new Error('PROJECT_NOT_FOUND');
              const archiveDirectory = join(projectDirectory, 'exports');
              await mkdir(archiveDirectory, { recursive: true });
              const archivePath = join(archiveDirectory, basename(path));
              await writeFile(archivePath, await readFile(path), { flag: 'wx' });
            },
          } : {}),
        });
        await appendWorkspaceExportHistory(_workspace, exportInput.workspaceId, {
          id: `export-${randomUUID()}`,
          projectId: exportInput.projectId,
          documentId: exportInput.documentId,
          revisionId: exportInput.scene.id,
          format: exportInput.format,
          targetPath: exported.path,
          sha256: exported.sha256,
          status: 'success',
          archived: exported.archived,
          ...(exported.archiveError ? { errorCode: exported.archiveError } : {}),
          createdAt: new Date().toISOString(),
        }).catch(() => undefined);
        return { path: exported.path, sha256: exported.sha256, archived: exported.archived, ...(exported.archiveError ? { archiveError: exported.archiveError } : {}) };
      } catch (error) {
        await appendWorkspaceExportHistory(_workspace, exportInput.workspaceId, {
          id: `export-${randomUUID()}`,
          projectId: exportInput.projectId,
          documentId: exportInput.documentId,
          revisionId: exportInput.scene.id,
          format: exportInput.format,
          targetPath: result.filePath,
          status: 'failed',
          archived: false,
          errorCode: error instanceof Error && error.message ? error.message : 'EXPORT_FAILED',
          createdAt: new Date().toISOString(),
        }).catch(() => undefined);
        throw error;
      }
    })(event, input);
  });
  ipcMain.handle(exportHistoryListChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return listExportHistoryHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, loadWorkspaceExportHistory)(event, input);
  });
  ipcMain.handle(diagnosticsExportChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return exportDiagnosticsHandler(activeWindow, activeTrustedUrl, async (diagnostic) => {
      const result = await dialog.showSaveDialog(activeWindow!, {
        defaultPath: 'designhub-diagnostics.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) return null;
      await writeFile(result.filePath, JSON.stringify(diagnostic, null, 2), 'utf8');
      return result.filePath;
    })(event, input);
  });
  ipcMain.handle(backupCreateChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return createBackupHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, (workspace, destinationParentDirectory) => createWorkspaceBackupStore(workspace).createBackup({ destinationParentDirectory }))(event, input);
  });
  ipcMain.handle(backupRestoreChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    if (!activeWorkspaceHandle) return null;
    return restoreBackupHandler(activeWindow, activeTrustedUrl, (restoreInput) => createWorkspaceBackupStore(activeWorkspaceHandle!).restoreBackup(restoreInput))(event, input);
  });
  ipcMain.handle(settingsLoadChannel, async (event, workspaceId) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return loadSettingsHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, loadWorkspaceSettings)(event, workspaceId);
  });
  ipcMain.handle(settingsSaveChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return false;
    return saveSettingsHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, saveWorkspaceSettings)(event, input);
  });
  ipcMain.handle(searchRebuildChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return false;
    return rebuildSearchHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, async (workspace, records) => {
      const store = createSearchIndexStore(workspace);
      try { await store.replace(records); } finally { store.close(); }
    })(event, input);
  });
  ipcMain.handle(searchQueryChannel, async (event, input) => {
    if (!activeWindow || !activeTrustedUrl) return null;
    return searchQueryHandler(activeWindow, activeTrustedUrl, () => activeWorkspaceHandle, async (workspace, options) => {
      const store = createSearchIndexStore(workspace);
      try { return await store.search(options); } finally { store.close(); }
    })(event, input);
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
