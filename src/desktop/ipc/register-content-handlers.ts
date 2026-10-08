import type { BrowserWindow } from 'electron';
import { designerArtworkReadChannel, designerLoadChannel, designerSaveChannel, loadDesignerStateHandler, readDesignerArtworkHandler, saveDesignerStateHandler } from './designers';
import { brandLoadChannel, brandSaveChannel, loadBrandStateHandler, saveBrandStateHandler } from './brands';
import { assetImportChannel, assetListChannel, assetReadChannel, importAssetsHandler, listAssetsHandler, readAssetHandler } from './assets';
import { loadDocumentSceneHandler, saveDocumentSceneHandler, sceneLoadChannel, sceneSaveChannel } from './scenes';
import { commitRevisionHandler, finalizeRevisionHandler, loadRevisionsHandler, revisionCommitChannel, revisionFinalizeChannel, revisionLoadChannel } from './revisions';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import type { DesignerLibraryState } from '../../features/designers/persistence';
import type { BrandLibraryState } from '../../features/brands/constraints';
import type { AssetImportInput, AssetReadInput, AssetStoreInput } from '../../features/assets/asset-store';
import type { AssetImportResult, ManagedAsset } from '../../features/assets/import-assets';
import type { DesignScene } from '../../features/canvas/scene';
import type { CommitRevisionInput, RevisionRecord, RevisionTimelineEvent } from '../../features/revisions/model';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};
type Handler = (...args: unknown[]) => unknown;
type RevisionState = { revisions: RevisionRecord[]; timeline: RevisionTimelineEvent[]; finalRevisionId: string | null };

export type RegisterContentHandlersOptions = {
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  getLibrary: () => ProjectLibraryHandle | null;
  loadDesigner: (workspace: ProjectLibraryHandle, libraryId: string) => Promise<DesignerLibraryState | null>;
  saveDesigner: (workspace: ProjectLibraryHandle, state: DesignerLibraryState) => Promise<boolean>;
  readArtwork: (workspace: ProjectLibraryHandle, libraryId: string, artworkId: string) => Promise<{ artworkId: string; dataUrl: string } | null>;
  loadBrand: (workspace: ProjectLibraryHandle, libraryId: string) => Promise<BrandLibraryState | null>;
  saveBrand: (workspace: ProjectLibraryHandle, state: BrandLibraryState) => Promise<boolean>;
  listAssets: (workspace: ProjectLibraryHandle, input: AssetStoreInput) => Promise<ManagedAsset[]>;
  importAssets: (workspace: ProjectLibraryHandle, input: AssetImportInput) => Promise<AssetImportResult[]>;
  readAsset: (workspace: ProjectLibraryHandle, input: AssetReadInput) => Promise<Uint8Array | null>;
  loadScene: (workspace: ProjectLibraryHandle, projectId: string, documentId: string) => Promise<DesignScene | null>;
  saveScene: (workspace: ProjectLibraryHandle, projectId: string, documentId: string, scene: DesignScene) => Promise<boolean>;
  loadRevisions: (workspace: ProjectLibraryHandle, target: { libraryId: string; projectId: string; documentId: string }) => Promise<RevisionState>;
  commitRevision: (workspace: ProjectLibraryHandle, input: { libraryId: string; projectId: string; documentId: string } & CommitRevisionInput) => Promise<{ revisionId: string }>;
  finalizeRevision: (workspace: ProjectLibraryHandle, input: { libraryId: string; projectId: string; documentId: string; revisionId: string }) => Promise<boolean>;
};

export const registerContentHandlers = (options: RegisterContentHandlersOptions): void => {
  const {
    ipc, getWindow, getTrustedUrl, getLibrary, loadDesigner, saveDesigner, readArtwork,
    loadBrand, saveBrand, listAssets, importAssets, readAsset, loadScene, saveScene,
    loadRevisions, commitRevision, finalizeRevision,
  } = options;
  const getContext = () => {
    const window = getWindow();
    const trustedUrl = getTrustedUrl();
    return window && trustedUrl ? { window, trustedUrl } : null;
  };
  const register = (channel: string, factory: (window: BrowserWindow, trustedUrl: string) => Handler, fallback: unknown = null) => {
    ipc.handle(channel, (...args) => {
      const context = getContext();
      return context ? factory(context.window, context.trustedUrl)(...args) : fallback;
    });
  };

  register(designerLoadChannel, (window, trustedUrl) => loadDesignerStateHandler(window, trustedUrl, getLibrary, loadDesigner) as Handler);
  register(designerSaveChannel, (window, trustedUrl) => saveDesignerStateHandler(window, trustedUrl, getLibrary, saveDesigner) as Handler, false);
  register(designerArtworkReadChannel, (window, trustedUrl) => readDesignerArtworkHandler(window, trustedUrl, getLibrary, readArtwork) as Handler);
  register(brandLoadChannel, (window, trustedUrl) => loadBrandStateHandler(window, trustedUrl, getLibrary, loadBrand) as Handler);
  register(brandSaveChannel, (window, trustedUrl) => saveBrandStateHandler(window, trustedUrl, getLibrary, saveBrand) as Handler, false);
  register(assetListChannel, (window, trustedUrl) => listAssetsHandler(window, trustedUrl, getLibrary, listAssets) as Handler);
  register(assetImportChannel, (window, trustedUrl) => importAssetsHandler(window, trustedUrl, getLibrary, importAssets) as Handler);
  register(assetReadChannel, (window, trustedUrl) => readAssetHandler(window, trustedUrl, getLibrary, readAsset) as Handler);
  register(sceneLoadChannel, (window, trustedUrl) => loadDocumentSceneHandler(window, trustedUrl, getLibrary, loadScene) as Handler);
  register(sceneSaveChannel, (window, trustedUrl) => saveDocumentSceneHandler(window, trustedUrl, getLibrary, saveScene) as Handler, false);
  register(revisionLoadChannel, (window, trustedUrl) => loadRevisionsHandler(window, trustedUrl, getLibrary, loadRevisions) as Handler);
  register(revisionCommitChannel, (window, trustedUrl) => commitRevisionHandler(window, trustedUrl, getLibrary, commitRevision) as Handler);
  register(revisionFinalizeChannel, (window, trustedUrl) => finalizeRevisionHandler(window, trustedUrl, getLibrary, finalizeRevision) as Handler, false);
};
