import type { AssetImportItem, AssetImportResult, ManagedAsset } from './import-assets';

export type AssetStoreInput = {
  workspaceId: string;
  libraryId?: string;
  projectId: string;
  /** Internal task recovery may opt into temporary conversation references. */
  includeContextAssets?: boolean;
};

export type AssetImportInput = AssetStoreInput & {
  items: AssetImportItem[];
};

export type AssetReadInput = AssetStoreInput & {
  assetId: string;
};

export type AssetStore = {
  listAssets: (input: AssetStoreInput) => Promise<ManagedAsset[]>;
  importAssets: (input: AssetImportInput) => Promise<AssetImportResult[]>;
  readAsset: (input: AssetReadInput) => Promise<Uint8Array | null>;
};

export const createAssetStore = (implementation: AssetStore): AssetStore => ({
  listAssets: (input) => implementation.listAssets(input),
  importAssets: (input) => implementation.importAssets(input),
  readAsset: (input) => implementation.readAsset(input),
});
