import type { AssetImportInput, AssetReadInput, AssetStoreInput } from '../../features/assets/asset-store';
import type { AssetImportResult, AssetImportItem, ManagedAsset } from '../../features/assets/import-assets';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { isTrustedProjectLibraryRequest } from './workspace';

export const assetListChannel = 'asset:list';
export const assetImportChannel = 'asset:import';
export const assetReadChannel = 'asset:read';

type AssetSender = {
  mainFrame: { url: string };
  getURL: () => string;
};

type AssetRequest = {
  sender: AssetSender;
  senderFrame: { url: string } | null;
};

type AssetWindow = { webContents: AssetSender };

const isWorkspaceId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isProjectId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isStoreInput = (value: unknown): value is AssetStoreInput => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return isWorkspaceId(input.libraryId) && isProjectId(input.projectId);
};

const isImportItem = (value: unknown): value is AssetImportItem => typeof value === 'object'
  && value !== null
  && typeof (value as Record<string, unknown>).name === 'string';

const isImportInput = (value: unknown): value is AssetImportInput => isStoreInput(value)
  && (() => {
    const items = (value as Record<string, unknown>).items;
    return Array.isArray(items) && items.every(isImportItem);
  })();

const isReadInput = (value: unknown): value is AssetReadInput => isStoreInput(value)
  && (() => {
    const assetId = (value as Record<string, unknown>).assetId;
    return typeof assetId === 'string' && assetId.trim().length > 0;
  })();

export const listAssetsHandler = (
  window: AssetWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  listAssets: (workspace: ProjectLibraryHandle, input: AssetStoreInput) => Promise<ManagedAsset[]>,
) => async (event: AssetRequest, input: unknown): Promise<ManagedAsset[] | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isStoreInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return listAssets(workspace, input);
};

export const importAssetsHandler = (
  window: AssetWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  importAssets: (workspace: ProjectLibraryHandle, input: AssetImportInput) => Promise<AssetImportResult[]>,
) => async (event: AssetRequest, input: unknown): Promise<AssetImportResult[] | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isImportInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return importAssets(workspace, input);
};

export const readAssetHandler = (
  window: AssetWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  readAsset: (workspace: ProjectLibraryHandle, input: AssetReadInput) => Promise<Uint8Array | null>,
) => async (event: AssetRequest, input: unknown): Promise<Uint8Array | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isReadInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return readAsset(workspace, input);
};
