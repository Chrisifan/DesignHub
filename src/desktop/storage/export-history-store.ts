import { access, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants, lstatSync, realpathSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { appendExportHistory, isExportHistoryRecord, type ExportHistoryRecord } from '../../features/delivery/export-history';
import { getWritableProjectLibraryLease } from './project-library-store';

export const exportHistoryFileName = 'export-history.json';

const getInternalDirectory = (handle: ProjectLibraryHandle, workspaceId: string, writable: boolean): string => {
  if (handle.library.libraryId !== workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');
  const directory = writable ? getWritableProjectLibraryLease(handle)?.directory : handle.library.directory;
  if (!directory) throw new Error('WORKSPACE_NOT_WRITABLE');
  const internal = join(realpathSync(directory), '.designhub');
  const status = lstatSync(internal);
  if (!status.isDirectory() || status.isSymbolicLink() || realpathSync(internal) !== internal) throw new Error('INVALID_WORKSPACE_PATH');
  return internal;
};

const assertRegularFile = (path: string, allowMissing: boolean): void => {
  try {
    const status = lstatSync(path);
    if (!status.isFile() || status.isSymbolicLink()) throw new Error('INVALID_EXPORT_HISTORY');
  } catch (error) {
    if (allowMissing && typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return;
    if (error instanceof Error && error.message === 'INVALID_EXPORT_HISTORY') throw error;
    throw new Error('INVALID_EXPORT_HISTORY');
  }
};

export const loadWorkspaceExportHistory = async (handle: ProjectLibraryHandle, workspaceId: string, projectId?: string): Promise<ExportHistoryRecord[]> => {
  const path = join(getInternalDirectory(handle, workspaceId, false), exportHistoryFileName);
  assertRegularFile(path, true);
  try {
    await access(path, constants.R_OK);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
  let parsed: unknown;
  try { parsed = JSON.parse(await readFile(path, 'utf8')) as unknown; } catch { throw new Error('INVALID_EXPORT_HISTORY'); }
  if (!Array.isArray(parsed) || !parsed.every(isExportHistoryRecord)) throw new Error('INVALID_EXPORT_HISTORY');
  const records = parsed as ExportHistoryRecord[];
  return structuredClone(projectId ? records.filter((record) => record.projectId === projectId) : records);
};

export const appendWorkspaceExportHistory = async (handle: ProjectLibraryHandle, workspaceId: string, record: ExportHistoryRecord): Promise<boolean> => {
  const directory = getInternalDirectory(handle, workspaceId, true);
  const path = join(directory, exportHistoryFileName);
  assertRegularFile(path, true);
  const existing = await loadWorkspaceExportHistory(handle, workspaceId);
  const next = appendExportHistory(existing, record);
  const temporary = join(directory, `.${exportHistoryFileName}.tmp-${randomUUID()}`);
  try {
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return true;
};
