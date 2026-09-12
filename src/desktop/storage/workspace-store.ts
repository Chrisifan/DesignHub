import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { constants, existsSync, lstatSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import type { WorkspaceDescriptor, WorkspaceHandle } from '../../features/workspace/open-workspace';
import { getOpenMode } from '../../features/workspace/open-mode';

export const workspaceManifestName = 'designhub.workspace.json';
export const workspaceMigrationStateName = 'workspace-migration.json';
const workspaceKind = 'designhub-workspace';
const workspaceFormatVersion = 1;
const internalDirectoryName = '.designhub';
const writerLockName = 'writer-lock.sqlite';
const staleProjectStagingName = /^\.[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.creating-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type WritableWorkspaceLease = {
  workspace: WorkspaceDescriptor;
  directoryIdentity: DirectoryIdentity;
  active: boolean;
};

const writableWorkspaceLeases = new WeakMap<WorkspaceHandle, WritableWorkspaceLease>();

type DirectoryIdentity = {
  dev: bigint;
  ino: bigint;
};

type WorkspaceManifest = {
  kind: typeof workspaceKind;
  workspaceId: string;
  name: string;
  formatVersion: number;
  createdAt: string;
};

type WorkspaceMigrationState = {
  kind: 'designhub-workspace-migration';
  migrationId: string;
  workspaceId: string;
  fromFormatVersion: number;
  toFormatVersion: number;
  originalManifestSha256: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const hashPattern = /^[0-9a-f]{64}$/u;

const errorCode = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return String(error.code);
};

const readDirectoryIdentity = (directory: string): DirectoryIdentity | null => {
  try {
    const status = lstatSync(directory, { bigint: true });
    if (!status.isDirectory() || status.isSymbolicLink() || realpathSync(directory) !== directory) return null;
    return { dev: status.dev, ino: status.ino };
  } catch {
    return null;
  }
};

const sameDirectoryIdentity = (left: DirectoryIdentity, right: DirectoryIdentity): boolean => left.dev === right.dev && left.ino === right.ino;

const readRequiredDirectoryIdentity = (directory: string): DirectoryIdentity => {
  const identity = readDirectoryIdentity(directory);
  if (!identity) throw new Error('INVALID_WORKSPACE_PATH');
  return identity;
};

const assertDirectoryIdentity = (directory: string, expectedIdentity: DirectoryIdentity): DirectoryIdentity => {
  const currentIdentity = readRequiredDirectoryIdentity(directory);
  if (!sameDirectoryIdentity(currentIdentity, expectedIdentity)) throw new Error('INVALID_WORKSPACE_PATH');
  return currentIdentity;
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
    && uuidPattern.test(manifest.workspaceId)
    && typeof manifest.name === 'string'
    && manifest.name.length > 0
    && Number.isInteger(manifest.formatVersion)
    && Number(manifest.formatVersion) > 0
    && typeof manifest.createdAt === 'string'
    && !Number.isNaN(Date.parse(manifest.createdAt));
};

const isWorkspaceMigrationState = (value: unknown): value is WorkspaceMigrationState => {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Record<string, unknown>;
  return state.kind === 'designhub-workspace-migration'
    && typeof state.migrationId === 'string'
    && uuidPattern.test(state.migrationId)
    && typeof state.workspaceId === 'string'
    && uuidPattern.test(state.workspaceId)
    && Number.isInteger(state.fromFormatVersion)
    && Number(state.fromFormatVersion) > 0
    && Number.isInteger(state.toFormatVersion)
    && Number(state.toFormatVersion) > Number(state.fromFormatVersion)
    && typeof state.originalManifestSha256 === 'string'
    && hashPattern.test(state.originalManifestSha256);
};

const readRegularFile = (path: string, errorMessage: string): string => {
  try {
    const status = lstatSync(path);
    if (!status.isFile() || status.isSymbolicLink()) throw new Error(errorMessage);
    return readFileSync(path, 'utf8');
  } catch {
    throw new Error(errorMessage);
  }
};

const readWorkspaceManifestFile = (path: string): { content: string; manifest: WorkspaceManifest } => {
  const content = readRegularFile(path, 'INVALID_WORKSPACE_MANIFEST');
  let value: unknown;
  try {
    value = JSON.parse(content) as unknown;
  } catch {
    throw new Error('INVALID_WORKSPACE_MANIFEST');
  }
  if (!isWorkspaceManifest(value)) throw new Error('INVALID_WORKSPACE_MANIFEST');
  return { content, manifest: value };
};

const readManifest = async (directory: string): Promise<WorkspaceManifest> => {
  const path = join(directory, workspaceManifestName);
  let value: unknown;
  try {
    const status = lstatSync(path);
    if (!status.isFile() || status.isSymbolicLink() || realpathSync(path) !== path) throw new Error('INVALID_WORKSPACE_MANIFEST');
    value = JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    throw new Error('INVALID_WORKSPACE_MANIFEST');
  }
  if (!isWorkspaceManifest(value)) throw new Error('INVALID_WORKSPACE_MANIFEST');
  return value;
};

const readManifestIfPresent = async (directory: string): Promise<WorkspaceManifest | null> => {
  const path = join(directory, workspaceManifestName);
  try {
    lstatSync(path);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return null;
    throw new Error('INVALID_WORKSPACE_MANIFEST');
  }
  let value: unknown;
  try {
    const status = lstatSync(path);
    if (!status.isFile() || status.isSymbolicLink() || realpathSync(path) !== path) throw new Error('INVALID_WORKSPACE_MANIFEST');
    value = JSON.parse(await readFile(path, 'utf8')) as unknown;
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

const acquireWriterLock = (directory: string, expectedIdentity?: DirectoryIdentity): Database.Database | null => {
  if (expectedIdentity) assertDirectoryIdentity(directory, expectedIdentity);
  const database = new Database(join(directory, internalDirectoryName, writerLockName), { fileMustExist: true, timeout: 0 });
  let transactionStarted = false;
  try {
    database.pragma('busy_timeout = 0');
    database.pragma('journal_mode = DELETE');
    database.pragma('locking_mode = EXCLUSIVE');
    database.exec('BEGIN EXCLUSIVE');
    transactionStarted = true;
    if (expectedIdentity) assertDirectoryIdentity(directory, expectedIdentity);
    return database;
  } catch (error) {
    try {
      if (transactionStarted) database.exec('ROLLBACK');
    } finally {
      database.close();
    }
    if (errorCode(error)?.startsWith('SQLITE_BUSY')) return null;
    throw error;
  }
};

const closeWriterLock = (writerLock: Database.Database): void => {
  writerLock.exec('ROLLBACK');
  writerLock.close();
};

const removeMigrationFile = (path: string): void => {
  if (!existsSync(path)) return;
  const status = lstatSync(path);
  if (!status.isFile() || status.isSymbolicLink()) throw new Error('INVALID_WORKSPACE_MIGRATION_STATE');
  rmSync(path);
};

const readWorkspaceMigrationState = (directory: string): WorkspaceMigrationState | null => {
  const statePath = join(directory, internalDirectoryName, workspaceMigrationStateName);
  if (!existsSync(statePath)) return null;

  let stateValue: unknown;
  try {
    stateValue = JSON.parse(readRegularFile(statePath, 'INVALID_WORKSPACE_MIGRATION_STATE')) as unknown;
  } catch {
    throw new Error('INVALID_WORKSPACE_MIGRATION_STATE');
  }
  if (!isWorkspaceMigrationState(stateValue)) throw new Error('INVALID_WORKSPACE_MIGRATION_STATE');
  return stateValue;
};

const recoverInterruptedWorkspaceMigration = (directory: string, expectedIdentity: DirectoryIdentity): void => {
  const stateBeforeLock = readWorkspaceMigrationState(directory);
  if (!stateBeforeLock) return;

  const statePath = join(directory, internalDirectoryName, workspaceMigrationStateName);
  const writerLock = acquireWriterLock(directory, expectedIdentity);
  const manifestPath = join(directory, workspaceManifestName);
  if (!writerLock) {
    assertDirectoryIdentity(directory, expectedIdentity);
    if (!existsSync(manifestPath)) throw new Error('WORKSPACE_MIGRATION_IN_PROGRESS');
    return;
  }

  try {
    assertDirectoryIdentity(directory, expectedIdentity);
    const stateValue = readWorkspaceMigrationState(directory);
    if (!stateValue) return;
    const temporaryPath = join(directory, `.${workspaceManifestName}.migration-${stateValue.migrationId}`);
    const rollbackPath = join(directory, `.${workspaceManifestName}.rollback-${stateValue.migrationId}`);
    const matchesOriginal = ({ content, manifest }: { content: string; manifest: WorkspaceManifest }): boolean => manifest.workspaceId === stateValue.workspaceId
      && manifest.formatVersion === stateValue.fromFormatVersion
      && createHash('sha256').update(content).digest('hex') === stateValue.originalManifestSha256;

    if (!existsSync(manifestPath)) {
      if (!existsSync(rollbackPath) || !matchesOriginal(readWorkspaceManifestFile(rollbackPath))) {
        throw new Error('INVALID_WORKSPACE_MIGRATION_STATE');
      }
      renameSync(rollbackPath, manifestPath);
    } else {
      const current = readWorkspaceManifestFile(manifestPath);
      const published = current.manifest.workspaceId === stateValue.workspaceId
        && current.manifest.formatVersion === stateValue.toFormatVersion;
      if (!published && !matchesOriginal(current)) throw new Error('INVALID_WORKSPACE_MIGRATION_STATE');
      if (existsSync(rollbackPath) && !matchesOriginal(readWorkspaceManifestFile(rollbackPath))) {
        throw new Error('INVALID_WORKSPACE_MIGRATION_STATE');
      }
    }
    removeMigrationFile(temporaryPath);
    removeMigrationFile(rollbackPath);
    removeMigrationFile(statePath);
  } finally {
    closeWriterLock(writerLock);
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
  if (!lease?.active) return null;
  const currentIdentity = readDirectoryIdentity(lease.workspace.directory);
  if (!currentIdentity || !sameDirectoryIdentity(currentIdentity, lease.directoryIdentity)) return null;
  return lease.workspace;
};

const createHandle = (directory: string, manifest: WorkspaceManifest, supportedFormat: number, expectedIdentity?: DirectoryIdentity): WorkspaceHandle => {
  if (expectedIdentity) assertDirectoryIdentity(directory, expectedIdentity);
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

  const writerLock = acquireWriterLock(directory, expectedIdentity);
  if (!writerLock) {
    if (expectedIdentity) assertDirectoryIdentity(directory, expectedIdentity);
    return {
      workspace: {
        workspaceId: manifest.workspaceId,
        name: manifest.name,
        directory,
        formatVersion: manifest.formatVersion,
        openMode: getOpenMode(manifest.formatVersion, supportedFormat, true),
      },
      close: () => undefined,
    };
  }

  let directoryIdentity: DirectoryIdentity;
  let lockedManifest: WorkspaceManifest;
  try {
    directoryIdentity = expectedIdentity
      ? assertDirectoryIdentity(directory, expectedIdentity)
      : readRequiredDirectoryIdentity(directory);
    lockedManifest = readWorkspaceManifestFile(join(directory, workspaceManifestName)).manifest;
    if (lockedManifest.workspaceId !== manifest.workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');
    if (lockedManifest.formatVersion !== manifest.formatVersion) throw new Error('WORKSPACE_FORMAT_CHANGED');
  } catch (error) {
    closeWriterLock(writerLock);
    throw error;
  }

  const workspace: WorkspaceDescriptor = {
    workspaceId: lockedManifest.workspaceId,
    name: lockedManifest.name,
    directory,
    formatVersion: lockedManifest.formatVersion,
    openMode: getOpenMode(lockedManifest.formatVersion, supportedFormat, false),
  };
  const lease = { workspace: Object.freeze({ ...workspace }), directoryIdentity, active: true };
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    lease.active = false;
    closeWriterLock(writerLock);
  };
  const handle = { workspace, close };
  if (workspace.openMode === 'writable') {
    try {
      cleanupStaleProjectStaging(directory);
    } catch (error) {
      close();
      throw error;
    }
  }
  writableWorkspaceLeases.set(handle, lease);
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
    return createHandle(directory, manifest, workspaceFormatVersion, readRequiredDirectoryIdentity(directory));
  } catch (error) {
    if (created) await rm(directory, { recursive: true, force: true });
    if (errorCode(error) === 'EEXIST') throw new Error('WORKSPACE_EXISTS');
    throw error;
  }
};

export const openWorkspace = async (directory: string, supportedFormat = workspaceFormatVersion): Promise<WorkspaceHandle> => {
  if (!Number.isInteger(supportedFormat) || supportedFormat < 1) throw new Error('INVALID_SUPPORTED_FORMAT');
  const canonicalDirectory = await realpath(directory);
  const directoryIdentity = readRequiredDirectoryIdentity(canonicalDirectory);
  const manifestBeforeRecovery = await readManifestIfPresent(canonicalDirectory);
  assertDirectoryIdentity(canonicalDirectory, directoryIdentity);
  if (manifestBeforeRecovery && manifestBeforeRecovery.formatVersion > supportedFormat) {
    return createHandle(canonicalDirectory, manifestBeforeRecovery, supportedFormat, directoryIdentity);
  }
  const migrationState = readWorkspaceMigrationState(canonicalDirectory);
  assertDirectoryIdentity(canonicalDirectory, directoryIdentity);
  if (!manifestBeforeRecovery && migrationState && migrationState.toFormatVersion > supportedFormat) {
    throw new Error('WORKSPACE_MIGRATION_REQUIRES_NEWER_VERSION');
  }
  if (manifestBeforeRecovery && migrationState && migrationState.toFormatVersion > supportedFormat) {
    throw new Error('WORKSPACE_MIGRATION_REQUIRES_NEWER_VERSION');
  }
  recoverInterruptedWorkspaceMigration(canonicalDirectory, directoryIdentity);
  assertDirectoryIdentity(canonicalDirectory, directoryIdentity);
  const manifest = await readManifest(canonicalDirectory);
  assertDirectoryIdentity(canonicalDirectory, directoryIdentity);
  return createHandle(canonicalDirectory, manifest, supportedFormat, directoryIdentity);
};
