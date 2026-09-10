import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import Database from 'better-sqlite3';

import type { WorkspaceDescriptor, WorkspaceHandle } from '../../features/workspace/open-workspace';
import type { CreateProjectContainerInput, CreateProjectContainerResult } from '../../features/workspace/project-store';
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

type ProjectStoreOptions = {
  failAt?: ProjectStoreFault;
};

export type ProjectStoreFault = 'database-write' | 'publish' | 'index-update';

export type ProjectStore = {
  createProjectContainer: (input: CreateProjectContainerInput) => Promise<CreateProjectContainerResult>;
};

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

const validateWorkspace = (workspace: WorkspaceDescriptor, workspaceId: string): { directory: string; projectsDirectory: string; indexDirectory: string } => {
  if (workspace.openMode !== 'writable') throw new Error('WORKSPACE_NOT_WRITABLE');
  if (workspace.workspaceId !== workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');

  const directory = realpathSync(workspace.directory);
  const manifest = readJson(join(directory, workspaceManifestName), 'INVALID_WORKSPACE_MANIFEST');
  if (!isWorkspaceManifest(manifest)) throw new Error('INVALID_WORKSPACE_MANIFEST');
  if (manifest.workspaceId !== workspace.workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');
  if (manifest.formatVersion !== workspace.formatVersion) throw new Error('WORKSPACE_FORMAT_CHANGED');

  const projectsDirectory = realpathSync(join(directory, 'projects'));
  const indexDirectory = realpathSync(join(directory, internalDirectoryName));
  if (dirname(projectsDirectory) !== directory || dirname(indexDirectory) !== directory) throw new Error('INVALID_WORKSPACE_PATH');
  return { directory, projectsDirectory, indexDirectory };
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

const scanPublishedProjects = (projectsDirectory: string): ProjectManifest[] => readdirSync(projectsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .flatMap((entry) => {
    const projectDirectory = join(projectsDirectory, entry.name);
    const manifest = readValidPublishedProject(projectDirectory);
    if (!manifest || manifest.projectId !== entry.name) return [];
    return [manifest];
  });

const reconcilePublishedProjects = (database: Database.Database, projectsDirectory: string): void => {
  const insertProject = database.prepare('INSERT OR IGNORE INTO projects (project_id, directory_name, display_name) VALUES (?, ?, ?)');
  const insertOperation = database.prepare("INSERT OR IGNORE INTO project_operations (operation_id, project_id, directory_name, state) VALUES (?, ?, ?, 'published')");
  const getOperation = database.prepare('SELECT project_id as projectId, directory_name as directoryName FROM project_operations WHERE operation_id = ?');
  const reconcile = database.transaction((manifest: ProjectManifest): void => {
    insertProject.run(manifest.projectId, manifest.projectId, manifest.name);
    insertOperation.run(manifest.operationId, manifest.projectId, manifest.projectId);
    const operation = getOperation.get(manifest.operationId) as Pick<ProjectOperation, 'projectId' | 'directoryName'> | undefined;
    if (!operation || operation.projectId !== manifest.projectId || operation.directoryName !== manifest.projectId) throw new Error('INDEX_MANIFEST_CONFLICT');
  });
  scanPublishedProjects(projectsDirectory).forEach((manifest) => reconcile(manifest));
};

const rebuildCorruptIndex = (indexPath: string, projectsDirectory: string): Database.Database => {
  const temporaryPath = `${indexPath}.rebuild-${randomUUID()}`;
  const corruptPath = `${indexPath}.corrupt-${randomUUID()}`;
  let temporaryDatabase: Database.Database | null = null;
  let movedCorruptIndex = false;
  let publishedReplacement = false;
  try {
    temporaryDatabase = new Database(temporaryPath);
    configureIndex(temporaryDatabase);
    reconcilePublishedProjects(temporaryDatabase, projectsDirectory);
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

const openIndex = (indexDirectory: string, projectsDirectory: string): Database.Database => {
  const indexPath = join(indexDirectory, workspaceProjectIndexName);
  let database: Database.Database | null = null;
  try {
    database = new Database(indexPath, { timeout: 0 });
    configureIndex(database);
    reconcilePublishedProjects(database, projectsDirectory);
    return database;
  } catch (error) {
    database?.close();
    if (!isIndexCorruption(error)) throw error;
    return rebuildCorruptIndex(indexPath, projectsDirectory);
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

const getPublishedProject = (projectsDirectory: string, operation: ProjectOperation, operationId: string): ProjectManifest | null => {
  const projectDirectory = join(projectsDirectory, operation.directoryName);
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
  const index = openIndex(paths.indexDirectory, paths.projectsDirectory);

  try {
    const operation = reserveOperation(index, input.operationId);
    const publishedProject = getPublishedProject(paths.projectsDirectory, operation, input.operationId);
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
      const publishedManifest = getPublishedProject(paths.projectsDirectory, operation, input.operationId);
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

export const createProjectStore = (handle: WorkspaceHandle, options: ProjectStoreOptions = {}): ProjectStore => ({
  createProjectContainer: async (input): Promise<CreateProjectContainerResult> => createProject(handle, options, input),
});
