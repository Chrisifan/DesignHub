import { app, BrowserWindow, dialog, ipcMain, protocol, safeStorage, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createContentSecurityPolicy } from './csp';
import { createDesignerArtworkProtocolHandler, designerArtworkScheme } from './artwork-protocol';
import { registerCredentialHandlers } from './ipc/register-credentials';
import { recreateWindowOnActivate } from './lifecycle';
import { createProjectStore, resolveProjectDirectory } from './storage/project-store';
import type { ProjectLibraryHandle } from '../features/project-library/open-project-library';
import { registerProjectHandlers } from './ipc/register-projects';
import { registerContentHandlers } from './ipc/register-content-handlers';
import { createAssetStore } from './storage/asset-store';
import { loadDesignerState, readDesignerArtwork, saveDesignerState } from './storage/designer-store';
import { loadBrandState, saveBrandState } from './storage/brand-store';
import { loadDocumentScene, saveDocumentScene } from './storage/scene-store';
import { commitDocumentRevision, loadDocumentRevisions, setFinalDocumentRevision } from './storage/revision-store';
import { runStorageSmoke } from './storage/storage-smoke';
import { createWindowOptions } from './window-options';
import { createCredentialBoundary, createUnavailableCredentialStore, type SystemCredentialStore, type CredentialBoundary } from './security/credentials';
import { createKeyringCredentialStore, migrateLegacyCredentials, migrateLegacyProviderCredential } from './security/keyring-credentials';
import { registerTaskHandlers } from './ipc/register-task-handlers';
import { loadTaskState } from './storage/task-store';
import { type AgentTaskService } from '../features/agent/task-service';
import type { GeneratedImage } from '../features/providers/adapter';
import { bindAgentTaskService } from './ipc/agent';
import { registerAgentHandlers } from './ipc/register-agent';
import { createPortfolioSourceInspector } from './portfolio-source-inspector';
import { registerPortfolioHandlers } from './ipc/register-portfolio';
import { registerExportHandlers } from './ipc/register-export';
import { exportSceneToFile } from './export-scene';
import { registerSupportHandlers } from './ipc/register-support-handlers';
import { createWorkspaceBackupStore } from './storage/backup-store';
import { loadWorkspaceSettings, saveWorkspaceSettings } from './storage/settings-store';
import { registerSearchHandlers } from './ipc/register-search';
import { createSearchIndexStore } from './storage/search-index-store';
import { registerProjectPackageHandlers } from './ipc/register-project-package';
import { appendWorkspaceExportHistory, loadWorkspaceExportHistory } from './storage/export-history-store';
import { loadProviderConfigs, saveProviderConfigs } from './security/provider-config';
import { loadProviderConnectionStatuses, saveProviderConnectionStatuses } from './security/provider-status';
import { registerSettingsProviderHandlers } from './ipc/register-settings-provider';
import { createProjectLibraryLifecycleHandlers } from './ipc/project-library';
import { registerProjectLibraryHandlers } from './ipc/register-project-library';
import { createProjectLibrarySettingsStore } from './storage/project-library-settings-store';
import { initializeProjectLibrary, openProjectLibrary } from './storage/project-library-store';
import { createProfileStore } from './storage/profile-store';
import { normalizeProfileAvatar } from './profile-avatar';
import { registerProfileHandlers } from './ipc/register-profile';
import { createImageToolIpcHandlers } from './ipc/image-tools';
import { registerImageToolIpcHandlers } from './ipc/register-image-tools';
import { createAgentTaskServiceForLibrary } from './services/task-service-factory';
import { createImageToolService } from './services/image-tool-service';
import { createProjectPackageService } from './services/project-package-service';

protocol.registerSchemesAsPrivileged([
  {
    scheme: designerArtworkScheme,
    privileges: { secure: true, standard: true },
  },
]);

const testUserDataDirectory = process.env.DESIGNHUB_TEST_USER_DATA;
if (testUserDataDirectory) app.setPath('userData', testUserDataDirectory);

let activeWindow: BrowserWindow | null = null;
let activeTrustedUrl: string | null = null;
let activeProjectLibraryHandle: ProjectLibraryHandle | null = null;
let taskServicePromise: Promise<AgentTaskService> | null = null;
let credentialStore: SystemCredentialStore = createUnavailableCredentialStore();
let credentialBoundary: CredentialBoundary = createCredentialBoundary(credentialStore);
const portfolioSourceInspector = createPortfolioSourceInspector();

const providerConfigPath = (): string => join(app.getPath('userData'), 'provider-connections.json');

const closeActiveProjectLibrary = (): void => {
  activeProjectLibraryHandle?.close();
  activeProjectLibraryHandle = null;
};

const activateProjectLibrary = (handle: ProjectLibraryHandle): void => {
  closeActiveProjectLibrary();
  activeProjectLibraryHandle = handle;
  taskServicePromise = null;
};

const generatedImageBytes = async (image: GeneratedImage): Promise<{ bytes: Uint8Array; mimeType: string }> => {
  if (image.base64) {
    const dataUrl = image.base64.match(/^data:([^;,]+);base64,(.*)$/su);
    const encoded = dataUrl ? dataUrl[2].replace(/\s+/gu, '') : image.base64.replace(/\s+/gu, '');
    const fromBase64 = Buffer.from(encoded, 'base64');
    if (fromBase64.length > 0) {
      const mimeType = image.mimeType ?? (dataUrl?.[1].toLowerCase() || 'image/png');
      return { bytes: new Uint8Array(fromBase64), mimeType };
    }
  }
  if (!image.url) throw new Error('GENERATED_IMAGE_EMPTY');
  const response = await fetch(image.url);
  if (!response.ok) throw new Error('GENERATED_IMAGE_DOWNLOAD_FAILED');
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType: response.headers.get('content-type')?.split(';', 1)[0] || 'image/png',
  };
};

const createSystemCredentialStore = async (): Promise<SystemCredentialStore> => {
  try {
    const { Entry } = await import('@napi-rs/keyring');
    return createKeyringCredentialStore((service, account) => new Entry(service, account));
  } catch {
    return createUnavailableCredentialStore();
  }
};

const migrateLegacyCredentialFile = async (directory: string, store: SystemCredentialStore): Promise<void> => {
  const file = join(directory, 'credentials.bin');
  await migrateLegacyCredentials({
    read: async () => {
      try {
        const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        const values = Object.entries(parsed);
        if (!values.every(([connectionId, value]) => connectionId.trim() && typeof value === 'string' && value.length > 0)) return null;
        return Object.fromEntries(values) as Record<string, string>;
      } catch {
        return null;
      }
    },
    remove: async () => { await rm(file, { force: true }); },
    decrypt: (value) => {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('SYSTEM_CREDENTIAL_STORE_UNAVAILABLE');
      return safeStorage.decryptString(Buffer.from(value, 'base64'));
    },
    store,
  });
};

export const createMainProjectStore = (library: ProjectLibraryHandle) => createProjectStore(library);

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
    closeActiveProjectLibrary();
    portfolioSourceInspector.discardAll();
  });
  return { window, trustedUrl };
};

const getAgentTaskService = (): Promise<AgentTaskService> => {
  if (!activeProjectLibraryHandle) return Promise.reject(new Error('PROJECT_LIBRARY_NOT_OPEN'));
  if (taskServicePromise) return taskServicePromise;
  taskServicePromise = createAgentTaskServiceForLibrary({
    workspace: activeProjectLibraryHandle,
    credentialStore,
    providerConfigPath: providerConfigPath(),
    generatedImageBytes,
  }).then(bindAgentTaskService);
  return taskServicePromise;
};

app.whenReady().then(async () => {
  credentialStore = await createSystemCredentialStore();
  credentialBoundary = createCredentialBoundary(credentialStore);
  await migrateLegacyProviderCredential(credentialStore, 'openai-compatible');
  await migrateLegacyCredentialFile(join(app.getPath('userData'), 'secure'), credentialStore);
  protocol.handle(
    designerArtworkScheme,
    createDesignerArtworkProtocolHandler(
      () => activeProjectLibraryHandle,
      readDesignerArtwork,
    ),
  );
  if (storageSmokeResultPath) {
    void runStorageSmoke(storageSmokeResultPath).finally(() => app.quit());
    return;
  }
  createWindow();
  const projectLibrarySettings = createProjectLibrarySettingsStore(app.getPath('userData'));
  const profileStore = createProfileStore(app.getPath('userData'));
  const imageToolService = createImageToolService({ credentialStore, providerConfigPath: providerConfigPath(), generatedImageBytes });
  const projectPackageService = createProjectPackageService({
    getWindow: () => activeWindow,
    showSaveDialog: (window, options) => dialog.showSaveDialog(window, options),
    showOpenDialog: (window, options) => dialog.showOpenDialog(window, options),
    readArchive: async (path) => new Uint8Array(await readFile(path)),
  });
  const imageToolHandlers = createImageToolIpcHandlers({
    window: { webContents: activeWindow!.webContents },
    trustedUrl: activeTrustedUrl!,
    getLibrary: () => activeProjectLibraryHandle,
    showDialog: (browserWindow, properties) => dialog.showOpenDialog(browserWindow, { properties: properties as Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory' | 'promptToCreate' | 'noResolveAliases' | 'treatPackageAsDirectory'> }),
    openPath: (path) => shell.openPath(path),
    revealPath: (path) => shell.showItemInFolder(path),
    importAsset: imageToolService.importAsset,
    executeProvider: imageToolService.executeProvider,
  });
  const createProjectLibraryHandlers = () => createProjectLibraryLifecycleHandlers({
    window: activeWindow!,
    trustedUrl: activeTrustedUrl!,
    loadDirectory: projectLibrarySettings.loadProjectLibraryDirectory,
    saveDirectory: projectLibrarySettings.saveProjectLibraryDirectory,
    showDirectoryDialog: (browserWindow) => dialog.showOpenDialog(browserWindow, { properties: ['openDirectory', 'createDirectory'] }),
    open: openProjectLibrary,
    initialize: initializeProjectLibrary,
    getActiveHandle: () => activeProjectLibraryHandle,
    activate: activateProjectLibrary,
  });
  registerProjectLibraryHandlers({
    ipc: ipcMain,
    getWindow: () => activeWindow,
    getTrustedUrl: () => activeTrustedUrl,
    createHandlers: createProjectLibraryHandlers,
  });
  registerImageToolIpcHandlers({ ipc: ipcMain, getWindow: () => activeWindow, handlers: imageToolHandlers as never });
  registerProfileHandlers({
    ipc: ipcMain,
    getWindow: () => activeWindow,
    getTrustedUrl: () => activeTrustedUrl,
    store: profileStore,
    normalizeAvatar: normalizeProfileAvatar,
    hasActiveProjectLibrary: () => activeProjectLibraryHandle !== null,
  });
  registerProjectHandlers({
    ipc: ipcMain,
    getWindow: () => activeWindow,
    getTrustedUrl: () => activeTrustedUrl,
    getLibrary: () => activeProjectLibraryHandle,
    listProjects: (workspace) => createProjectStore(workspace).listActiveProjects(),
    createProject: (workspace, input) => createProjectStore(workspace).createProjectContainer(input),
    duplicateProject: (workspace, input) => createProjectStore(workspace).duplicateProject(input),
    getMetadata: (workspace, projectId) => createProjectStore(workspace).getProjectMetadata(projectId),
    updateMetadata: (workspace, input) => createProjectStore(workspace).updateProjectMetadata(input),
    addDesigns: (workspace, input) => createProjectStore(workspace).addProjectDesigns(input),
    listDesigns: (workspace, input) => createProjectStore(workspace).listProjectDesigns(input),
    loadCanvasLayout: (workspace, input) => createProjectStore(workspace).loadProjectCanvasLayout(input),
    saveCanvasLayout: (workspace, input) => createProjectStore(workspace).saveProjectCanvasLayout(input),
    listTrashed: (workspace) => createProjectStore(workspace).listTrashedProjects(),
    moveToTrash: (workspace, input) => createProjectStore(workspace).moveProjectToTrash(input),
    restoreFromTrash: (workspace, input) => createProjectStore(workspace).restoreProjectFromTrash(input),
    purgeFromTrash: (workspace, input) => createProjectStore(workspace).purgeProjectFromTrash(input),
  });
  registerProjectPackageHandlers({
    ipc: ipcMain,
    getWindow: () => activeWindow,
    getTrustedUrl: () => activeTrustedUrl,
    getLibrary: () => activeProjectLibraryHandle,
    exportPackage: projectPackageService.exportPackage,
    importPackage: projectPackageService.importPackage,
  });
  registerContentHandlers({
    ipc: ipcMain,
    getWindow: () => activeWindow,
    getTrustedUrl: () => activeTrustedUrl,
    getLibrary: () => activeProjectLibraryHandle,
    loadDesigner: loadDesignerState,
    saveDesigner: (workspace, state) => saveDesignerState(workspace, workspace.library.libraryId, state),
    readArtwork: readDesignerArtwork,
    loadBrand: loadBrandState,
    saveBrand: (workspace, state) => saveBrandState(workspace, workspace.library.libraryId, state),
    listAssets: (workspace, input) => createAssetStore(workspace).listAssets(input),
    importAssets: (workspace, input) => createAssetStore(workspace).importAssets(input),
    readAsset: (workspace, input) => createAssetStore(workspace).readAsset(input),
    loadScene: (workspace, projectId, documentId) => loadDocumentScene(workspace, workspace.library.libraryId, projectId, documentId),
    saveScene: (workspace, projectId, documentId, scene) => saveDocumentScene(workspace, workspace.library.libraryId, projectId, documentId, scene),
    loadRevisions: (workspace, target) => loadDocumentRevisions(workspace, target.libraryId, target.projectId, target.documentId),
    commitRevision: (workspace, input) => commitDocumentRevision(workspace, { ...input, workspaceId: input.libraryId }),
    finalizeRevision: (workspace, input) => setFinalDocumentRevision(workspace, { ...input, workspaceId: input.libraryId }),
  });
  registerCredentialHandlers({
    ipc: ipcMain,
    getWindow: () => activeWindow,
    getTrustedUrl: () => activeTrustedUrl,
    boundary: credentialBoundary,
  });
  registerSettingsProviderHandlers({
    ipc: ipcMain,
    getWindow: () => activeWindow,
    getTrustedUrl: () => activeTrustedUrl,
    getLibrary: () => activeProjectLibraryHandle,
    loadSettings: loadWorkspaceSettings,
    saveSettings: saveWorkspaceSettings,
    loadProviderConfigs: () => loadProviderConfigs(providerConfigPath()),
    saveProviderConfig: async (saveInput) => {
      const current = await loadProviderConfigs(providerConfigPath());
      return saveProviderConfigs(providerConfigPath(), { ...current, [saveInput.connectionId]: saveInput.config });
    },
    loadProviderStatuses: () => loadProviderConnectionStatuses(join(app.getPath('userData'), 'provider-status.json')),
    saveProviderStatuses: (statuses) => saveProviderConnectionStatuses(join(app.getPath('userData'), 'provider-status.json'), statuses),
  });
  registerTaskHandlers({
    ipc: ipcMain,
    getWindow: () => activeWindow,
    getTrustedUrl: () => activeTrustedUrl,
    getLibrary: () => activeProjectLibraryHandle,
    loadTasks: loadTaskState,
    publishComposition: async (workspace, publishInput) => {
      const metadata = await createProjectStore(workspace).getProjectMetadata(publishInput.projectId);
      if (!metadata || metadata.workspaceId !== publishInput.libraryId || !metadata.documents.some((document) => document.id === publishInput.documentId)) {
        throw new Error('DOCUMENT_NOT_FOUND');
      }
      const storedAssets = await createAssetStore(workspace).listAssets({
        libraryId: publishInput.libraryId,
        projectId: publishInput.projectId,
        includeContextAssets: true,
      });
      const availableAssetIds = new Set(storedAssets.map((asset) => asset.id));
      const referencedAssetIds = new Set([
        ...publishInput.candidate.assets.map((asset) => asset.assetId),
        ...publishInput.candidate.scene.layers.flatMap((layer) => layer.type === 'image' ? [layer.assetId] : []),
      ]);
      if ([...referencedAssetIds].some((assetId) => !availableAssetIds.has(assetId))) throw new Error('CANDIDATE_ASSET_MISSING');
      const service = await getAgentTaskService();
      return service.publishCompositionCandidate(publishInput);
    },
    resolveComposition: async (workspace, taskId, resolution) => {
      const service = await getAgentTaskService();
      const task = service.getTask(taskId);
      if (!task || task.source?.kind !== 'project' || !task.documentId) throw new Error('COMPOSITION_CANDIDATE_REQUIRED');
      const metadata = await createProjectStore(workspace).getProjectMetadata(task.source.id);
      if (!metadata || metadata.workspaceId !== workspace.library.libraryId || !metadata.documents.some((document) => document.id === task.documentId)) {
        throw new Error('DOCUMENT_NOT_FOUND');
      }
      return service.resolveCompositionCandidate(taskId, resolution);
    },
  });
  registerPortfolioHandlers({
    ipc: ipcMain,
    getWindow: () => activeWindow,
    getTrustedUrl: () => activeTrustedUrl,
    getLibrary: () => activeProjectLibraryHandle,
    chooseFiles: async (window) => {
      const result = await dialog.showOpenDialog(window, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Portfolio images or ZIP', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'zip'] }],
      });
      return result.canceled ? null : result.filePaths;
    },
    inspector: portfolioSourceInspector,
    submit: async (_workspace, portfolioInput) => {
      const service = await getAgentTaskService();
      return service.submitPortfolioAnalysis(portfolioInput);
    },
  });
  registerAgentHandlers({
    ipc: ipcMain,
    getWindow: () => activeWindow,
    getTrustedUrl: () => activeTrustedUrl,
    getLibrary: () => activeProjectLibraryHandle,
    submitConversation: async (workspace, conversation) => {
      if (conversation.projectId) {
        const projectStore = createProjectStore(workspace);
        const metadata = await projectStore.getProjectMetadata(conversation.projectId);
        if (!metadata || metadata.workspaceId !== conversation.libraryId) throw new Error('PROJECT_NOT_FOUND');
        if (conversation.documentId && !metadata.documents.some((document) => document.id === conversation.documentId)) throw new Error('DOCUMENT_NOT_FOUND');
        if (conversation.referencedAssetIds?.length) {
          const assetStore = createAssetStore(workspace);
        const assets = await assetStore.listAssets({ libraryId: conversation.libraryId, projectId: conversation.projectId, includeContextAssets: true });
          const available = new Set(assets.map((asset) => asset.id));
          if (conversation.referencedAssetIds.some((assetId) => !available.has(assetId))) throw new Error('CONTEXT_ASSET_MISSING');
        }
      }
      const service = await getAgentTaskService();
      return service.submitConversation(conversation);
    },
    submitDesignGeneration: async (workspace, generationInput) => {
      const projectStore = createProjectStore(workspace);
      const metadata = await projectStore.getProjectMetadata(generationInput.projectId);
      if (!metadata || metadata.workspaceId !== generationInput.libraryId || (generationInput.documentId && !metadata.documents.some((document) => document.id === generationInput.documentId))) {
        throw new Error('DOCUMENT_NOT_FOUND');
      }
      if (generationInput.baseRevisionId && generationInput.documentId) {
        const revisions = await loadDocumentRevisions(workspace, generationInput.libraryId, generationInput.projectId, generationInput.documentId);
        if (!revisions.revisions.some((revision) => revision.revisionId === generationInput.baseRevisionId)) throw new Error('REVISION_NOT_FOUND');
      }
      const service = await getAgentTaskService();
      return service.submitDesignGeneration(generationInput);
    },
    retryDesignGenerationSlot: async (workspace, retryInput) => {
      const service = await getAgentTaskService();
      const existing = service.getTask(retryInput.taskId);
      if (!existing || existing.source?.kind !== 'project') throw new Error('DESIGN_GENERATION_TASK_REQUIRED');
      const metadata = await createProjectStore(workspace).getProjectMetadata(existing.source.id);
      if (!metadata || metadata.workspaceId !== retryInput.libraryId || (existing.documentId && !metadata.documents.some((document) => document.id === existing.documentId))) throw new Error('DOCUMENT_NOT_FOUND');
      return service.retryDesignGenerationSlot(retryInput);
    },
    testConversation: async (_workspace, testInput) => {
      const service = await getAgentTaskService();
      return service.testConversation(testInput);
    },
    submitImageGeneration: async (_workspace, imageInput) => {
      const service = await getAgentTaskService();
      return service.submitImageGeneration(imageInput);
    },
    testImageGeneration: async (_workspace, testInput) => {
      const service = await getAgentTaskService();
      const result = await service.testImageGeneration(testInput);
      if (!result.image.url) return result;
      const generated = await generatedImageBytes(result.image);
      return {
        image: { base64: Buffer.from(generated.bytes).toString('base64'), mimeType: generated.mimeType },
        cost: result.cost,
      };
    },
    submitDesignerArtworkGeneration: async (_workspace, artworkInput) => {
      const service = await getAgentTaskService();
      return service.submitDesignerArtworkGeneration(artworkInput);
    },
    submitImageEdit: async (_workspace, imageInput) => {
      const service = await getAgentTaskService();
      return service.submitImageEdit(imageInput);
    },
    cancelTask: async (_workspace, taskId) => {
      const service = await getAgentTaskService();
      return Boolean(service.cancel(taskId));
    },
    retryTask: async (_workspace, taskId) => {
      const service = await getAgentTaskService();
      return service.retry(taskId);
    },
  });
  registerExportHandlers({
    ipc: ipcMain,
    getWindow: () => activeWindow,
    getTrustedUrl: () => activeTrustedUrl,
    getLibrary: () => activeProjectLibraryHandle,
    exportDocument: async (_workspace, exportInput) => {
      const extension = exportInput.format === 'jpeg' ? 'jpg' : exportInput.format;
      const result = await dialog.showSaveDialog(activeWindow!, {
        defaultPath: `designhub-${exportInput.documentId}.${extension}`,
        filters: [{ name: exportInput.format.toUpperCase(), extensions: [extension] }],
      });
      if (result.canceled || !result.filePath) return null;
      try {
        const assetStore = createAssetStore(_workspace);
        const assetsById = new Map((await assetStore.listAssets({
          libraryId: exportInput.libraryId,
          projectId: exportInput.projectId,
          includeContextAssets: true,
        })).map((asset) => [asset.id, asset]));
        const exported = await exportSceneToFile({
          scene: exportInput.scene,
          format: exportInput.format,
          targetPath: result.filePath,
          background: exportInput.background,
          resolveImageAsset: async (assetId) => {
            const asset = assetsById.get(assetId);
            if (!asset?.managed) return null;
            const bytes = await assetStore.readAsset({
              libraryId: exportInput.libraryId,
              projectId: exportInput.projectId,
              assetId,
            });
            return bytes ? { bytes, mimeType: asset.mimeType } : null;
          },
          ...(exportInput.archiveCopy ? {
            archiveCopy: async ({ path }) => {
              if (_workspace.library.openMode !== 'writable') throw new Error('ARCHIVE_REQUIRES_WRITABLE');
              const projectDirectory = resolveProjectDirectory(_workspace, exportInput.projectId);
              if (!projectDirectory) throw new Error('PROJECT_NOT_FOUND');
              const archiveDirectory = join(projectDirectory, 'exports');
              await mkdir(archiveDirectory, { recursive: true });
              const archivePath = join(archiveDirectory, basename(path));
              await writeFile(archivePath, await readFile(path), { flag: 'wx' });
            },
          } : {}),
        });
        await appendWorkspaceExportHistory(_workspace, exportInput.libraryId, {
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
        await appendWorkspaceExportHistory(_workspace, exportInput.libraryId, {
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
    },
  });
  registerSupportHandlers({
    ipc: ipcMain,
    getWindow: () => activeWindow,
    getTrustedUrl: () => activeTrustedUrl,
    getLibrary: () => activeProjectLibraryHandle,
    showDirectoryDialog: (window, properties) => dialog.showOpenDialog(window, {
      properties: properties as Array<'openDirectory' | 'createDirectory' | 'treatPackageAsDirectory'>,
    }),
    loadExportHistory: async (workspace, libraryId, projectId) => {
      const records = await loadWorkspaceExportHistory(workspace, libraryId, projectId);
      return Promise.all(records.map(async (record) => ({ ...record, targetAvailable: await access(record.targetPath).then(() => true).catch(() => false) })));
    },
    writeDiagnostics: async (diagnostic) => {
      const result = await dialog.showSaveDialog(activeWindow!, {
        defaultPath: 'designhub-diagnostics.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) return null;
      await writeFile(result.filePath, JSON.stringify(diagnostic, null, 2), 'utf8');
      return result.filePath;
    },
    createBackup: (workspace, destinationParentDirectory) => createWorkspaceBackupStore(workspace).createBackup({ destinationParentDirectory }),
    restoreBackup: (restoreInput) => {
      if (!activeProjectLibraryHandle) return Promise.reject(new Error('PROJECT_LIBRARY_NOT_OPEN'));
      return createWorkspaceBackupStore(activeProjectLibraryHandle).restoreBackup(restoreInput);
    },
  });
  registerSearchHandlers({
    ipc: ipcMain,
    getWindow: () => activeWindow,
    getTrustedUrl: () => activeTrustedUrl,
    getLibrary: () => activeProjectLibraryHandle,
    rebuild: async (workspace, records) => {
      const store = createSearchIndexStore(workspace);
      try { await store.replace(records); } finally { store.close(); }
    },
    search: async (workspace, options) => {
      const store = createSearchIndexStore(workspace);
      try { return await store.search(options); } finally { store.close(); }
    },
  });
});

app.on('window-all-closed', () => {
  closeActiveProjectLibrary();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', closeActiveProjectLibrary);

app.on('activate', () => {
  recreateWindowOnActivate(() => BrowserWindow.getAllWindows().length > 0, () => {
    createWindow();
  });
});
