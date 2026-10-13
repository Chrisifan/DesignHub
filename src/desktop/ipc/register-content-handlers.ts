import type { BrowserWindow } from 'electron';
import { designerArtworkReadChannel, designerLoadChannel, designerSaveChannel, loadDesignerStateHandler, readDesignerArtworkHandler, saveDesignerStateHandler } from './designers';
import { assetImportChannel, assetListChannel, assetReadChannel, importAssetsHandler, listAssetsHandler, readAssetHandler } from './assets';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import type { DesignerLibraryState } from '../../features/designers/persistence';
import type { AssetImportInput, AssetReadInput, AssetStoreInput } from '../../features/assets/asset-store';
import type { AssetImportResult, ManagedAsset } from '../../features/assets/import-assets';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};
type Handler = (...args: unknown[]) => unknown;

export type RegisterContentHandlersOptions = {
  [key: string]: unknown;
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  getLibrary: () => ProjectLibraryHandle | null;
  loadDesigner: (workspace: ProjectLibraryHandle, libraryId: string) => Promise<DesignerLibraryState | null>;
  saveDesigner: (workspace: ProjectLibraryHandle, state: DesignerLibraryState) => Promise<boolean>;
  readArtwork: (workspace: ProjectLibraryHandle, libraryId: string, artworkId: string) => Promise<{ artworkId: string; dataUrl: string } | null>;
  listAssets: (workspace: ProjectLibraryHandle, input: AssetStoreInput) => Promise<ManagedAsset[]>;
  importAssets: (workspace: ProjectLibraryHandle, input: AssetImportInput) => Promise<AssetImportResult[]>;
  readAsset: (workspace: ProjectLibraryHandle, input: AssetReadInput) => Promise<Uint8Array | null>;
};

export const registerContentHandlers = (options: RegisterContentHandlersOptions): void => {
  const {
    ipc, getWindow, getTrustedUrl, getLibrary, loadDesigner, saveDesigner, readArtwork,
    listAssets, importAssets, readAsset,
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
  register(assetListChannel, (window, trustedUrl) => listAssetsHandler(window, trustedUrl, getLibrary, listAssets) as Handler);
  register(assetImportChannel, (window, trustedUrl) => importAssetsHandler(window, trustedUrl, getLibrary, importAssets) as Handler);
  register(assetReadChannel, (window, trustedUrl) => readAssetHandler(window, trustedUrl, getLibrary, readAsset) as Handler);
};
