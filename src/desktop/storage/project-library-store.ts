import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, realpath, readdir, rm, writeFile } from 'node:fs/promises';
import { constants, existsSync, lstatSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import type { ProjectLibraryDescriptor, ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { getOpenMode } from '../../features/workspace/open-mode';

export const projectLibraryManifestName = 'designhub.library.json';
export const projectLibraryMigrationStateName = 'project-library-migration.json';

const projectLibraryKind = 'designhub-project-library';
const projectLibraryFormatVersion = 1;
const internalDirectoryName = '.designhub';
const writerLockName = 'writer-lock.sqlite';
const managedDirectoryNames = [internalDirectoryName, 'projects', 'shared-assets', 'trash'] as const;
const staleProjectStagingName = /^\.[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.creating-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type ProjectLibraryManifest = {
  kind: typeof projectLibraryKind;
  libraryId: string;
  formatVersion: number;
  createdAt: string;
};

type ProjectLibraryMigrationState = {
  kind: 'designhub-workspace-migration';
  migrationId: string;
  workspaceId: string;
  fromFormatVersion: number;
  toFormatVersion: number;
  originalManifestSha256: string;
};

type DirectoryIdentity = {
  dev: bigint;
  ino: bigint;
};

type WritableProjectLibraryLease = {
  library: ProjectLibraryDescriptor;
  directoryIdentity: DirectoryIdentity;
  active: boolean;
};

const writableProjectLibraryLeases = new WeakMap<ProjectLibraryHandle, WritableProjectLibraryLease>();

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
  if (!identity) throw new Error('INVALID_PROJECT_LIBRARY_PATH');
  return identity;
};

const assertDirectoryIdentity = (directory: string, expected: DirectoryIdentity): DirectoryIdentity => {
  const current = readRequiredDirectoryIdentity(directory);
  if (!sameDirectoryIdentity(current, expected)) throw new Error('INVALID_PROJECT_LIBRARY_PATH');
  return current;
};

const isProjectLibraryManifest = (value: unknown): value is ProjectLibraryManifest => {
  if (typeof value !== 'object' || value === null) return false;
  const manifest = value as Record<string, unknown>;
  return manifest.kind === projectLibraryKind
    && typeof manifest.libraryId === 'string'
    && uuidPattern.test(manifest.libraryId)
    && Number.isInteger(manifest.formatVersion)
    && Number(manifest.formatVersion) > 0
    && typeof manifest.createdAt === 'string'
    && !Number.isNaN(Date.parse(manifest.createdAt));
};

const readProjectLibraryManifest = async (directory: string): Promise<ProjectLibraryManifest> => {
  const manifestPath = join(directory, projectLibraryManifestName);
  try {
    const status = lstatSync(manifestPath);
    if (!status.isFile() || status.isSymbolicLink() || realpathSync(manifestPath) !== manifestPath) {
      throw new Error('INVALID_PROJECT_LIBRARY_MANIFEST');
    }
  } catch (error) {
    if (errorCode(error) === 'ENOENT') throw new Error('NOT_A_PROJECT_LIBRARY');
    throw error;
  }

  let value: unknown;
  try {
    value = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown;
  } catch {
    throw new Error('INVALID_PROJECT_LIBRARY_MANIFEST');
  }
  if (!isProjectLibraryManifest(value)) throw new Error('INVALID_PROJECT_LIBRARY_MANIFEST');
  return value;
};

const removeMigrationFile = (path: string): void => {
  if (!existsSync(path)) return;
  const status = lstatSync(path);
  if (!status.isFile() || status.isSymbolicLink()) throw new Error('INVALID_PROJECT_LIBRARY_MIGRATION_STATE');
  rmSync(path);
};

const readProjectLibraryMigrationState = (directory: string): ProjectLibraryMigrationState | null => {
  const statePath = join(directory, internalDirectoryName, projectLibraryMigrationStateName);
  if (!existsSync(statePath)) return null;
  let value: unknown;
  try {
    const status = lstatSync(statePath);
    if (!status.isFile() || status.isSymbolicLink()) throw new Error('INVALID_PROJECT_LIBRARY_MIGRATION_STATE');
    value = JSON.parse(readFileSync(statePath, 'utf8')) as unknown;
  } catch {
    throw new Error('INVALID_PROJECT_LIBRARY_MIGRATION_STATE');
  }
  if (typeof value !== 'object' || value === null) throw new Error('INVALID_PROJECT_LIBRARY_MIGRATION_STATE');
  const state = value as Record<string, unknown>;
  if (state.kind !== 'designhub-workspace-migration'
    || typeof state.migrationId !== 'string'
    || !uuidPattern.test(state.migrationId)
    || typeof state.workspaceId !== 'string'
    || !uuidPattern.test(state.workspaceId)
    || !Number.isInteger(state.fromFormatVersion)
    || Number(state.fromFormatVersion) < 1
    || !Number.isInteger(state.toFormatVersion)
    || Number(state.toFormatVersion) <= Number(state.fromFormatVersion)
    || typeof state.originalManifestSha256 !== 'string'
    || !/^[0-9a-f]{64}$/u.test(state.originalManifestSha256)) {
    throw new Error('INVALID_PROJECT_LIBRARY_MIGRATION_STATE');
  }
  return state as ProjectLibraryMigrationState;
};

export const initializeProjectLibraryWriterLock = (directory: string): void => {
  const database = new Database(join(directory, internalDirectoryName, writerLockName));
  try {
    database.pragma('journal_mode = DELETE');
    database.exec('CREATE TABLE lock_marker (id INTEGER PRIMARY KEY CHECK (id = 1));');
  } finally {
    database.close();
  }
};

const acquireWriterLock = (directory: string, expectedIdentity: DirectoryIdentity): Database.Database | null => {
  assertDirectoryIdentity(directory, expectedIdentity);
  const lockPath = join(directory, internalDirectoryName, writerLockName);
  const database = new Database(lockPath, { fileMustExist: true, timeout: 0 });
  let transactionStarted = false;
  try {
    database.pragma('busy_timeout = 0');
    database.pragma('journal_mode = DELETE');
    database.pragma('locking_mode = EXCLUSIVE');
    database.exec('BEGIN EXCLUSIVE');
    transactionStarted = true;
    assertDirectoryIdentity(directory, expectedIdentity);
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

const closeWriterLock = (database: Database.Database): void => {
  database.exec('ROLLBACK');
  database.close();
};

const recoverInterruptedProjectLibraryMigration = (directory: string, expectedIdentity: DirectoryIdentity): void => {
  const stateBeforeLock = readProjectLibraryMigrationState(directory);
  if (!stateBeforeLock) return;

  const statePath = join(directory, internalDirectoryName, projectLibraryMigrationStateName);
  const writerLock = acquireWriterLock(directory, expectedIdentity);
  const manifestPath = join(directory, projectLibraryManifestName);
  if (!writerLock) {
    assertDirectoryIdentity(directory, expectedIdentity);
    if (!existsSync(manifestPath)) throw new Error('PROJECT_LIBRARY_MIGRATION_IN_PROGRESS');
    return;
  }

  try {
    assertDirectoryIdentity(directory, expectedIdentity);
    const state = readProjectLibraryMigrationState(directory);
    if (!state) return;
    const temporaryPath = join(directory, `.${projectLibraryManifestName}.migration-${state.migrationId}`);
    const rollbackPath = join(directory, `.${projectLibraryManifestName}.rollback-${state.migrationId}`);
    const matchesOriginal = (path: string): boolean => {
      const content = readFileSync(path, 'utf8');
      let value: unknown;
      try {
        value = JSON.parse(content) as unknown;
      } catch {
        return false;
      }
      return isProjectLibraryManifest(value)
        && value.libraryId === state.workspaceId
        && value.formatVersion === state.fromFormatVersion
        && createHash('sha256').update(content).digest('hex') === state.originalManifestSha256;
    };

    if (!existsSync(manifestPath)) {
      if (!existsSync(rollbackPath) || !matchesOriginal(rollbackPath)) throw new Error('INVALID_PROJECT_LIBRARY_MIGRATION_STATE');
      renameSync(rollbackPath, manifestPath);
    } else {
      const current = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
      const published = isProjectLibraryManifest(current)
        && current.libraryId === state.workspaceId
        && current.formatVersion === state.toFormatVersion;
      if (!published && !matchesOriginal(manifestPath)) throw new Error('INVALID_PROJECT_LIBRARY_MIGRATION_STATE');
      if (existsSync(rollbackPath) && !matchesOriginal(rollbackPath)) throw new Error('INVALID_PROJECT_LIBRARY_MIGRATION_STATE');
    }
    removeMigrationFile(temporaryPath);
    removeMigrationFile(rollbackPath);
    removeMigrationFile(statePath);
  } finally {
    closeWriterLock(writerLock);
  }
};

const getManagedDirectory = (rootDirectory: string, name: string): string => {
  const directory = join(rootDirectory, name);
  let status: ReturnType<typeof lstatSync>;
  try {
    status = lstatSync(directory);
  } catch {
    throw new Error('INVALID_PROJECT_LIBRARY_STRUCTURE');
  }
  if (!status.isDirectory() || status.isSymbolicLink() || realpathSync(directory) !== directory) {
    throw new Error('INVALID_PROJECT_LIBRARY_STRUCTURE');
  }
  return directory;
};

const cleanupStaleProjectStaging = (directory: string): void => {
  const projectsDirectory = getManagedDirectory(directory, 'projects');
  readdirSync(projectsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && staleProjectStagingName.test(entry.name))
    .forEach((entry) => rmSync(join(projectsDirectory, entry.name), { recursive: true, force: true }));
};

const closeHandle = (handle: ProjectLibraryHandle, database: Database.Database | null): void => {
  let closed = false;
  handle.close = () => {
    if (closed) return;
    closed = true;
    const lease = writableProjectLibraryLeases.get(handle);
    if (lease) lease.active = false;
    if (database) closeWriterLock(database);
  };
};

const createHandle = (
  directory: string,
  manifest: ProjectLibraryManifest,
  supportedFormat: number,
  expectedIdentity: DirectoryIdentity,
): ProjectLibraryHandle => {
  assertDirectoryIdentity(directory, expectedIdentity);
  managedDirectoryNames.forEach((name) => getManagedDirectory(directory, name));
  const descriptor: ProjectLibraryDescriptor = {
    libraryId: manifest.libraryId,
    directory,
    formatVersion: manifest.formatVersion,
    openMode: getOpenMode(manifest.formatVersion, supportedFormat, false),
  };

  if (manifest.formatVersion > supportedFormat) return { library: { ...descriptor, openMode: 'read-only' }, close: () => undefined };

  const database = acquireWriterLock(directory, expectedIdentity);
  if (!database) return { library: { ...descriptor, openMode: 'read-only' }, close: () => undefined };

  let currentManifest: ProjectLibraryManifest;
  try {
    assertDirectoryIdentity(directory, expectedIdentity);
    currentManifest = readProjectLibraryManifestSync(join(directory, projectLibraryManifestName));
    if (currentManifest.libraryId !== manifest.libraryId) throw new Error('PROJECT_LIBRARY_IDENTITY_MISMATCH');
    if (currentManifest.formatVersion !== manifest.formatVersion) throw new Error('PROJECT_LIBRARY_FORMAT_CHANGED');
  } catch (error) {
    closeWriterLock(database);
    throw error;
  }

  const currentDescriptor: ProjectLibraryDescriptor = {
    ...descriptor,
    formatVersion: currentManifest.formatVersion,
    openMode: getOpenMode(currentManifest.formatVersion, supportedFormat, false),
  };
  const handle: ProjectLibraryHandle = { library: currentDescriptor, close: () => undefined };
  const lease: WritableProjectLibraryLease = { library: Object.freeze({ ...currentDescriptor }), directoryIdentity: expectedIdentity, active: true };
  writableProjectLibraryLeases.set(handle, lease);
  closeHandle(handle, database);
  if (currentDescriptor.openMode === 'writable') {
    try {
      cleanupStaleProjectStaging(directory);
    } catch (error) {
      handle.close();
      throw error;
    }
  }
  return handle;
};

const readProjectLibraryManifestSync = (manifestPath: string): ProjectLibraryManifest => {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
  } catch {
    throw new Error('INVALID_PROJECT_LIBRARY_MANIFEST');
  }
  if (!isProjectLibraryManifest(value)) throw new Error('INVALID_PROJECT_LIBRARY_MANIFEST');
  return value;
};

export const getWritableProjectLibraryLease = (handle: ProjectLibraryHandle): ProjectLibraryDescriptor | null => {
  const lease = writableProjectLibraryLeases.get(handle);
  if (!lease?.active) return null;
  const currentIdentity = readDirectoryIdentity(lease.library.directory);
  if (!currentIdentity || !sameDirectoryIdentity(currentIdentity, lease.directoryIdentity)) return null;
  return lease.library;
};

export const initializeProjectLibrary = async (directory: string): Promise<ProjectLibraryHandle> => {
  const canonicalDirectory = await realpath(directory);
  const directoryIdentity = readRequiredDirectoryIdentity(canonicalDirectory);
  await access(canonicalDirectory, constants.W_OK);
  if ((await readdir(canonicalDirectory)).length > 0) throw new Error('PROJECT_LIBRARY_DIRECTORY_NOT_EMPTY');
  assertDirectoryIdentity(canonicalDirectory, directoryIdentity);

  const createdDirectories: string[] = [];
  let manifestCreated = false;
  try {
    for (const name of managedDirectoryNames) {
      const managedDirectory = join(canonicalDirectory, name);
      await mkdir(managedDirectory);
      createdDirectories.push(managedDirectory);
    }
    initializeProjectLibraryWriterLock(canonicalDirectory);
    const manifest: ProjectLibraryManifest = {
      kind: projectLibraryKind,
      libraryId: randomUUID(),
      formatVersion: projectLibraryFormatVersion,
      createdAt: new Date().toISOString(),
    };
    await writeFile(join(canonicalDirectory, projectLibraryManifestName), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    manifestCreated = true;
    assertDirectoryIdentity(canonicalDirectory, directoryIdentity);
    return createHandle(canonicalDirectory, manifest, projectLibraryFormatVersion, directoryIdentity);
  } catch (error) {
    const currentIdentity = readDirectoryIdentity(canonicalDirectory);
    if (currentIdentity && sameDirectoryIdentity(currentIdentity, directoryIdentity) && createdDirectories.length > 0) {
      await Promise.all(createdDirectories.reverse().map((createdDirectory) => rm(createdDirectory, { recursive: true, force: true })));
      if (manifestCreated) await rm(join(canonicalDirectory, projectLibraryManifestName), { force: true });
    }
    if (errorCode(error) === 'EEXIST') throw new Error('PROJECT_LIBRARY_DIRECTORY_NOT_EMPTY');
    throw error;
  }
};

export const openProjectLibrary = async (directory: string, supportedFormat = projectLibraryFormatVersion): Promise<ProjectLibraryHandle> => {
  if (!Number.isInteger(supportedFormat) || supportedFormat < 1) throw new Error('INVALID_SUPPORTED_FORMAT');
  const canonicalDirectory = await realpath(directory);
  const directoryIdentity = readRequiredDirectoryIdentity(canonicalDirectory);
  let manifestBeforeRecovery: ProjectLibraryManifest | null = null;
  try {
    manifestBeforeRecovery = await readProjectLibraryManifest(canonicalDirectory);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'NOT_A_PROJECT_LIBRARY') throw error;
  }
  assertDirectoryIdentity(canonicalDirectory, directoryIdentity);
  const migrationState = readProjectLibraryMigrationState(canonicalDirectory);
  if (manifestBeforeRecovery && migrationState && migrationState.toFormatVersion > supportedFormat) {
    throw new Error('PROJECT_LIBRARY_MIGRATION_REQUIRES_NEWER_VERSION');
  }
  if (!manifestBeforeRecovery && migrationState && migrationState.toFormatVersion > supportedFormat) {
    throw new Error('PROJECT_LIBRARY_MIGRATION_REQUIRES_NEWER_VERSION');
  }
  recoverInterruptedProjectLibraryMigration(canonicalDirectory, directoryIdentity);
  assertDirectoryIdentity(canonicalDirectory, directoryIdentity);
  const manifest = await readProjectLibraryManifest(canonicalDirectory);
  assertDirectoryIdentity(canonicalDirectory, directoryIdentity);
  return createHandle(canonicalDirectory, manifest, supportedFormat, directoryIdentity);
};
