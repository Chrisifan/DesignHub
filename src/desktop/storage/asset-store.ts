import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants, lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import type { AssetImportInput, AssetReadInput, AssetStore, AssetStoreInput } from '../../features/assets/asset-store';
import { importAssets as importAssetItems, supportedAssetFormats, type AssetImportResult, type ManagedAsset } from '../../features/assets/import-assets';
import { getWritableWorkspaceLease } from './workspace-store';
import { projectContentManifestName, resolveProjectDirectory as resolveProjectPath } from './project-store';

const assetsDirectoryName = 'assets';
const projectIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const contentHashPattern = /^[0-9a-f]{64}$/u;

type PersistedAsset = Omit<ManagedAsset, 'originalBytes'> & {
  storagePath?: string;
};

type ContentManifest = {
  formatVersion: number;
  projectId: string;
  assets: PersistedAsset[];
  [key: string]: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const errorCode = (error: unknown): string | null => {
  if (!isRecord(error) || typeof error.code !== 'string') return null;
  return error.code;
};

const isPersistedAsset = (value: unknown): value is PersistedAsset => isRecord(value)
  && typeof value.id === 'string'
  && typeof value.contentHash === 'string'
  && value.id === `asset-${value.contentHash.slice(0, 16)}`
  && typeof value.name === 'string'
  && typeof value.format === 'string'
  && supportedAssetFormats.includes(value.format as (typeof supportedAssetFormats)[number])
  && typeof value.mimeType === 'string'
  && contentHashPattern.test(value.contentHash)
  && typeof value.managed === 'boolean'
  && (!value.managed || value.storagePath === `assets/${value.contentHash}`)
  && (value.externalReference === undefined || typeof value.externalReference === 'string');

const isContentManifest = (value: unknown, projectId: string): value is ContentManifest => isRecord(value)
  && typeof value.formatVersion === 'number'
  && Number.isInteger(value.formatVersion)
  && value.formatVersion > 0
  && value.projectId === projectId
  && Array.isArray(value.assets)
  && value.assets.every(isPersistedAsset);

const validateStoreInput = (input: AssetStoreInput): void => {
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim().length === 0) throw new Error('INVALID_WORKSPACE_ID');
  if (typeof input.projectId !== 'string' || !projectIdPattern.test(input.projectId)) throw new Error('INVALID_PROJECT_ID');
};

const canonicalDirectory = (directory: string, errorMessage: string): string => {
  let status: ReturnType<typeof lstatSync>;
  try {
    status = lstatSync(directory);
  } catch {
    throw new Error(errorMessage);
  }
  if (!status.isDirectory() || status.isSymbolicLink() || realpathSync(directory) !== directory) throw new Error(errorMessage);
  return directory;
};

const resolveProjectDirectory = (handle: WorkspaceHandle, input: AssetStoreInput, writable: boolean): string => {
  validateStoreInput(input);
  if (handle.workspace.workspaceId !== input.workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');
  if (writable && !getWritableWorkspaceLease(handle)) throw new Error('WORKSPACE_NOT_WRITABLE');
  const directory = resolveProjectPath(handle, input.projectId);
  if (!directory) throw new Error('PROJECT_NOT_FOUND');
  return directory;
};

const readContentManifest = async (projectDirectory: string, projectId: string): Promise<ContentManifest> => {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(join(projectDirectory, projectContentManifestName), 'utf8')) as unknown;
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return { formatVersion: 1, projectId, assets: [] };
    throw new Error('INVALID_ASSET_MANIFEST');
  }
  if (!isContentManifest(value, projectId)) throw new Error('INVALID_ASSET_MANIFEST');
  return structuredClone(value);
};

const writeContentManifest = async (projectDirectory: string, manifest: ContentManifest): Promise<void> => {
  const destination = join(projectDirectory, projectContentManifestName);
  const temporary = join(projectDirectory, `.${projectContentManifestName}.tmp-${randomUUID()}`);
  try {
    await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
};

const toPersistedAsset = (asset: ManagedAsset, storagePath?: string): PersistedAsset => {
  const metadata = structuredClone(asset);
  delete metadata.originalBytes;
  return storagePath ? { ...metadata, storagePath } : metadata;
};

const toManagedAsset = (asset: PersistedAsset): ManagedAsset => structuredClone(asset);

const ensureAssetDirectory = async (projectDirectory: string): Promise<string> => {
  const directory = join(projectDirectory, assetsDirectoryName);
  try {
    await mkdir(directory, { recursive: true });
  } catch {
    throw new Error('ASSET_STORAGE_UNAVAILABLE');
  }
  return canonicalDirectory(directory, 'ASSET_STORAGE_UNAVAILABLE');
};

const writeManagedBytes = async (projectDirectory: string, bytes: Uint8Array, metadata: { contentHash: string }): Promise<string> => {
  if (!contentHashPattern.test(metadata.contentHash)) throw new Error('INVALID_CONTENT_HASH');
  const directory = await ensureAssetDirectory(projectDirectory);
  const destination = join(directory, metadata.contentHash);
  try {
    await access(destination, constants.R_OK);
    const status = lstatSync(destination);
    if (!status.isFile() || status.isSymbolicLink() || realpathSync(destination) !== destination) throw new Error('ASSET_STORAGE_UNAVAILABLE');
    const existingHash = createHash('sha256').update(await readFile(destination)).digest('hex');
    if (existingHash !== metadata.contentHash) throw new Error('ASSET_HASH_MISMATCH');
    return `assets/${metadata.contentHash}`;
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
  }
  const temporary = join(directory, `.${metadata.contentHash}.tmp-${randomUUID()}`);
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return `assets/${metadata.contentHash}`;
};

const listAssetsForProject = async (handle: WorkspaceHandle, input: AssetStoreInput): Promise<ManagedAsset[]> => {
  const directory = resolveProjectDirectory(handle, input, false);
  const manifest = await readContentManifest(directory, input.projectId);
  return manifest.assets.map((asset) => toManagedAsset(asset));
};

const importAssetsForProject = async (handle: WorkspaceHandle, input: AssetImportInput): Promise<AssetImportResult[]> => {
  const directory = resolveProjectDirectory(handle, input, true);
  const manifest = await readContentManifest(directory, input.projectId);
  const existing = manifest.assets.map(toManagedAsset);
  const writtenPaths = new Map<string, string>();
  const results = await importAssetItems(input.items, {
    existingAssets: existing,
    saveOriginal: async (bytes, metadata) => {
      writtenPaths.set(metadata.contentHash, await writeManagedBytes(directory, bytes, metadata));
    },
  });
  const nextAssets = [...manifest.assets];
  results.filter((result): result is Extract<AssetImportResult, { status: 'success' }> => result.status === 'success')
    .forEach(({ asset }) => {
      if (nextAssets.some((entry) => entry.contentHash === asset.contentHash)) return;
      nextAssets.push(toPersistedAsset(asset, asset.managed ? writtenPaths.get(asset.contentHash) : undefined));
    });
  if (nextAssets.length !== manifest.assets.length) await writeContentManifest(directory, { ...manifest, assets: nextAssets });
  return results;
};

const readAssetForProject = async (handle: WorkspaceHandle, input: AssetReadInput): Promise<Uint8Array | null> => {
  const directory = resolveProjectDirectory(handle, input, false);
  const manifest = await readContentManifest(directory, input.projectId);
  const asset = manifest.assets.find((entry) => entry.id === input.assetId);
  if (!asset || !asset.managed || !asset.storagePath || asset.storagePath !== `assets/${asset.contentHash}`) return null;
  const filePath = join(directory, assetsDirectoryName, asset.contentHash);
  try {
    return new Uint8Array(await readFile(filePath));
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return null;
    throw error;
  }
};

export const createAssetStore = (handle: WorkspaceHandle): AssetStore => ({
  listAssets: async (input) => listAssetsForProject(handle, input),
  importAssets: async (input) => importAssetsForProject(handle, input),
  readAsset: async (input) => readAssetForProject(handle, input),
});
