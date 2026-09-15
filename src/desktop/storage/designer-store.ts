import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants, lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

import { isDesignerLibraryState, normalizeDesignerState, type DesignerLibraryState } from '../../features/designers/persistence';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { getWritableWorkspaceLease } from './workspace-store';

export const designersFileName = 'designers.json';

const internalDirectoryName = '.designhub';
const artworkDirectoryName = 'designer-artwork';
const artworkMetadataExtension = '.json';
const artworkBytesExtension = '.bin';
const artworkIdPattern = /^[a-z0-9][a-z0-9-]{0,127}$/iu;
const allowedArtworkMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maximumArtworkBytes = 20_000_000;

const getInternalDirectory = (workspaceDirectory: string): string => {
  const directory = join(workspaceDirectory, internalDirectoryName);
  let status: ReturnType<typeof lstatSync>;
  try {
    status = lstatSync(directory);
  } catch {
    throw new Error('INVALID_WORKSPACE_PATH');
  }
  if (!status.isDirectory() || status.isSymbolicLink() || realpathSync(directory) !== directory) {
    throw new Error('INVALID_WORKSPACE_PATH');
  }
  return directory;
};

const getWorkspaceDirectory = (handle: WorkspaceHandle, workspaceId: string, writable: boolean): string => {
  if (handle.workspace.workspaceId !== workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');
  if (writable) {
    const lease = getWritableWorkspaceLease(handle);
    if (!lease) throw new Error('WORKSPACE_NOT_WRITABLE');
    return getInternalDirectory(lease.directory);
  }
  return getInternalDirectory(handle.workspace.directory);
};

const assertRegularDesignerFile = (path: string, allowMissing: boolean): void => {
  try {
    const status = lstatSync(path);
    if (!status.isFile() || status.isSymbolicLink()) throw new Error('INVALID_DESIGNER_STATE');
  } catch (error) {
    if (allowMissing && typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return;
    if (error instanceof Error && error.message === 'INVALID_DESIGNER_STATE') throw error;
    throw new Error('INVALID_DESIGNER_STATE');
  }
};

const artworkPaths = (directory: string, artworkId: string): { metadata: string; bytes: string } => {
  if (!artworkIdPattern.test(artworkId)) throw new Error('INVALID_DESIGNER_ARTWORK');
  const artworkDirectory = join(directory, artworkDirectoryName);
  return {
    metadata: join(artworkDirectory, `${artworkId}${artworkMetadataExtension}`),
    bytes: join(artworkDirectory, `${artworkId}${artworkBytesExtension}`),
  };
};

const getArtworkDirectory = async (directory: string, writable: boolean): Promise<string> => {
  const artworkDirectory = join(directory, artworkDirectoryName);
  if (writable) await mkdir(artworkDirectory, { recursive: true });
  let status: ReturnType<typeof lstatSync>;
  try {
    status = lstatSync(artworkDirectory);
  } catch {
    throw new Error('INVALID_DESIGNER_ARTWORK');
  }
  if (!status.isDirectory() || status.isSymbolicLink() || realpathSync(artworkDirectory) !== artworkDirectory) {
    throw new Error('INVALID_DESIGNER_ARTWORK');
  }
  return artworkDirectory;
};

const assertRegularArtworkFile = (path: string, allowMissing: boolean): void => {
  try {
    const status = lstatSync(path);
    if (!status.isFile() || status.isSymbolicLink()) throw new Error('INVALID_DESIGNER_ARTWORK');
  } catch (error) {
    if (allowMissing && typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return;
    if (error instanceof Error && error.message === 'INVALID_DESIGNER_ARTWORK') throw error;
    throw new Error('INVALID_DESIGNER_ARTWORK');
  }
};

const parseArtworkMimeType = (value: unknown): string => {
  if (!value || typeof value !== 'object' || !('mimeType' in value) || typeof value.mimeType !== 'string' || !allowedArtworkMimeTypes.has(value.mimeType)) {
    throw new Error('INVALID_DESIGNER_ARTWORK');
  }
  return value.mimeType;
};

export const loadDesignerState = async (
  handle: WorkspaceHandle,
  workspaceId: string,
): Promise<DesignerLibraryState | null> => {
  const directory = getWorkspaceDirectory(handle, workspaceId, false);
  const filePath = join(directory, designersFileName);
  assertRegularDesignerFile(filePath, true);
  try {
    await access(filePath, constants.R_OK);
    const value: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    if (!isDesignerLibraryState(value)) throw new Error('INVALID_DESIGNER_STATE');
    const normalized = normalizeDesignerState(value);
    if (handle.workspace.openMode === 'writable' && JSON.stringify(normalized) !== JSON.stringify(value)) {
      try {
        await saveDesignerState(handle, workspaceId, normalized);
      } catch {
        // Loading remains read-safe even when a legacy workspace cannot be rewritten.
      }
    }
    return normalized;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) throw new Error('INVALID_DESIGNER_STATE');
    throw error;
  }
};

export const saveDesignerState = async (
  handle: WorkspaceHandle,
  workspaceId: string,
  state: DesignerLibraryState,
): Promise<boolean> => {
  const directory = getWorkspaceDirectory(handle, workspaceId, true);
  if (!isDesignerLibraryState(state)) throw new Error('INVALID_DESIGNER_STATE');
  const destination = join(directory, designersFileName);
  assertRegularDesignerFile(destination, true);
  const temporary = join(directory, `.${designersFileName}.tmp-${randomUUID()}`);
  try {
    await writeFile(temporary, `${JSON.stringify(normalizeDesignerState(state), null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return true;
};

export const saveDesignerArtwork = async (
  handle: WorkspaceHandle,
  workspaceId: string,
  artworkId: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ artworkId: string }> => {
  if (!allowedArtworkMimeTypes.has(mimeType) || bytes.byteLength === 0 || bytes.byteLength > maximumArtworkBytes) {
    throw new Error('INVALID_DESIGNER_ARTWORK');
  }
  const directory = getWorkspaceDirectory(handle, workspaceId, true);
  await getArtworkDirectory(directory, true);
  const paths = artworkPaths(directory, artworkId);
  assertRegularArtworkFile(paths.metadata, true);
  assertRegularArtworkFile(paths.bytes, true);
  const bytesTemporary = `${paths.bytes}.tmp-${randomUUID()}`;
  const metadataTemporary = `${paths.metadata}.tmp-${randomUUID()}`;
  try {
    await writeFile(bytesTemporary, bytes, { flag: 'wx' });
    await rename(bytesTemporary, paths.bytes);
    await writeFile(metadataTemporary, `${JSON.stringify({ mimeType })}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(metadataTemporary, paths.metadata);
  } catch (error) {
    await Promise.all([rm(bytesTemporary, { force: true }), rm(metadataTemporary, { force: true })]);
    throw error;
  }
  return { artworkId };
};

export const readDesignerArtwork = async (
  handle: WorkspaceHandle,
  workspaceId: string,
  artworkId: string,
): Promise<{ artworkId: string; dataUrl: string } | null> => {
  const directory = getWorkspaceDirectory(handle, workspaceId, false);
  await getArtworkDirectory(directory, false);
  const paths = artworkPaths(directory, artworkId);
  assertRegularArtworkFile(paths.metadata, true);
  assertRegularArtworkFile(paths.bytes, true);
  try {
    const mimeType = parseArtworkMimeType(JSON.parse(await readFile(paths.metadata, 'utf8')) as unknown);
    const bytes = await readFile(paths.bytes);
    if (bytes.byteLength === 0 || bytes.byteLength > maximumArtworkBytes) throw new Error('INVALID_DESIGNER_ARTWORK');
    return { artworkId, dataUrl: `data:${mimeType};base64,${bytes.toString('base64')}` };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) throw new Error('INVALID_DESIGNER_ARTWORK');
    throw error;
  }
};
