import { randomUUID } from 'node:crypto';
import { access, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants, lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

import { cloneDesignerState, isDesignerLibraryState, type DesignerLibraryState } from '../../features/designers/persistence';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { getWritableWorkspaceLease } from './workspace-store';

export const designersFileName = 'designers.json';

const internalDirectoryName = '.designhub';

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
    return cloneDesignerState(value);
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
    await writeFile(temporary, `${JSON.stringify(cloneDesignerState(state), null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return true;
};
