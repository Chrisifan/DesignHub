import { access, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants, lstatSync, realpathSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { isBrandLibraryState, type Brand, type BrandLibraryState } from '../../features/brands/constraints';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { getWritableWorkspaceLease } from './workspace-store';

export const brandsFileName = 'brands.json';
const internalDirectoryName = '.designhub';

const getInternalDirectory = (workspaceDirectory: string): string => {
  const directory = join(workspaceDirectory, internalDirectoryName);
  let status: ReturnType<typeof lstatSync>;
  try { status = lstatSync(directory); } catch { throw new Error('INVALID_WORKSPACE_PATH'); }
  if (!status.isDirectory() || status.isSymbolicLink() || realpathSync(directory) !== directory) throw new Error('INVALID_WORKSPACE_PATH');
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

export const loadBrandState = async (handle: WorkspaceHandle, workspaceId: string): Promise<BrandLibraryState | null> => {
  const path = join(getWorkspaceDirectory(handle, workspaceId, false), brandsFileName);
  try {
    await access(path, constants.R_OK);
    const value: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!isBrandLibraryState(value)) throw new Error('INVALID_BRAND_STATE');
    return structuredClone(value);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) throw new Error('INVALID_BRAND_STATE');
    throw error;
  }
};

export const saveBrandState = async (handle: WorkspaceHandle, workspaceId: string, state: BrandLibraryState): Promise<boolean> => {
  const directory = getWorkspaceDirectory(handle, workspaceId, true);
  if (!isBrandLibraryState(state)) throw new Error('INVALID_BRAND_STATE');
  const destination = join(directory, brandsFileName);
  const temporary = join(directory, `.${brandsFileName}.tmp-${randomUUID()}`);
  try {
    await writeFile(temporary, `${JSON.stringify(structuredClone(state), null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return true;
};

export const createPersistedBrandState = (brands: Brand[]): BrandLibraryState => ({ brands: structuredClone(brands) });
