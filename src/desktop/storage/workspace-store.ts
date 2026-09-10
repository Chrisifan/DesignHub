import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { constants, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import type { WorkspaceDescriptor, WorkspaceHandle } from '../../features/workspace/open-workspace';
import { getOpenMode } from '../../features/workspace/open-mode';

export const workspaceManifestName = 'designhub.workspace.json';
const workspaceKind = 'designhub-workspace';
const workspaceFormatVersion = 1;
const internalDirectoryName = '.designhub';
const writerLockName = 'writer-lock.sqlite';
const staleProjectStagingName = /^\.[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.creating-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type WritableWorkspaceLease = {
  workspace: WorkspaceDescriptor;
  active: boolean;
};

const writableWorkspaceLeases = new WeakMap<WorkspaceHandle, WritableWorkspaceLease>();

type WorkspaceManifest = {
  kind: typeof workspaceKind;
  workspaceId: string;
  name: string;
  formatVersion: number;
  createdAt: string;
};

const errorCode = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return String(error.code);
};

const isValidWorkspaceName = (name: string): boolean => {
  if (!name || name === '.' || name === '..' || /[<>:"/\\|?*\u0000-\u001F]/u.test(name)) return false;
  if (name.endsWith('.') || name.endsWith(' ')) return false;
  return !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(name);
};

const isWorkspaceManifest = (value: unknown): value is WorkspaceManifest => {
  if (typeof value !== 'object' || value === null) return false;
  const manifest = value as Record<string, unknown>;
  return manifest.kind === workspaceKind
    && typeof manifest.workspaceId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(manifest.workspaceId)
    && typeof manifest.name === 'string'
    && manifest.name.length > 0
    && Number.isInteger(manifest.formatVersion)
    && Number(manifest.formatVersion) > 0
    && typeof manifest.createdAt === 'string'
    && !Number.isNaN(Date.parse(manifest.createdAt));
};

const readManifest = async (directory: string): Promise<WorkspaceManifest> => {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(join(directory, workspaceManifestName), 'utf8')) as unknown;
  } catch {
    throw new Error('INVALID_WORKSPACE_MANIFEST');
  }
  if (!isWorkspaceManifest(value)) throw new Error('INVALID_WORKSPACE_MANIFEST');
  return value;
};

export const initializeWorkspaceWriterLock = (directory: string): void => {
  const database = new Database(join(directory, internalDirectoryName, writerLockName));
  try {
    database.pragma('journal_mode = DELETE');
    database.exec('CREATE TABLE lock_marker (id INTEGER PRIMARY KEY CHECK (id = 1));');
  } finally {
    database.close();
  }
};

const acquireWriterLock = (directory: string): Database.Database | null => {
  const database = new Database(join(directory, internalDirectoryName, writerLockName), { fileMustExist: true, timeout: 0 });
  try {
    database.pragma('busy_timeout = 0');
    database.pragma('journal_mode = DELETE');
    database.pragma('locking_mode = EXCLUSIVE');
    database.exec('BEGIN EXCLUSIVE');
    return database;
  } catch (error) {
    database.close();
    if (errorCode(error)?.startsWith('SQLITE_BUSY')) return null;
    throw error;
  }
};

const cleanupStaleProjectStaging = (directory: string): void => {
  const projectsDirectory = join(directory, 'projects');
  readdirSync(projectsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && staleProjectStagingName.test(entry.name))
    .forEach((entry) => rmSync(join(projectsDirectory, entry.name), { recursive: true, force: true }));
};

export const getWritableWorkspaceLease = (handle: WorkspaceHandle): WorkspaceDescriptor | null => {
  const lease = writableWorkspaceLeases.get(handle);
  return lease?.active ? lease.workspace : null;
};

const createHandle = (directory: string, manifest: WorkspaceManifest, supportedFormat: number): WorkspaceHandle => {
  if (manifest.formatVersion > supportedFormat) {
    return {
      workspace: {
        workspaceId: manifest.workspaceId,
        name: manifest.name,
        directory,
        formatVersion: manifest.formatVersion,
        openMode: 'read-only',
      },
      close: () => undefined,
    };
  }

  const writerLock = acquireWriterLock(directory);
  const workspace: WorkspaceDescriptor = {
    workspaceId: manifest.workspaceId,
    name: manifest.name,
    directory,
    formatVersion: manifest.formatVersion,
    openMode: getOpenMode(manifest.formatVersion, supportedFormat, writerLock === null),
  };
  const lease = writerLock === null ? null : { workspace: Object.freeze({ ...workspace }), active: true };
  let closed = false;
  const close = () => {
    if (closed || !writerLock) return;
    closed = true;
    if (lease) lease.active = false;
    writerLock.exec('ROLLBACK');
    writerLock.close();
  };
  const handle = { workspace, close };
  if (lease && writerLock) {
    if (workspace.openMode === 'writable') {
      try {
        cleanupStaleProjectStaging(directory);
      } catch (error) {
        close();
        throw error;
      }
    }
    writableWorkspaceLeases.set(handle, lease);
  }
  return handle;
};

export const createWorkspace = async (input: { parentDirectory: string; name: string }): Promise<WorkspaceHandle> => {
  const name = input.name.trim();
  if (!isValidWorkspaceName(name)) throw new Error('INVALID_WORKSPACE_NAME');
  const parentDirectory = await realpath(input.parentDirectory);
  await access(parentDirectory, constants.W_OK);
  const directory = join(parentDirectory, name);
  let created = false;

  try {
    await mkdir(directory);
    created = true;
    await Promise.all([
      mkdir(join(directory, internalDirectoryName)),
      mkdir(join(directory, 'projects')),
      mkdir(join(directory, 'shared-assets')),
      mkdir(join(directory, 'trash')),
    ]);
    const manifest: WorkspaceManifest = {
      kind: workspaceKind,
      workspaceId: randomUUID(),
      name,
      formatVersion: workspaceFormatVersion,
      createdAt: new Date().toISOString(),
    };
    await writeFile(join(directory, workspaceManifestName), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    initializeWorkspaceWriterLock(directory);
    return createHandle(directory, manifest, workspaceFormatVersion);
  } catch (error) {
    if (created) await rm(directory, { recursive: true, force: true });
    if (errorCode(error) === 'EEXIST') throw new Error('WORKSPACE_EXISTS');
    throw error;
  }
};

export const openWorkspace = async (directory: string, supportedFormat = workspaceFormatVersion): Promise<WorkspaceHandle> => {
  if (!Number.isInteger(supportedFormat) || supportedFormat < 1) throw new Error('INVALID_SUPPORTED_FORMAT');
  const canonicalDirectory = await realpath(directory);
  const manifest = await readManifest(canonicalDirectory);
  return createHandle(canonicalDirectory, manifest, supportedFormat);
};
