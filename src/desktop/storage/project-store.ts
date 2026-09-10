import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import Database from 'better-sqlite3';

import type { WorkspaceDescriptor, WorkspaceHandle } from '../../features/workspace/open-workspace';
import type {
  CreateProjectContainerInput,
  CreateProjectContainerResult,
  ProjectStore,
  RestoreProjectResult,
  TrashedProject,
  TrashProjectInput,
} from '../../features/workspace/project-store';
import { canPurge } from '../../features/workspace/trash-policy';
import { getWritableWorkspaceLease } from './workspace-store';

export const projectManifestName = 'designhub.project.json';
export const projectContentManifestName = 'content-manifest.json';
export const projectDatabaseName = 'project.sqlite';
export const workspaceProjectIndexName = 'project-index.sqlite';

const workspaceManifestName = 'designhub.workspace.json';
const workspaceKind = 'designhub-workspace';
const projectKind = 'designhub-project';
const projectFormatVersion = 1;
const internalDirectoryName = '.designhub';
const trashMetadataName = '.designhub-trash.json';
const trashMetadataKind = 'designhub-trash-entry';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type WorkspaceManifest = {
  kind: typeof workspaceKind;
  workspaceId: string;
  formatVersion: number;
};

type ProjectManifest = {
  kind: typeof projectKind;
  projectId: string;
  operationId: string;
  name: string;
  formatVersion: number;
  createdAt: string;
};

type ProjectContentManifest = {
  formatVersion: number;
  projectId: string;
  assets: unknown[];
};

type ProjectOperation = {
  projectId: string;
  directoryName: string;
  state: 'pending' | 'published';
};

type IndexedProject = {
  projectId: string;
  directoryName: string;
  displayName: string;
};

type TrashState = 'trashing' | 'trashed' | 'restoring';

type TrashEntry = {
  projectId: string;
  originalRelativePath: string;
  deletedAt: string;
  state: TrashState;
};

type TrashMetadata = Omit<TrashEntry, 'state'> & {
  kind: typeof trashMetadataKind;
};

type ProjectStoreOptions = {
  failAt?: ProjectStoreFault;
  getLiveReferenceCount?: (projectId: string) => number;
};

export type ProjectStoreFault = 'database-write' | 'publish' | 'index-update';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const errorCode = (error: unknown): string | null => {
  if (!isRecord(error) || typeof error.code !== 'string') return null;
  return error.code;
};

const isIndexCorruption = (error: unknown): boolean => {
  const code = errorCode(error);
  return code === 'SQLITE_CORRUPT' || code === 'SQLITE_NOTADB';
};

const isInvalidProjectDatabaseError = (error: unknown): boolean => {
  const code = errorCode(error);
  return code === 'ENOENT' || code === 'SQLITE_CORRUPT' || code === 'SQLITE_NOTADB' || code === 'SQLITE_ERROR';
};

const readJson = (path: string, errorMessage: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    throw new Error(errorMessage);
  }
};

const isWorkspaceManifest = (value: unknown): value is WorkspaceManifest => isRecord(value)
  && value.kind === workspaceKind
  && typeof value.workspaceId === 'string'
  && typeof value.formatVersion === 'number'
  && Number.isInteger(value.formatVersion)
  && value.formatVersion > 0;

const isProjectManifest = (value: unknown): value is ProjectManifest => isRecord(value)
  && value.kind === projectKind
  && typeof value.projectId === 'string'
  && uuidPattern.test(value.projectId)
  && typeof value.operationId === 'string'
  && value.operationId.length > 0
  && value.operationId.length <= 512
  && !/\u0000/u.test(value.operationId)
  && typeof value.name === 'string'
  && value.name.trim().length > 0
  && Number.isInteger(value.formatVersion)
  && value.formatVersion === projectFormatVersion
  && typeof value.createdAt === 'string'
  && !Number.isNaN(Date.parse(value.createdAt));

const isProjectContentManifest = (value: unknown, projectId: string): value is ProjectContentManifest => isRecord(value)
  && value.formatVersion === projectFormatVersion
  && value.projectId === projectId
  && Array.isArray(value.assets);

const hasValidProjectDatabase = (projectDirectory: string, manifest: ProjectManifest): boolean => {
  let database: Database.Database | null = null;
  try {
    database = new Database(join(projectDirectory, projectDatabaseName), { readonly: true, fileMustExist: true, timeout: 0 });
    if (database.pragma('user_version', { simple: true }) !== projectFormatVersion) return false;
    const metadata = database.prepare('SELECT project_id as projectId, display_name as displayName, format_version as formatVersion FROM project_metadata WHERE project_id = ?').get(manifest.projectId);
    return isRecord(metadata)
      && metadata.projectId === manifest.projectId
      && metadata.displayName === manifest.name
      && metadata.formatVersion === manifest.formatVersion;
  } catch (error) {
    if (isInvalidProjectDatabaseError(error)) return false;
    throw error;
  } finally {
    database?.close();
  }
};

const validateProjectName = (name: string): string => {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName === '.' || trimmedName === '..' || /[\\/\u0000-\u001F]/u.test(trimmedName)) {
    throw new Error('INVALID_PROJECT_NAME');
  }
  return trimmedName;
};

const validateOperationId = (operationId: string): void => {
  if (!operationId || operationId.length > 512 || /\u0000/u.test(operationId)) throw new Error('INVALID_OPERATION_ID');
};

const isProjectOperation = (value: unknown): value is ProjectOperation => isRecord(value)
  && typeof value.projectId === 'string'
  && uuidPattern.test(value.projectId)
  && value.directoryName === value.projectId
  && (value.state === 'pending' || value.state === 'published');

const validateProjectOperation = (value: unknown): ProjectOperation => {
  if (!isProjectOperation(value)) throw new Error('INVALID_PROJECT_INDEX');
  return value;
};

const validateWorkspace = (workspace: WorkspaceDescriptor, workspaceId: string): { directory: string; projectsDirectory: string; trashDirectory: string; indexDirectory: string } => {
  if (workspace.openMode !== 'writable') throw new Error('WORKSPACE_NOT_WRITABLE');
  if (workspace.workspaceId !== workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');

  const directory = realpathSync(workspace.directory);
  const manifest = readJson(join(directory, workspaceManifestName), 'INVALID_WORKSPACE_MANIFEST');
  if (!isWorkspaceManifest(manifest)) throw new Error('INVALID_WORKSPACE_MANIFEST');
  if (manifest.workspaceId !== workspace.workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');
  if (manifest.formatVersion !== workspace.formatVersion) throw new Error('WORKSPACE_FORMAT_CHANGED');

  const projectsDirectory = realpathSync(join(directory, 'projects'));
  const trashDirectory = realpathSync(join(directory, 'trash'));
  const indexDirectory = realpathSync(join(directory, internalDirectoryName));
  if (dirname(projectsDirectory) !== directory || dirname(trashDirectory) !== directory || dirname(indexDirectory) !== directory) throw new Error('INVALID_WORKSPACE_PATH');
  return { directory, projectsDirectory, trashDirectory, indexDirectory };
};

const configureIndex = (database: Database.Database): void => {
  database.pragma('journal_mode = DELETE');
  database.exec(`
    CREATE TABLE IF NOT EXISTS project_operations (
      operation_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      directory_name TEXT NOT NULL UNIQUE,
      state TEXT NOT NULL CHECK (state IN ('pending', 'published'))
    );
    CREATE TABLE IF NOT EXISTS projects (
      project_id TEXT PRIMARY KEY,
      directory_name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS trash_entries (
      project_id TEXT PRIMARY KEY,
      original_relative_path TEXT NOT NULL,
      deleted_at TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('trashing', 'trashed', 'restoring'))
    );
  `);
};

const readValidPublishedProject = (projectDirectory: string): ProjectManifest | null => {
  let manifest: unknown;
  let contentManifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(join(projectDirectory, projectManifestName), 'utf8')) as unknown;
    contentManifest = JSON.parse(readFileSync(join(projectDirectory, projectContentManifestName), 'utf8')) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError || errorCode(error) === 'ENOENT') return null;
    throw error;
  }
  if (!isProjectManifest(manifest)
    || !isProjectContentManifest(contentManifest, manifest.projectId)
    || !hasValidProjectDatabase(projectDirectory, manifest)) return null;
  return manifest;
};

const isProjectDirectoryName = (directoryName: string, projectId: string): boolean => {
  if (directoryName === projectId) return true;
  const restoredPrefix = `${projectId}-restored-`;
  return directoryName.startsWith(restoredPrefix) && uuidPattern.test(directoryName.slice(restoredPrefix.length));
};

const getOriginalRelativePath = (directoryName: string, projectId: string): string => {
  if (!isProjectDirectoryName(directoryName, projectId)) throw new Error('INVALID_PROJECT_DIRECTORY');
  return `projects/${directoryName}`;
};

const isOriginalRelativePath = (value: unknown, projectId: string): value is string => {
  if (typeof value !== 'string' || !value.startsWith('projects/')) return false;
  const directoryName = value.slice('projects/'.length);
  return isProjectDirectoryName(directoryName, projectId) && `projects/${directoryName}` === value;
};

const isTrashMetadata = (value: unknown): value is TrashMetadata => isRecord(value)
  && value.kind === trashMetadataKind
  && typeof value.projectId === 'string'
  && uuidPattern.test(value.projectId)
  && isOriginalRelativePath(value.originalRelativePath, value.projectId)
  && typeof value.deletedAt === 'string'
  && !Number.isNaN(Date.parse(value.deletedAt));

const readTrashMetadata = (projectDirectory: string): TrashMetadata | null => {
  let metadata: unknown;
  try {
    metadata = JSON.parse(readFileSync(join(projectDirectory, trashMetadataName), 'utf8')) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError || errorCode(error) === 'ENOENT') return null;
    throw error;
  }
  return isTrashMetadata(metadata) ? metadata : null;
};

const scanPublishedProjects = (projectsDirectory: string): Array<{ manifest: ProjectManifest; directoryName: string }> => readdirSync(projectsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .flatMap((entry) => {
    const projectDirectory = join(projectsDirectory, entry.name);
    const manifest = readValidPublishedProject(projectDirectory);
    if (!manifest || !isProjectDirectoryName(entry.name, manifest.projectId)) return [];
    return [{ manifest, directoryName: entry.name }];
  });

const scanTrashedProjects = (trashDirectory: string): TrashMetadata[] => readdirSync(trashDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && uuidPattern.test(entry.name))
  .flatMap((entry) => {
    const projectDirectory = join(trashDirectory, entry.name);
    const manifest = readValidPublishedProject(projectDirectory);
    const metadata = readTrashMetadata(projectDirectory);
    if (!manifest || !metadata || manifest.projectId !== entry.name || metadata.projectId !== manifest.projectId) return [];
    return [metadata];
  });

const reconcileTrashedProjects = (database: Database.Database, trashDirectory: string): Set<string> => {
  const insertTrash = database.prepare("INSERT INTO trash_entries (project_id, original_relative_path, deleted_at, state) VALUES (?, ?, ?, 'trashed') ON CONFLICT(project_id) DO UPDATE SET original_relative_path = excluded.original_relative_path, deleted_at = excluded.deleted_at, state = 'trashed'");
  const removeProject = database.prepare('DELETE FROM projects WHERE project_id = ?');
  const reconcile = database.transaction((metadata: TrashMetadata): void => {
    insertTrash.run(metadata.projectId, metadata.originalRelativePath, metadata.deletedAt);
    removeProject.run(metadata.projectId);
  });
  const metadata = scanTrashedProjects(trashDirectory);
  metadata.forEach((entry) => reconcile(entry));
  const present = new Set(metadata.map((entry) => entry.projectId));
  const clearMissing = database.prepare('DELETE FROM trash_entries WHERE project_id = ?');
  const stale = database.prepare('SELECT project_id as projectId FROM trash_entries').all() as Array<{ projectId: string }>;
  stale.filter((entry) => !present.has(entry.projectId)).forEach((entry) => clearMissing.run(entry.projectId));
  return present;
};

const reconcilePublishedProjects = (database: Database.Database, projectsDirectory: string, trashedProjectIds: Set<string>): void => {
  const insertProject = database.prepare('INSERT OR IGNORE INTO projects (project_id, directory_name, display_name) VALUES (?, ?, ?)');
  const insertOperation = database.prepare("INSERT OR IGNORE INTO project_operations (operation_id, project_id, directory_name, state) VALUES (?, ?, ?, 'published')");
  const getOperation = database.prepare('SELECT project_id as projectId, directory_name as directoryName FROM project_operations WHERE operation_id = ?');
  const reconcile = database.transaction(({ manifest, directoryName }: { manifest: ProjectManifest; directoryName: string }): void => {
    insertProject.run(manifest.projectId, directoryName, manifest.name);
    insertOperation.run(manifest.operationId, manifest.projectId, manifest.projectId);
    const operation = getOperation.get(manifest.operationId) as Pick<ProjectOperation, 'projectId' | 'directoryName'> | undefined;
    if (!operation || operation.projectId !== manifest.projectId || operation.directoryName !== manifest.projectId) throw new Error('INDEX_MANIFEST_CONFLICT');
  });
  scanPublishedProjects(projectsDirectory)
    .filter(({ manifest }) => !trashedProjectIds.has(manifest.projectId))
    .forEach((project) => reconcile(project));
};

const reconcileIndex = (database: Database.Database, projectsDirectory: string, trashDirectory: string): void => {
  const trashedProjectIds = reconcileTrashedProjects(database, trashDirectory);
  reconcilePublishedProjects(database, projectsDirectory, trashedProjectIds);
};

const rebuildCorruptIndex = (indexPath: string, projectsDirectory: string, trashDirectory: string): Database.Database => {
  const temporaryPath = `${indexPath}.rebuild-${randomUUID()}`;
  const corruptPath = `${indexPath}.corrupt-${randomUUID()}`;
  let temporaryDatabase: Database.Database | null = null;
  let movedCorruptIndex = false;
  let publishedReplacement = false;
  try {
    temporaryDatabase = new Database(temporaryPath);
    configureIndex(temporaryDatabase);
    reconcileIndex(temporaryDatabase, projectsDirectory, trashDirectory);
    temporaryDatabase.close();
    temporaryDatabase = null;
    if (existsSync(indexPath)) {
      renameSync(indexPath, corruptPath);
      movedCorruptIndex = true;
    }
    renameSync(temporaryPath, indexPath);
    publishedReplacement = true;
    return new Database(indexPath, { fileMustExist: true, timeout: 0 });
  } catch (error) {
    temporaryDatabase?.close();
    if (movedCorruptIndex) {
      if (publishedReplacement && existsSync(indexPath)) rmSync(indexPath, { force: true });
      if (!existsSync(indexPath)) renameSync(corruptPath, indexPath);
    }
    if (existsSync(temporaryPath)) rmSync(temporaryPath, { force: true });
    throw error;
  }
};

const openIndex = (indexDirectory: string, projectsDirectory: string, trashDirectory: string): Database.Database => {
  const indexPath = join(indexDirectory, workspaceProjectIndexName);
  let database: Database.Database | null = null;
  try {
    database = new Database(indexPath, { timeout: 0 });
    configureIndex(database);
    reconcileIndex(database, projectsDirectory, trashDirectory);
    return database;
  } catch (error) {
    database?.close();
    if (!isIndexCorruption(error)) throw error;
    return rebuildCorruptIndex(indexPath, projectsDirectory, trashDirectory);
  }
};

const reserveOperation = (database: Database.Database, operationId: string): ProjectOperation => {
  const getOperation = database.prepare('SELECT project_id as projectId, directory_name as directoryName, state FROM project_operations WHERE operation_id = ?');
  const insertOperation = database.prepare("INSERT INTO project_operations (operation_id, project_id, directory_name, state) VALUES (?, ?, ?, 'pending')");
  const reserve = database.transaction((): ProjectOperation => {
    const existing = getOperation.get(operationId);
    if (existing) return validateProjectOperation(existing);
    const projectId = randomUUID();
    insertOperation.run(operationId, projectId, projectId);
    return { projectId, directoryName: projectId, state: 'pending' };
  });
  return reserve();
};

const getPublishedProject = (database: Database.Database, projectsDirectory: string, operation: ProjectOperation, operationId: string): ProjectManifest | null => {
  const indexedProject = database.prepare('SELECT project_id as projectId, directory_name as directoryName, display_name as displayName FROM projects WHERE project_id = ?').get(operation.projectId);
  const directoryName = indexedProject === undefined
    ? operation.directoryName
    : (() => {
      if (!isRecord(indexedProject) || typeof indexedProject.projectId !== 'string' || typeof indexedProject.directoryName !== 'string' || typeof indexedProject.displayName !== 'string') {
        throw new Error('INVALID_PROJECT_INDEX');
      }
      if (indexedProject.projectId !== operation.projectId || !isProjectDirectoryName(indexedProject.directoryName, operation.projectId)) throw new Error('INVALID_PROJECT_INDEX');
      return indexedProject.directoryName;
    })();
  const projectDirectory = join(projectsDirectory, directoryName);
  if (!existsSync(projectDirectory)) return null;
  const manifest = readValidPublishedProject(projectDirectory);
  if (!manifest || manifest.projectId !== operation.projectId || manifest.operationId !== operationId) return null;
  return manifest;
};

const markPublished = (database: Database.Database, operationId: string, operation: ProjectOperation, manifest: ProjectManifest): void => {
  const updateOperation = database.prepare("UPDATE project_operations SET state = 'published' WHERE operation_id = ?");
  const insertProject = database.prepare('INSERT OR IGNORE INTO projects (project_id, directory_name, display_name) VALUES (?, ?, ?)');
  const publish = database.transaction((): void => {
    updateOperation.run(operationId);
    insertProject.run(operation.projectId, operation.directoryName, manifest.name);
  });
  publish();
};

const initializeProject = (
  temporaryDirectory: string,
  input: CreateProjectContainerInput,
  operation: ProjectOperation,
  name: string,
  failAt: ProjectStoreFault | undefined,
): void => {
  const databasePath = join(temporaryDirectory, projectDatabaseName);
  const projectDatabase = new Database(databasePath);
  try {
    const initializeMetadata = projectDatabase.transaction((): void => {
      projectDatabase.pragma(`user_version = ${projectFormatVersion}`);
      projectDatabase.exec('CREATE TABLE project_metadata (project_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, format_version INTEGER NOT NULL);');
      if (failAt === 'database-write') throw new Error('INJECTED_DATABASE_WRITE_FAILURE');
      projectDatabase.prepare('INSERT INTO project_metadata (project_id, display_name, format_version) VALUES (?, ?, ?)').run(operation.projectId, name, projectFormatVersion);
    });
    initializeMetadata();
  } finally {
    projectDatabase.close();
  }

  const projectManifest: ProjectManifest = {
    kind: projectKind,
    projectId: operation.projectId,
    operationId: input.operationId,
    name,
    formatVersion: projectFormatVersion,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(join(temporaryDirectory, projectManifestName), `${JSON.stringify(projectManifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  writeFileSync(join(temporaryDirectory, projectContentManifestName), `${JSON.stringify({ formatVersion: projectFormatVersion, projectId: operation.projectId, assets: [] }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
};

const createProject = (handle: WorkspaceHandle, options: ProjectStoreOptions, input: CreateProjectContainerInput): CreateProjectContainerResult => {
  const workspace = getWritableWorkspaceLease(handle);
  if (!workspace) throw new Error('WORKSPACE_NOT_WRITABLE');
  const name = validateProjectName(input.name);
  validateOperationId(input.operationId);
  const paths = validateWorkspace(workspace, input.workspaceId);
  const index = openIndex(paths.indexDirectory, paths.projectsDirectory, paths.trashDirectory);

  try {
    const operation = reserveOperation(index, input.operationId);
    const publishedProject = getPublishedProject(index, paths.projectsDirectory, operation, input.operationId);
    if (operation.state === 'published' && !publishedProject) throw new Error('PUBLISHED_PROJECT_MISSING');
    if (publishedProject) {
      markPublished(index, input.operationId, operation, publishedProject);
      return { projectId: operation.projectId };
    }

    const projectDirectory = join(paths.projectsDirectory, operation.directoryName);
    const temporaryDirectory = join(paths.projectsDirectory, `.${operation.directoryName}.creating-${randomUUID()}`);
    let ownsTemporaryDirectory = false;
    let published = false;
    try {
      if (existsSync(projectDirectory)) throw new Error('PROJECT_DIRECTORY_CONFLICT');
      mkdirSync(temporaryDirectory);
      ownsTemporaryDirectory = true;
      initializeProject(temporaryDirectory, input, operation, name, options.failAt);
      if (options.failAt === 'publish') throw new Error('INJECTED_PUBLISH_FAILURE');
      renameSync(temporaryDirectory, projectDirectory);
      ownsTemporaryDirectory = false;
      published = true;
      if (options.failAt === 'index-update') throw new Error('INJECTED_INDEX_UPDATE_FAILURE');
      const publishedManifest = getPublishedProject(index, paths.projectsDirectory, operation, input.operationId);
      if (!publishedManifest) throw new Error('PUBLISHED_PROJECT_MISSING');
      markPublished(index, input.operationId, operation, publishedManifest);
      return { projectId: operation.projectId };
    } catch (error) {
      if (!published && ownsTemporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
      throw error;
    }
  } finally {
    index.close();
  }
};

const validateProjectId = (projectId: string): void => {
  if (!uuidPattern.test(projectId)) throw new Error('INVALID_PROJECT_ID');
};

const getActiveProject = (database: Database.Database, projectsDirectory: string, projectId: string): IndexedProject => {
  const value = database.prepare('SELECT project_id as projectId, directory_name as directoryName, display_name as displayName FROM projects WHERE project_id = ?').get(projectId);
  if (!isRecord(value) || value.projectId !== projectId || typeof value.directoryName !== 'string' || typeof value.displayName !== 'string') {
    throw new Error('PROJECT_NOT_FOUND');
  }
  if (!isProjectDirectoryName(value.directoryName, projectId)) throw new Error('INVALID_PROJECT_INDEX');
  const projectDirectory = join(projectsDirectory, value.directoryName);
  const manifest = readValidPublishedProject(projectDirectory);
  if (!manifest || manifest.projectId !== projectId) throw new Error('PROJECT_NOT_FOUND');
  return { projectId, directoryName: value.directoryName, displayName: value.displayName };
};

const getTrashedProject = (database: Database.Database, projectId: string): TrashEntry => {
  const value = database.prepare('SELECT project_id as projectId, original_relative_path as originalRelativePath, deleted_at as deletedAt, state FROM trash_entries WHERE project_id = ?').get(projectId);
  if (!isRecord(value)
    || value.projectId !== projectId
    || !isOriginalRelativePath(value.originalRelativePath, projectId)
    || typeof value.deletedAt !== 'string'
    || Number.isNaN(Date.parse(value.deletedAt))
    || (value.state !== 'trashing' && value.state !== 'trashed' && value.state !== 'restoring')) {
    throw new Error('TRASH_ENTRY_NOT_FOUND');
  }
  return { projectId, originalRelativePath: value.originalRelativePath, deletedAt: value.deletedAt, state: value.state };
};

const writeTrashMetadata = (projectDirectory: string, entry: TrashedProject): void => {
  const metadata: TrashMetadata = { kind: trashMetadataKind, ...entry };
  writeFileSync(join(projectDirectory, trashMetadataName), `${JSON.stringify(metadata, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
};

const removeTrashMetadata = (projectDirectory: string): void => {
  rmSync(join(projectDirectory, trashMetadataName), { force: true });
};

const listTrashedProjects = (handle: WorkspaceHandle): TrashedProject[] => {
  const workspace = getWritableWorkspaceLease(handle);
  if (!workspace) throw new Error('WORKSPACE_NOT_WRITABLE');
  const paths = validateWorkspace(workspace, workspace.workspaceId);
  const index = openIndex(paths.indexDirectory, paths.projectsDirectory, paths.trashDirectory);
  try {
    return (index.prepare("SELECT project_id as projectId, original_relative_path as originalRelativePath, deleted_at as deletedAt FROM trash_entries WHERE state = 'trashed' ORDER BY deleted_at, project_id").all() as TrashedProject[]);
  } finally {
    index.close();
  }
};

const moveProjectToTrash = (handle: WorkspaceHandle, input: TrashProjectInput): TrashedProject => {
  const workspace = getWritableWorkspaceLease(handle);
  if (!workspace) throw new Error('WORKSPACE_NOT_WRITABLE');
  validateProjectId(input.projectId);
  const paths = validateWorkspace(workspace, input.workspaceId);
  const index = openIndex(paths.indexDirectory, paths.projectsDirectory, paths.trashDirectory);
  try {
    const activeProject = getActiveProject(index, paths.projectsDirectory, input.projectId);
    const projectDirectory = join(paths.projectsDirectory, activeProject.directoryName);
    const trashDirectory = join(paths.trashDirectory, input.projectId);
    if (existsSync(trashDirectory)) throw new Error('TRASH_DIRECTORY_CONFLICT');
    removeTrashMetadata(projectDirectory);
    const entry: TrashedProject = {
      projectId: input.projectId,
      originalRelativePath: getOriginalRelativePath(activeProject.directoryName, input.projectId),
      deletedAt: new Date().toISOString(),
    };
    index.prepare("INSERT INTO trash_entries (project_id, original_relative_path, deleted_at, state) VALUES (?, ?, ?, 'trashing')").run(entry.projectId, entry.originalRelativePath, entry.deletedAt);
    try {
      writeTrashMetadata(projectDirectory, entry);
      renameSync(projectDirectory, trashDirectory);
      const markTrashed = index.transaction((): void => {
        index.prepare("UPDATE trash_entries SET state = 'trashed' WHERE project_id = ?").run(entry.projectId);
        index.prepare('DELETE FROM projects WHERE project_id = ?').run(entry.projectId);
      });
      markTrashed();
      return entry;
    } catch (error) {
      if (existsSync(projectDirectory)) {
        removeTrashMetadata(projectDirectory);
        index.prepare('DELETE FROM trash_entries WHERE project_id = ?').run(entry.projectId);
      }
      throw error;
    }
  } finally {
    index.close();
  }
};

const restoreProjectFromTrash = (handle: WorkspaceHandle, input: TrashProjectInput): RestoreProjectResult => {
  const workspace = getWritableWorkspaceLease(handle);
  if (!workspace) throw new Error('WORKSPACE_NOT_WRITABLE');
  validateProjectId(input.projectId);
  const paths = validateWorkspace(workspace, input.workspaceId);
  const index = openIndex(paths.indexDirectory, paths.projectsDirectory, paths.trashDirectory);
  try {
    const entry = getTrashedProject(index, input.projectId);
    if (entry.state !== 'trashed') throw new Error('TRASH_ENTRY_NOT_READY');
    const trashProjectDirectory = join(paths.trashDirectory, entry.projectId);
    const manifest = readValidPublishedProject(trashProjectDirectory);
    const metadata = readTrashMetadata(trashProjectDirectory);
    if (!manifest || !metadata || manifest.projectId !== entry.projectId || metadata.projectId !== entry.projectId) throw new Error('TRASH_ENTRY_NOT_FOUND');
    const originalDirectoryName = entry.originalRelativePath.slice('projects/'.length);
    let restoredDirectoryName = originalDirectoryName;
    let restoredDirectory = join(paths.projectsDirectory, restoredDirectoryName);
    while (existsSync(restoredDirectory)) {
      restoredDirectoryName = `${entry.projectId}-restored-${randomUUID()}`;
      restoredDirectory = join(paths.projectsDirectory, restoredDirectoryName);
    }
    index.prepare("UPDATE trash_entries SET state = 'restoring' WHERE project_id = ?").run(entry.projectId);
    renameSync(trashProjectDirectory, restoredDirectory);
    removeTrashMetadata(restoredDirectory);
    const markRestored = index.transaction((): void => {
      index.prepare('DELETE FROM trash_entries WHERE project_id = ?').run(entry.projectId);
      index.prepare('INSERT OR REPLACE INTO projects (project_id, directory_name, display_name) VALUES (?, ?, ?)').run(entry.projectId, restoredDirectoryName, manifest.name);
    });
    markRestored();
    return { projectId: entry.projectId, restoredRelativePath: `projects/${restoredDirectoryName}` };
  } finally {
    index.close();
  }
};

const purgeProjectFromTrash = (handle: WorkspaceHandle, options: ProjectStoreOptions, input: TrashProjectInput): void => {
  const workspace = getWritableWorkspaceLease(handle);
  if (!workspace) throw new Error('WORKSPACE_NOT_WRITABLE');
  validateProjectId(input.projectId);
  if (!options.getLiveReferenceCount) throw new Error('LIVE_REFERENCE_PROVIDER_UNAVAILABLE');
  const paths = validateWorkspace(workspace, input.workspaceId);
  const index = openIndex(paths.indexDirectory, paths.projectsDirectory, paths.trashDirectory);
  try {
    const entry = getTrashedProject(index, input.projectId);
    if (entry.state !== 'trashed') throw new Error('TRASH_ENTRY_NOT_READY');
    const liveReferences = options.getLiveReferenceCount(entry.projectId);
    if (!Number.isInteger(liveReferences) || liveReferences < 0) throw new Error('INVALID_LIVE_REFERENCE_COUNT');
    if (!canPurge(liveReferences)) throw new Error('PROJECT_HAS_LIVE_REFERENCES');
    const trashProjectDirectory = join(paths.trashDirectory, entry.projectId);
    const manifest = readValidPublishedProject(trashProjectDirectory);
    const metadata = readTrashMetadata(trashProjectDirectory);
    if (!manifest || !metadata || manifest.projectId !== entry.projectId || metadata.projectId !== entry.projectId) throw new Error('TRASH_ENTRY_NOT_FOUND');
    rmSync(trashProjectDirectory, { recursive: true, force: false });
    index.prepare('DELETE FROM trash_entries WHERE project_id = ?').run(entry.projectId);
  } finally {
    index.close();
  }
};

export const createProjectStore = (handle: WorkspaceHandle, options: ProjectStoreOptions = {}): ProjectStore => ({
  createProjectContainer: async (input): Promise<CreateProjectContainerResult> => createProject(handle, options, input),
  moveProjectToTrash: async (input): Promise<TrashedProject> => moveProjectToTrash(handle, input),
  listTrashedProjects: async (): Promise<TrashedProject[]> => listTrashedProjects(handle),
  restoreProjectFromTrash: async (input): Promise<RestoreProjectResult> => restoreProjectFromTrash(handle, input),
  purgeProjectFromTrash: async (input): Promise<void> => purgeProjectFromTrash(handle, options, input),
});
