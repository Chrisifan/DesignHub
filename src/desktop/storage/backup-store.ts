import { createHash, randomUUID } from 'node:crypto';
import {
  accessSync,
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';

import Database from 'better-sqlite3';

import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import type {
  BackupFileEntry,
  BackupManifest,
  MigrationResult,
  RestoreBackupResult,
  WorkspaceBackupStore,
} from '../../features/workspace/backup';
import { canMigrate } from '../../features/workspace/migration-policy';
import {
  getWritableWorkspaceLease,
  initializeWorkspaceWriterLock,
  workspaceManifestName,
  workspaceMigrationStateName,
} from './workspace-store';

export const backupManifestName = 'backup.manifest.json';
export const backupCompletionName = 'backup.complete.json';

export type WorkspaceBackupFault = 'file-copy'
  | 'database-backup'
  | 'backup-publish'
  | 'migration-after-original-move'
  | 'migration-publish';

type WorkspaceBackupStoreOptions = {
  failAt?: WorkspaceBackupFault;
  onBackupSourceEnumerated?: () => void;
  onBackupStagingReserved?: (directory: string) => void;
  onRestoreStagingPrepared?: (directory: string) => void;
  onRestoreDestinationReserved?: (directory: string) => void;
};

type WorkspaceManifest = {
  kind: 'designhub-workspace';
  workspaceId: string;
  name: string;
  formatVersion: number;
  createdAt: string;
};

type BackupCompletion = {
  kind: 'designhub-backup-complete';
  manifestSha256: string;
};

type ManagedInternalEntryKind = 'directory' | 'file' | 'other';
type ManagedInternalEntryPolicy = 'domain' | 'transient' | 'unmanaged';

const backupKind = 'designhub-backup';
const backupFormatVersion = 1;
const backupCompletionKind = 'designhub-backup-complete';
const backupWorkspaceDirectoryName = 'workspace';
const internalDirectoryName = '.designhub';
const managedDirectoryNames = [internalDirectoryName, 'projects', 'shared-assets', 'trash'] as const;
const projectIndexPath = `${internalDirectoryName}/project-index.sqlite`;
const workspaceSettingsPath = `${internalDirectoryName}/settings.json`;
const searchIndexPath = `${internalDirectoryName}/search-index.sqlite`;
const writerLockPrefix = `${internalDirectoryName}/writer-lock.sqlite`;
const sqliteSidecarPattern = /-(?:journal|shm|wal)$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const hashPattern = /^[0-9a-f]{64}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const errorCode = (error: unknown): string | null => isRecord(error) && typeof error.code === 'string' ? error.code : null;

const sha256 = (content: string | Buffer): string => createHash('sha256').update(content).digest('hex');

const toManifestPath = (segments: string[]): string => segments.join('/');

const manifestPathSegments = (path: string): string[] => {
  if (!path || path.startsWith('/') || path.includes('\\') || /^[a-z]:/iu.test(path)) throw new Error('INVALID_BACKUP_MANIFEST');
  const segments = path.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) throw new Error('INVALID_BACKUP_MANIFEST');
  if (path !== workspaceManifestName && !managedDirectoryNames.includes(segments[0] as typeof managedDirectoryNames[number])) {
    throw new Error('INVALID_BACKUP_MANIFEST');
  }
  return segments;
};

const isWorkspaceManifest = (value: unknown): value is WorkspaceManifest => isRecord(value)
  && value.kind === 'designhub-workspace'
  && typeof value.workspaceId === 'string'
  && uuidPattern.test(value.workspaceId)
  && typeof value.name === 'string'
  && value.name.length > 0
  && Number.isInteger(value.formatVersion)
  && Number(value.formatVersion) > 0
  && typeof value.createdAt === 'string'
  && !Number.isNaN(Date.parse(value.createdAt));

const readWorkspaceManifest = (directory: string): WorkspaceManifest => {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(join(directory, workspaceManifestName), 'utf8')) as unknown;
  } catch {
    throw new Error('INVALID_WORKSPACE_MANIFEST');
  }
  if (!isWorkspaceManifest(value)) throw new Error('INVALID_WORKSPACE_MANIFEST');
  return value;
};

const isBackupFileEntry = (value: unknown): value is BackupFileEntry => isRecord(value)
  && typeof value.path === 'string'
  && Number.isInteger(value.size)
  && Number(value.size) >= 0
  && typeof value.sha256 === 'string'
  && hashPattern.test(value.sha256)
  && (value.storage === 'file' || value.storage === 'sqlite');

const isBackupManifest = (value: unknown): value is BackupManifest => isRecord(value)
  && value.kind === backupKind
  && value.formatVersion === backupFormatVersion
  && typeof value.workspaceId === 'string'
  && uuidPattern.test(value.workspaceId)
  && typeof value.workspaceName === 'string'
  && value.workspaceName.length > 0
  && Number.isInteger(value.workspaceFormatVersion)
  && Number(value.workspaceFormatVersion) > 0
  && typeof value.createdAt === 'string'
  && !Number.isNaN(Date.parse(value.createdAt))
  && Array.isArray(value.directories)
  && value.directories.every((path) => typeof path === 'string')
  && Array.isArray(value.files)
  && value.files.every(isBackupFileEntry);

const isBackupCompletion = (value: unknown): value is BackupCompletion => isRecord(value)
  && value.kind === backupCompletionKind
  && typeof value.manifestSha256 === 'string'
  && hashPattern.test(value.manifestSha256);

const getCanonicalDirectory = (directory: string, errorMessage: string): string => {
  let canonicalDirectory: string;
  let status: ReturnType<typeof lstatSync>;
  try {
    status = lstatSync(directory);
    canonicalDirectory = realpathSync(directory);
  } catch {
    throw new Error(errorMessage);
  }
  if (!status.isDirectory() || status.isSymbolicLink()) throw new Error(errorMessage);
  return canonicalDirectory;
};

const isContainedPath = (rootDirectory: string, candidatePath: string): boolean => {
  const relativePath = relative(rootDirectory, candidatePath);
  return relativePath === '' || (!isAbsolute(relativePath) && relativePath !== '..' && !relativePath.startsWith(`..${sep}`));
};

const assertCanonicalChildDirectory = (directory: string, parentDirectory: string, errorMessage: string): void => {
  const canonicalDirectory = getCanonicalDirectory(directory, errorMessage);
  if (canonicalDirectory !== directory || dirname(directory) !== parentDirectory) throw new Error(errorMessage);
};

const getManagedSourceFile = (rootDirectory: string, relativePath: string, errorMessage: string): string => {
  const canonicalRoot = getCanonicalDirectory(rootDirectory, errorMessage);
  if (canonicalRoot !== rootDirectory) throw new Error(errorMessage);
  const filePath = join(rootDirectory, ...manifestPathSegments(relativePath));
  let status: ReturnType<typeof lstatSync>;
  let canonicalFile: string;
  try {
    status = lstatSync(filePath);
    canonicalFile = realpathSync(filePath);
  } catch {
    throw new Error(errorMessage);
  }
  if (!status.isFile() || status.isSymbolicLink() || canonicalFile !== filePath || !isContainedPath(rootDirectory, canonicalFile)) {
    throw new Error(errorMessage);
  }
  return filePath;
};

const getManagedDestinationFile = (rootDirectory: string, relativePath: string, errorMessage: string): string => {
  const canonicalRoot = getCanonicalDirectory(rootDirectory, errorMessage);
  if (canonicalRoot !== rootDirectory) throw new Error(errorMessage);
  const filePath = join(rootDirectory, ...manifestPathSegments(relativePath));
  const parentDirectory = dirname(filePath);
  const canonicalParent = getCanonicalDirectory(parentDirectory, errorMessage);
  if (canonicalParent !== parentDirectory || !isContainedPath(rootDirectory, canonicalParent)) throw new Error(errorMessage);
  try {
    lstatSync(filePath);
    throw new Error(errorMessage);
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
  }
  return filePath;
};

const assertManagedCopiedFile = (rootDirectory: string, relativePath: string, errorMessage: string): void => {
  getManagedSourceFile(rootDirectory, relativePath, errorMessage);
};

const removeOwnedPath = (path: string): void => {
  try {
    const status = lstatSync(path);
    rmSync(path, status.isSymbolicLink() ? { force: true } : { recursive: true, force: true });
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
  }
};

const validateWritableSource = (handle: WorkspaceHandle): { directory: string; manifest: WorkspaceManifest } => {
  const lease = getWritableWorkspaceLease(handle);
  if (!lease) throw new Error('WORKSPACE_NOT_WRITABLE');
  const directory = getCanonicalDirectory(lease.directory, 'INVALID_WORKSPACE_PATH');
  if (directory !== lease.directory) throw new Error('INVALID_WORKSPACE_PATH');
  const manifest = readWorkspaceManifest(directory);
  if (manifest.workspaceId !== lease.workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');
  if (manifest.formatVersion !== lease.formatVersion) throw new Error('WORKSPACE_FORMAT_CHANGED');
  return { directory, manifest };
};

const isManagedSqlitePath = (relativePath: string): boolean => (relativePath === projectIndexPath || relativePath === searchIndexPath)
  || /^(?:projects|trash)\/[^/]+\/project\.sqlite$/u.test(relativePath);

const isSqliteSidecarOf = (relativePath: string, databasePath: string): boolean => sqliteSidecarPattern.test(relativePath)
  && relativePath.replace(sqliteSidecarPattern, '') === databasePath;

const getManagedInternalEntryPolicy = (
  relativePath: string,
  kind: ManagedInternalEntryKind,
): ManagedInternalEntryPolicy => {
  if (kind === 'directory' && relativePath === internalDirectoryName) return 'domain';
  if (kind !== 'file') return 'unmanaged';
  if (relativePath === projectIndexPath || relativePath === workspaceSettingsPath || relativePath === searchIndexPath) return 'domain';
  if (relativePath === writerLockPrefix
    || isSqliteSidecarOf(relativePath, projectIndexPath)
    || isSqliteSidecarOf(relativePath, searchIndexPath)
    || isSqliteSidecarOf(relativePath, writerLockPrefix)) return 'transient';
  return 'unmanaged';
};

const shouldSkipSourceFile = (relativePath: string): boolean => getManagedInternalEntryPolicy(relativePath, 'file') === 'transient'
  || (sqliteSidecarPattern.test(relativePath) && (isManagedSqlitePath(relativePath.replace(sqliteSidecarPattern, '')) || isSqliteSidecarOf(relativePath, projectIndexPath) || isSqliteSidecarOf(relativePath, searchIndexPath)));

const collectManagedContent = (workspaceDirectory: string): { directories: string[]; files: string[] } => {
  const directories: string[] = [];
  const files = [workspaceManifestName];

  const visitDirectory = (absoluteDirectory: string, segments: string[]): void => {
    const relativeDirectory = toManifestPath(segments);
    const canonicalDirectory = realpathSync(absoluteDirectory);
    if (canonicalDirectory !== absoluteDirectory || dirname(canonicalDirectory) !== (segments.length === 1 ? workspaceDirectory : dirname(absoluteDirectory))) {
      throw new Error('UNMANAGED_BACKUP_SOURCE');
    }
    directories.push(relativeDirectory);
    readdirSync(absoluteDirectory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((entry) => {
        const entrySegments = [...segments, entry.name];
        const relativePath = toManifestPath(entrySegments);
        const absolutePath = join(absoluteDirectory, entry.name);
        if (entrySegments[0] === internalDirectoryName) {
          const kind: ManagedInternalEntryKind = entry.isFile() ? 'file' : entry.isDirectory() ? 'directory' : 'other';
          if (getManagedInternalEntryPolicy(relativePath, kind) === 'unmanaged') throw new Error('UNMANAGED_INTERNAL_FILE');
        }
        if (entry.isSymbolicLink()) throw new Error('UNMANAGED_BACKUP_SOURCE');
        if (entry.isDirectory()) {
          visitDirectory(absolutePath, entrySegments);
          return;
        }
        if (!entry.isFile()) throw new Error('UNMANAGED_BACKUP_SOURCE');
        if (!shouldSkipSourceFile(relativePath)) files.push(relativePath);
      });
  };

  managedDirectoryNames.forEach((name) => visitDirectory(join(workspaceDirectory, name), [name]));
  return { directories: directories.sort(), files: files.sort() };
};

const verifySqliteDatabase = (databasePath: string): void => {
  let database: Database.Database | null = null;
  try {
    database = new Database(databasePath, { readonly: true, fileMustExist: true });
    if (database.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('INVALID_BACKUP_DATABASE');
  } catch {
    throw new Error('INVALID_BACKUP_DATABASE');
  } finally {
    database?.close();
  }
};

const normalizeSqliteSnapshot = (databasePath: string): void => {
  const database = new Database(databasePath, { fileMustExist: true });
  try {
    database.pragma('journal_mode = DELETE');
    if (database.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('INVALID_BACKUP_DATABASE');
  } finally {
    database.close();
  }
};

const copySqliteDatabase = async (sourcePath: string, destinationPath: string): Promise<void> => {
  const database = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await database.backup(destinationPath);
  } finally {
    database.close();
  }
  normalizeSqliteSnapshot(destinationPath);
};

const describeFile = (workspaceDirectory: string, relativePath: string): BackupFileEntry => {
  const filePath = join(workspaceDirectory, ...manifestPathSegments(relativePath));
  const content = readFileSync(filePath);
  return {
    path: relativePath,
    size: content.byteLength,
    sha256: sha256(content),
    storage: isManagedSqlitePath(relativePath) ? 'sqlite' : 'file',
  };
};

const listStoredContent = (workspaceDirectory: string): { directories: string[]; files: string[] } => {
  const directories: string[] = [];
  const files: string[] = [];
  const visitDirectory = (absoluteDirectory: string, segments: string[]): void => {
    readdirSync(absoluteDirectory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((entry) => {
        const entrySegments = [...segments, entry.name];
        const relativePath = toManifestPath(entrySegments);
        const absolutePath = join(absoluteDirectory, entry.name);
        if (entry.isSymbolicLink()) throw new Error('INVALID_BACKUP_CONTENT');
        if (entry.isDirectory()) {
          directories.push(relativePath);
          visitDirectory(absolutePath, entrySegments);
          return;
        }
        if (!entry.isFile()) throw new Error('INVALID_BACKUP_CONTENT');
        files.push(relativePath);
      });
  };
  visitDirectory(workspaceDirectory, []);
  return { directories: directories.sort(), files: files.sort() };
};

const assertUniquePaths = (paths: string[]): void => {
  if (new Set(paths).size !== paths.length) throw new Error('INVALID_BACKUP_MANIFEST');
};

const verifyWorkspaceContent = (workspaceDirectory: string, manifest: BackupManifest): void => {
  const expectedDirectories = manifest.directories.map((path) => {
    const segments = manifestPathSegments(path);
    if (segments[0] === internalDirectoryName && getManagedInternalEntryPolicy(path, 'directory') !== 'domain') {
      throw new Error('UNMANAGED_INTERNAL_FILE');
    }
    return path;
  }).sort();
  const expectedFiles = manifest.files.map((entry) => {
    const segments = manifestPathSegments(entry.path);
    if (segments[0] === internalDirectoryName && getManagedInternalEntryPolicy(entry.path, 'file') !== 'domain') {
      throw new Error('UNMANAGED_INTERNAL_FILE');
    }
    const expectedStorage = isManagedSqlitePath(entry.path) ? 'sqlite' : 'file';
    if (entry.storage !== expectedStorage) throw new Error('INVALID_BACKUP_MANIFEST');
    return entry.path;
  }).sort();
  assertUniquePaths(expectedDirectories);
  assertUniquePaths(expectedFiles);
  if (!managedDirectoryNames.every((name) => expectedDirectories.includes(name))) throw new Error('INVALID_BACKUP_MANIFEST');
  if (!expectedFiles.includes(workspaceManifestName)) throw new Error('INVALID_BACKUP_MANIFEST');

  const actual = listStoredContent(workspaceDirectory);
  if (JSON.stringify(actual.directories) !== JSON.stringify(expectedDirectories)
    || JSON.stringify(actual.files) !== JSON.stringify(expectedFiles)) throw new Error('INVALID_BACKUP_CONTENT');

  manifest.files.forEach((entry) => {
    const filePath = join(workspaceDirectory, ...manifestPathSegments(entry.path));
    const content = readFileSync(filePath);
    if (content.byteLength !== entry.size || sha256(content) !== entry.sha256) throw new Error('INVALID_BACKUP_CONTENT');
    if (entry.storage === 'sqlite') verifySqliteDatabase(filePath);
  });
  const workspaceManifest = readWorkspaceManifest(workspaceDirectory);
  if (workspaceManifest.workspaceId !== manifest.workspaceId
    || workspaceManifest.name !== manifest.workspaceName
    || workspaceManifest.formatVersion !== manifest.workspaceFormatVersion) throw new Error('INVALID_BACKUP_CONTENT');
};

const verifyBackup = (backupDirectory: string): { directory: string; manifest: BackupManifest } => {
  const directory = getCanonicalDirectory(backupDirectory, 'INVALID_BACKUP');
  let completionContent: string;
  let completion: unknown;
  try {
    completionContent = readFileSync(join(directory, backupCompletionName), 'utf8');
    completion = JSON.parse(completionContent) as unknown;
  } catch {
    throw new Error('INCOMPLETE_BACKUP');
  }
  if (!isBackupCompletion(completion)) throw new Error('INCOMPLETE_BACKUP');
  const envelope = readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
  if (JSON.stringify(envelope.map(({ name }) => name)) !== JSON.stringify([
    backupCompletionName,
    backupManifestName,
    backupWorkspaceDirectoryName,
  ].sort())
    || !envelope.find(({ name }) => name === backupCompletionName)?.isFile()
    || !envelope.find(({ name }) => name === backupManifestName)?.isFile()
    || !envelope.find(({ name }) => name === backupWorkspaceDirectoryName)?.isDirectory()) throw new Error('INVALID_BACKUP');

  let manifestContent: string;
  let manifestValue: unknown;
  try {
    manifestContent = readFileSync(join(directory, backupManifestName), 'utf8');
    manifestValue = JSON.parse(manifestContent) as unknown;
  } catch {
    throw new Error('INVALID_BACKUP_MANIFEST');
  }
  if (sha256(manifestContent) !== completion.manifestSha256) throw new Error('INVALID_BACKUP_MANIFEST');
  if (!isBackupManifest(manifestValue)) throw new Error('INVALID_BACKUP_MANIFEST');
  verifyWorkspaceContent(getCanonicalDirectory(join(directory, backupWorkspaceDirectoryName), 'INVALID_BACKUP_CONTENT'), manifestValue);
  return { directory, manifest: manifestValue };
};

const assertStoredWorkspaceDirectories = (destinationDirectory: string, manifest: BackupManifest, errorMessage: string): void => {
  manifest.directories.forEach((relativePath) => {
    const directory = join(destinationDirectory, ...manifestPathSegments(relativePath));
    const canonicalDirectory = getCanonicalDirectory(directory, errorMessage);
    if (canonicalDirectory !== directory || !isContainedPath(destinationDirectory, canonicalDirectory)) throw new Error(errorMessage);
  });
};

const prepareStoredWorkspace = (destinationDirectory: string, manifest: BackupManifest, errorMessage: string): void => {
  manifest.directories.forEach((relativePath) => mkdirSync(join(destinationDirectory, ...manifestPathSegments(relativePath)), { recursive: true }));
  assertStoredWorkspaceDirectories(destinationDirectory, manifest, errorMessage);
};

const copyStoredWorkspaceFiles = (
  sourceDirectory: string,
  destinationDirectory: string,
  manifest: BackupManifest,
  includeManifest: boolean,
  destinationError: string,
): void => {
  manifest.files
    .filter(({ path }) => includeManifest || path !== workspaceManifestName)
    .forEach(({ path }) => {
      const sourcePath = getManagedSourceFile(sourceDirectory, path, 'INVALID_BACKUP_CONTENT');
      const destinationPath = getManagedDestinationFile(destinationDirectory, path, destinationError);
      copyFileSync(sourcePath, destinationPath, constants.COPYFILE_EXCL);
      assertManagedCopiedFile(sourceDirectory, path, 'INVALID_BACKUP_CONTENT');
      assertManagedCopiedFile(destinationDirectory, path, destinationError);
    });
};

const createBackup = async (
  handle: WorkspaceHandle,
  options: WorkspaceBackupStoreOptions,
  input: { destinationParentDirectory: string },
) => {
  const source = validateWritableSource(handle);
  const destinationParent = getCanonicalDirectory(input.destinationParentDirectory, 'INVALID_BACKUP_DESTINATION');
  if (isContainedPath(source.directory, destinationParent)) throw new Error('INVALID_BACKUP_DESTINATION');
  accessSync(destinationParent, constants.W_OK);
  const operationId = randomUUID();
  const stagingDirectory = join(destinationParent, `.designhub-backup-${operationId}.staging`);
  const createdAt = new Date().toISOString();
  const finalDirectory = join(destinationParent, `${source.manifest.workspaceId}-${createdAt.replace(/[:.]/gu, '-')}-${operationId}.designhub-backup`);
  const stagingWorkspace = join(stagingDirectory, backupWorkspaceDirectoryName);
  const assertOwnedStagingDirectory = (): void => {
    assertCanonicalChildDirectory(stagingDirectory, destinationParent, 'INVALID_BACKUP_DESTINATION');
  };
  const assertOwnedStagingWorkspace = (): void => {
    assertOwnedStagingDirectory();
    assertCanonicalChildDirectory(stagingWorkspace, stagingDirectory, 'INVALID_BACKUP_DESTINATION');
  };

  mkdirSync(stagingDirectory);
  try {
    options.onBackupStagingReserved?.(stagingDirectory);
    assertOwnedStagingDirectory();
    mkdirSync(stagingWorkspace);
    assertOwnedStagingWorkspace();
    const content = collectManagedContent(source.directory);
    content.directories.forEach((relativePath) => {
      assertOwnedStagingWorkspace();
      const directory = join(stagingWorkspace, ...manifestPathSegments(relativePath));
      mkdirSync(directory, { recursive: true });
      const canonicalDirectory = getCanonicalDirectory(directory, 'INVALID_BACKUP_DESTINATION');
      if (canonicalDirectory !== directory || !isContainedPath(stagingWorkspace, canonicalDirectory)) {
        throw new Error('INVALID_BACKUP_DESTINATION');
      }
    });
    options.onBackupSourceEnumerated?.();

    let fileFailureInjected = false;
    let databaseFailureInjected = false;
    for (const relativePath of content.files) {
      const sourcePath = getManagedSourceFile(source.directory, relativePath, 'UNMANAGED_BACKUP_SOURCE');
      assertOwnedStagingWorkspace();
      const destinationPath = getManagedDestinationFile(stagingWorkspace, relativePath, 'INVALID_BACKUP_DESTINATION');
      if (isManagedSqlitePath(relativePath)) {
        if (options.failAt === 'database-backup' && !databaseFailureInjected) {
          databaseFailureInjected = true;
          throw new Error('INJECTED_DATABASE_BACKUP_FAILURE');
        }
        await copySqliteDatabase(sourcePath, destinationPath);
      } else {
        if (options.failAt === 'file-copy' && !fileFailureInjected) {
          fileFailureInjected = true;
          throw new Error('INJECTED_FILE_COPY_FAILURE');
        }
        copyFileSync(sourcePath, destinationPath, constants.COPYFILE_EXCL);
      }
      assertManagedCopiedFile(source.directory, relativePath, 'UNMANAGED_BACKUP_SOURCE');
      assertOwnedStagingWorkspace();
      assertManagedCopiedFile(stagingWorkspace, relativePath, 'INVALID_BACKUP_DESTINATION');
    }

    const manifest: BackupManifest = {
      kind: backupKind,
      formatVersion: backupFormatVersion,
      workspaceId: source.manifest.workspaceId,
      workspaceName: source.manifest.name,
      workspaceFormatVersion: source.manifest.formatVersion,
      createdAt,
      directories: content.directories,
      files: content.files.map((relativePath) => {
        assertOwnedStagingWorkspace();
        return describeFile(stagingWorkspace, relativePath);
      }),
    };
    const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
    assertOwnedStagingDirectory();
    writeFileSync(join(stagingDirectory, backupManifestName), manifestContent, { encoding: 'utf8', flag: 'wx' });
    if (options.failAt === 'backup-publish') throw new Error('INJECTED_BACKUP_PUBLISH_FAILURE');
    assertOwnedStagingDirectory();
    writeFileSync(join(stagingDirectory, backupCompletionName), `${JSON.stringify({
      kind: backupCompletionKind,
      manifestSha256: sha256(manifestContent),
    }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    assertOwnedStagingDirectory();
    verifyBackup(stagingDirectory);
    assertOwnedStagingDirectory();
    if (existsSync(finalDirectory)) throw new Error('BACKUP_DIRECTORY_CONFLICT');
    assertOwnedStagingDirectory();
    renameSync(stagingDirectory, finalDirectory);
    return { directory: finalDirectory, workspaceId: manifest.workspaceId, createdAt };
  } catch (error) {
    removeOwnedPath(stagingDirectory);
    throw error;
  }
};

const restoreBackup = async (
  input: { backupDirectory: string; destinationParentDirectory: string },
  options: WorkspaceBackupStoreOptions,
): Promise<RestoreBackupResult> => {
  const backup = verifyBackup(input.backupDirectory);
  const sourceWorkspace = join(backup.directory, backupWorkspaceDirectoryName);
  const destinationParent = getCanonicalDirectory(input.destinationParentDirectory, 'INVALID_RESTORE_DESTINATION');
  accessSync(destinationParent, constants.W_OK);
  const operationId = randomUUID();
  const stagingDirectory = join(destinationParent, `.designhub-restore-${operationId}.staging`);
  const finalDirectory = join(destinationParent, `${basename(backup.manifest.workspaceName)}-restored-${operationId}`);
  let ownsFinalDirectory = false;

  mkdirSync(stagingDirectory);
  try {
    assertCanonicalChildDirectory(stagingDirectory, destinationParent, 'UNMANAGED_RESTORE_DESTINATION');
    prepareStoredWorkspace(stagingDirectory, backup.manifest, 'UNMANAGED_RESTORE_DESTINATION');
    options.onRestoreStagingPrepared?.(stagingDirectory);
    assertCanonicalChildDirectory(stagingDirectory, destinationParent, 'UNMANAGED_RESTORE_DESTINATION');
    assertStoredWorkspaceDirectories(stagingDirectory, backup.manifest, 'UNMANAGED_RESTORE_DESTINATION');
    copyStoredWorkspaceFiles(sourceWorkspace, stagingDirectory, backup.manifest, true, 'UNMANAGED_RESTORE_DESTINATION');
    verifyWorkspaceContent(stagingDirectory, backup.manifest);
    mkdirSync(finalDirectory);
    ownsFinalDirectory = true;
    assertCanonicalChildDirectory(finalDirectory, destinationParent, 'UNMANAGED_RESTORE_DESTINATION');
    prepareStoredWorkspace(finalDirectory, backup.manifest, 'UNMANAGED_RESTORE_DESTINATION');
    options.onRestoreDestinationReserved?.(finalDirectory);
    assertCanonicalChildDirectory(finalDirectory, destinationParent, 'UNMANAGED_RESTORE_DESTINATION');
    assertStoredWorkspaceDirectories(finalDirectory, backup.manifest, 'UNMANAGED_RESTORE_DESTINATION');
    copyStoredWorkspaceFiles(stagingDirectory, finalDirectory, backup.manifest, false, 'UNMANAGED_RESTORE_DESTINATION');
    getManagedDestinationFile(finalDirectory, `${internalDirectoryName}/writer-lock.sqlite`, 'UNMANAGED_RESTORE_DESTINATION');
    initializeWorkspaceWriterLock(finalDirectory);
    assertManagedCopiedFile(finalDirectory, `${internalDirectoryName}/writer-lock.sqlite`, 'UNMANAGED_RESTORE_DESTINATION');
    const sourceManifest = getManagedSourceFile(stagingDirectory, workspaceManifestName, 'INVALID_BACKUP_CONTENT');
    const destinationManifest = getManagedDestinationFile(finalDirectory, workspaceManifestName, 'UNMANAGED_RESTORE_DESTINATION');
    copyFileSync(sourceManifest, destinationManifest, constants.COPYFILE_EXCL);
    assertManagedCopiedFile(finalDirectory, workspaceManifestName, 'UNMANAGED_RESTORE_DESTINATION');
    assertCanonicalChildDirectory(stagingDirectory, destinationParent, 'UNMANAGED_RESTORE_DESTINATION');
    assertCanonicalChildDirectory(finalDirectory, destinationParent, 'UNMANAGED_RESTORE_DESTINATION');
    assertStoredWorkspaceDirectories(stagingDirectory, backup.manifest, 'UNMANAGED_RESTORE_DESTINATION');
    assertStoredWorkspaceDirectories(finalDirectory, backup.manifest, 'UNMANAGED_RESTORE_DESTINATION');
    removeOwnedPath(stagingDirectory);
    return { directory: finalDirectory, workspaceId: backup.manifest.workspaceId };
  } catch (error) {
    removeOwnedPath(stagingDirectory);
    if (ownsFinalDirectory) removeOwnedPath(finalDirectory);
    throw error;
  }
};

const migrateMetadata = async (
  handle: WorkspaceHandle,
  options: WorkspaceBackupStoreOptions,
  input: { backupDirectory: string; toFormatVersion: number },
): Promise<MigrationResult> => {
  const source = validateWritableSource(handle);
  const backup = verifyBackup(input.backupDirectory);
  const backupVerified = backup.manifest.workspaceId === source.manifest.workspaceId
    && backup.manifest.workspaceFormatVersion === source.manifest.formatVersion;
  if (!Number.isInteger(input.toFormatVersion) || !canMigrate({
    backupVerified,
    writable: getWritableWorkspaceLease(handle) !== null,
    from: source.manifest.formatVersion,
    to: input.toFormatVersion,
  })) throw new Error('MIGRATION_NOT_ALLOWED');

  const migrationId = randomUUID();
  const manifestPath = join(source.directory, workspaceManifestName);
  const temporaryPath = join(source.directory, `.${workspaceManifestName}.migration-${migrationId}`);
  const rollbackPath = join(source.directory, `.${workspaceManifestName}.rollback-${migrationId}`);
  const nextManifest = { ...source.manifest, formatVersion: input.toFormatVersion };
  const statePath = join(source.directory, internalDirectoryName, workspaceMigrationStateName);
  const originalManifestContent = readFileSync(manifestPath, 'utf8');
  const migrationState = {
    kind: 'designhub-workspace-migration',
    migrationId,
    workspaceId: source.manifest.workspaceId,
    fromFormatVersion: source.manifest.formatVersion,
    toFormatVersion: input.toFormatVersion,
    originalManifestSha256: sha256(originalManifestContent),
  };

  try {
    writeFileSync(statePath, `${JSON.stringify(migrationState, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    writeFileSync(temporaryPath, `${JSON.stringify(nextManifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    renameSync(manifestPath, rollbackPath);
  } catch (error) {
    removeOwnedPath(temporaryPath);
    removeOwnedPath(statePath);
    throw error;
  }
  if (options.failAt === 'migration-after-original-move') throw new Error('INJECTED_MIGRATION_INTERRUPTION');

  try {
    renameSync(temporaryPath, manifestPath);
    if (options.failAt === 'migration-publish') throw new Error('INJECTED_MIGRATION_PUBLISH_FAILURE');
    rmSync(statePath);
    rmSync(rollbackPath);
    return { fromFormatVersion: source.manifest.formatVersion, toFormatVersion: input.toFormatVersion };
  } catch (error) {
    removeOwnedPath(temporaryPath);
    if (existsSync(rollbackPath)) {
      removeOwnedPath(manifestPath);
      renameSync(rollbackPath, manifestPath);
    }
    removeOwnedPath(statePath);
    throw error;
  }
};

export const createWorkspaceBackupStore = (
  handle: WorkspaceHandle,
  options: WorkspaceBackupStoreOptions = {},
): WorkspaceBackupStore => ({
  createBackup: (input) => createBackup(handle, options, input),
  restoreBackup: (input) => restoreBackup(input, options),
  migrateMetadata: (input) => migrateMetadata(handle, options, input),
});
