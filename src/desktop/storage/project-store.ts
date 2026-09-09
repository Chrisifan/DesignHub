import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import Database from 'better-sqlite3';

import type { WorkspaceDescriptor } from '../../features/workspace/open-workspace';
import type { CreateProjectContainerInput, CreateProjectContainerResult } from '../../features/workspace/project-store';

export const projectManifestName = 'designhub.project.json';
export const projectContentManifestName = 'content-manifest.json';
export const projectDatabaseName = 'project.sqlite';
export const workspaceProjectIndexName = 'project-index.sqlite';

const workspaceManifestName = 'designhub.workspace.json';
const workspaceKind = 'designhub-workspace';
const projectKind = 'designhub-project';
const projectFormatVersion = 1;
const internalDirectoryName = '.designhub';

type WorkspaceManifest = {
  kind: typeof workspaceKind;
  workspaceId: string;
};

type ProjectManifest = {
  kind: typeof projectKind;
  projectId: string;
  operationId: string;
  name: string;
  formatVersion: number;
  createdAt: string;
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

const readJson = (path: string, errorMessage: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    throw new Error(errorMessage);
  }
};

const isWorkspaceManifest = (value: unknown): value is WorkspaceManifest => isRecord(value)
  && value.kind === workspaceKind
  && typeof value.workspaceId === 'string';

const isProjectManifest = (value: unknown): value is ProjectManifest => isRecord(value)
  && value.kind === projectKind
  && typeof value.projectId === 'string'
  && typeof value.operationId === 'string'
  && typeof value.name === 'string'
  && Number.isInteger(value.formatVersion)
  && value.formatVersion === projectFormatVersion
  && typeof value.createdAt === 'string'
  && !Number.isNaN(Date.parse(value.createdAt));

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

const validateWorkspace = (workspace: WorkspaceDescriptor, workspaceId: string): { directory: string; projectsDirectory: string; indexDirectory: string } => {
  if (workspace.openMode !== 'writable') throw new Error('WORKSPACE_NOT_WRITABLE');
  if (workspace.workspaceId !== workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');

  const directory = realpathSync(workspace.directory);
  const manifest = readJson(join(directory, workspaceManifestName), 'INVALID_WORKSPACE_MANIFEST');
  if (!isWorkspaceManifest(manifest)) throw new Error('INVALID_WORKSPACE_MANIFEST');
  if (manifest.workspaceId !== workspace.workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');

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

const scanPublishedProjects = (projectsDirectory: string): ProjectManifest[] => readdirSync(projectsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .flatMap((entry) => {
    const manifest = readJson(join(projectsDirectory, entry.name, projectManifestName), 'INVALID_PROJECT_MANIFEST');
    if (!isProjectManifest(manifest) || manifest.projectId !== entry.name || !existsSync(join(projectsDirectory, entry.name, projectDatabaseName)) || !existsSync(join(projectsDirectory, entry.name, projectContentManifestName))) {
      return [];
    }
    return [manifest];
  });

const rebuildIndex = (indexPath: string, projectsDirectory: string): Database.Database => {
  if (existsSync(indexPath)) renameSync(indexPath, `${indexPath}.corrupt-${randomUUID()}`);
  const database = new Database(indexPath);
  try {
    configureIndex(database);
    const insertProject = database.prepare('INSERT INTO projects (project_id, directory_name, display_name) VALUES (?, ?, ?)');
    const insertOperation = database.prepare("INSERT INTO project_operations (operation_id, project_id, directory_name, state) VALUES (?, ?, ?, 'published')");
    const recover = database.transaction((manifest: ProjectManifest): void => {
      insertProject.run(manifest.projectId, manifest.projectId, manifest.name);
      insertOperation.run(manifest.operationId, manifest.projectId, manifest.projectId);
    });
    scanPublishedProjects(projectsDirectory).forEach((manifest) => recover(manifest));
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
};

const openIndex = (indexDirectory: string, projectsDirectory: string): Database.Database => {
  const indexPath = join(indexDirectory, workspaceProjectIndexName);
  let database: Database.Database | null = null;
  try {
    database = new Database(indexPath);
    configureIndex(database);
    return database;
  } catch {
    database?.close();
    return rebuildIndex(indexPath, projectsDirectory);
  }
};

const reserveOperation = (database: Database.Database, operationId: string): ProjectOperation => {
  const getOperation = database.prepare('SELECT project_id as projectId, directory_name as directoryName, state FROM project_operations WHERE operation_id = ?');
  const insertOperation = database.prepare("INSERT INTO project_operations (operation_id, project_id, directory_name, state) VALUES (?, ?, ?, 'pending')");
  const reserve = database.transaction((): ProjectOperation => {
    const existing = getOperation.get(operationId) as ProjectOperation | undefined;
    if (existing) return existing;
    const projectId = randomUUID();
    insertOperation.run(operationId, projectId, projectId);
    return { projectId, directoryName: projectId, state: 'pending' };
  });
  return reserve();
};

const isPublishedProject = (projectsDirectory: string, operation: ProjectOperation): boolean => {
  const projectDirectory = join(projectsDirectory, operation.directoryName);
  if (!existsSync(projectDirectory)) return false;
  const manifest = readJson(join(projectDirectory, projectManifestName), 'INVALID_PROJECT_MANIFEST');
  return isProjectManifest(manifest)
    && manifest.projectId === operation.projectId
    && existsSync(join(projectDirectory, projectDatabaseName))
    && existsSync(join(projectDirectory, projectContentManifestName));
};

const markPublished = (database: Database.Database, operationId: string, operation: ProjectOperation, name: string): void => {
  const updateOperation = database.prepare("UPDATE project_operations SET state = 'published' WHERE operation_id = ?");
  const insertProject = database.prepare('INSERT OR IGNORE INTO projects (project_id, directory_name, display_name) VALUES (?, ?, ?)');
  const publish = database.transaction((): void => {
    updateOperation.run(operationId);
    insertProject.run(operation.projectId, operation.directoryName, name);
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

const createProject = (workspace: WorkspaceDescriptor, options: ProjectStoreOptions, input: CreateProjectContainerInput): CreateProjectContainerResult => {
  const name = validateProjectName(input.name);
  validateOperationId(input.operationId);
  const paths = validateWorkspace(workspace, input.workspaceId);
  const index = openIndex(paths.indexDirectory, paths.projectsDirectory);

  try {
    const operation = reserveOperation(index, input.operationId);
    if (operation.state === 'published' || isPublishedProject(paths.projectsDirectory, operation)) {
      markPublished(index, input.operationId, operation, name);
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
      markPublished(index, input.operationId, operation, name);
      return { projectId: operation.projectId };
    } catch (error) {
      if (!published && ownsTemporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
      throw error;
    }
  } finally {
    index.close();
  }
};

export const createProjectStore = (workspace: WorkspaceDescriptor, options: ProjectStoreOptions = {}): ProjectStore => ({
  createProjectContainer: async (input): Promise<CreateProjectContainerResult> => createProject(workspace, options, input),
});
