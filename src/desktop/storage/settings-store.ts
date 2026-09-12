import { access, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants, lstatSync as lstat, realpathSync as realpath } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { isWorkspaceSettings, type WorkspaceSettings } from '../../features/workspace/settings';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { getWritableWorkspaceLease } from './workspace-store';

export const workspaceSettingsFileName = 'settings.json';
const internalDirectoryName = '.designhub';

export type { WorkspaceBackupSettings, WorkspaceSettings } from '../../features/workspace/settings';
export { isWorkspaceSettings } from '../../features/workspace/settings';

const getInternalDirectory = (handle: WorkspaceHandle, workspaceId: string, writable: boolean): string => {
  if (handle.workspace.workspaceId !== workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');
  const directory = writable ? getWritableWorkspaceLease(handle)?.directory : handle.workspace.directory;
  if (!directory) throw new Error('WORKSPACE_NOT_WRITABLE');
  const internal = join(directory, internalDirectoryName);
  let status: ReturnType<typeof lstat>;
  try {
    status = lstat(internal);
  } catch {
    throw new Error('INVALID_WORKSPACE_PATH');
  }
  if (!status.isDirectory() || status.isSymbolicLink() || realpath(internal) !== internal) throw new Error('INVALID_WORKSPACE_PATH');
  return internal;
};

const assertRegularSettingsFile = (path: string, allowMissing: boolean): void => {
  try {
    const status = lstat(path);
    if (!status.isFile() || status.isSymbolicLink()) throw new Error('INVALID_WORKSPACE_SETTINGS');
  } catch (error) {
    if (allowMissing && typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return;
    if (error instanceof Error && error.message === 'INVALID_WORKSPACE_SETTINGS') throw error;
    throw new Error('INVALID_WORKSPACE_SETTINGS');
  }
};

export const loadWorkspaceSettings = async (handle: WorkspaceHandle, workspaceId: string): Promise<WorkspaceSettings | null> => {
  const path = join(getInternalDirectory(handle, workspaceId, false), workspaceSettingsFileName);
  assertRegularSettingsFile(path, true);
  try {
    await access(path, constants.R_OK);
    const value: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!isWorkspaceSettings(value)) throw new Error('INVALID_WORKSPACE_SETTINGS');
    return structuredClone(value);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) throw new Error('INVALID_WORKSPACE_SETTINGS');
    throw error;
  }
};

export const saveWorkspaceSettings = async (handle: WorkspaceHandle, workspaceId: string, settings: WorkspaceSettings): Promise<boolean> => {
  const directory = getInternalDirectory(handle, workspaceId, true);
  if (!isWorkspaceSettings(settings)) throw new Error('INVALID_WORKSPACE_SETTINGS');
  const destination = join(directory, workspaceSettingsFileName);
  assertRegularSettingsFile(destination, true);
  const temporary = join(directory, `.${workspaceSettingsFileName}.tmp-${randomUUID()}`);
  try {
    await writeFile(temporary, `${JSON.stringify(structuredClone(settings), null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return true;
};
