import { existsSync, lstatSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import { buildSearchIndex, type SearchIndexItem, type SearchQuery, type SearchRecord } from '../../features/library/indexer';
import { matchesDesigner, matchesSearch } from '../../features/library/filter';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { getWritableProjectLibraryLease } from './project-library-store';

export const searchIndexDatabaseName = 'search-index.sqlite';
const internalDirectoryName = '.designhub';

export type SearchIndexStore = {
  replace: (records: readonly SearchRecord[]) => Promise<void>;
  search: (options: SearchQuery) => Promise<SearchIndexItem[]>;
  close: () => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const getInternalDirectory = (handle: ProjectLibraryHandle): string => {
  const directory = getWritableProjectLibraryLease(handle)?.directory ?? handle.library.directory;
  const internal = join(directory, internalDirectoryName);
  let status: ReturnType<typeof lstatSync>;
  try {
    status = lstatSync(internal);
  } catch {
    throw new Error('INVALID_WORKSPACE_PATH');
  }
  if (!status.isDirectory() || status.isSymbolicLink() || realpathSync(internal) !== internal) throw new Error('INVALID_WORKSPACE_PATH');
  return internal;
};

const configure = (database: Database.Database): void => {
  database.pragma('journal_mode = DELETE');
  database.exec(`
    CREATE TABLE IF NOT EXISTS search_documents (
      workspace_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (workspace_id, project_id, document_id)
    );
    CREATE INDEX IF NOT EXISTS search_documents_workspace ON search_documents (workspace_id);
  `);
};

const removeIndexArtifacts = (databasePath: string): void => {
  [databasePath, `${databasePath}-wal`, `${databasePath}-shm`, `${databasePath}-journal`].forEach((path) => {
    try {
      const status = lstatSync(path);
      if (status.isDirectory() && !status.isSymbolicLink()) throw new Error('INVALID_SEARCH_INDEX');
      rmSync(path, { force: true });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_SEARCH_INDEX') throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return;
      throw error;
    }
  });
};

const isHealthy = (database: Database.Database): boolean => {
  try {
    return database.pragma('integrity_check', { simple: true }) === 'ok';
  } catch {
    return false;
  }
};

const openDatabase = (databasePath: string, writable: boolean): Database.Database | null => {
  try {
    const status = lstatSync(databasePath);
    if (status.isSymbolicLink() || status.isDirectory()) {
      if (!writable) return null;
      removeIndexArtifacts(databasePath);
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code !== 'ENOENT') throw error;
  }
  if (!writable && !existsSync(databasePath)) return null;
  try {
    const database = new Database(databasePath, writable ? {} : { readonly: true, fileMustExist: true });
    if (writable) {
      try {
        configure(database);
        if (!isHealthy(database)) throw new Error('INVALID_SEARCH_INDEX');
        return database;
      } catch {
        database.close();
        removeIndexArtifacts(databasePath);
      }
      const recovered = new Database(databasePath);
      configure(recovered);
      return recovered;
    }
    if (!isHealthy(database)) {
      database.close();
      return null;
    }
    return database;
  } catch {
    if (!writable) return null;
    removeIndexArtifacts(databasePath);
    const recovered = new Database(databasePath);
    configure(recovered);
    return recovered;
  }
};

const parsePayload = (value: unknown): SearchIndexItem | null => {
  if (!isRecord(value) || typeof value.projectId !== 'string' || typeof value.documentId !== 'string') return null;
  const libraryId = typeof value.libraryId === 'string' ? value.libraryId : typeof value.workspaceId === 'string' ? value.workspaceId : null;
  if (!libraryId) return null;
  if (typeof value.title !== 'undefined' && typeof value.title !== 'string') return null;
  if (typeof value.brief !== 'undefined' && typeof value.brief !== 'string') return null;
  if (!Array.isArray(value.contributorIds) || !value.contributorIds.every((entry) => typeof entry === 'string')) return null;
  return { ...value, libraryId } as unknown as SearchIndexItem;
};

export const createSearchIndexStore = (handle: ProjectLibraryHandle): SearchIndexStore => {
  const directory = getInternalDirectory(handle);
  const databasePath = join(directory, searchIndexDatabaseName);
  const writable = handle.library.openMode === 'writable' && Boolean(getWritableProjectLibraryLease(handle));
  if (!writable && !existsSync(databasePath)) {
    return {
      replace: async () => { throw new Error('WORKSPACE_NOT_WRITABLE'); },
      search: async () => [],
      close: () => undefined,
    };
  }
  if (writable) mkdirSync(directory, { recursive: true });
  const database = openDatabase(databasePath, writable);
  if (!database) {
    return {
      replace: async () => { throw new Error('WORKSPACE_NOT_WRITABLE'); },
      search: async () => [],
      close: () => undefined,
    };
  }
  const replace = async (records: readonly SearchRecord[]): Promise<void> => {
    if (handle.library.openMode !== 'writable' || !getWritableProjectLibraryLease(handle)) throw new Error('WORKSPACE_NOT_WRITABLE');
    const items = buildSearchIndex(records);
    const transaction = database.transaction((next: readonly SearchIndexItem[]): void => {
      database.prepare('DELETE FROM search_documents').run();
      const insert = database.prepare('INSERT INTO search_documents (workspace_id, project_id, document_id, payload) VALUES (?, ?, ?, ?)');
      next.forEach((item) => insert.run(item.libraryId, item.projectId, item.documentId, JSON.stringify({ ...item, workspaceId: item.libraryId })));
    });
    transaction(items);
  };
  const search = async (options: SearchQuery): Promise<SearchIndexItem[]> => {
    if (!options.libraryId.trim()) return [];
    const rows = database.prepare('SELECT payload FROM search_documents WHERE workspace_id = ?').all(options.libraryId) as Array<{ payload: string }>;
    return rows.flatMap((row) => {
      try {
        const parsed = parsePayload(JSON.parse(row.payload) as unknown);
        if (!parsed || !matchesSearch(parsed, options.query ?? '') || (options.designerId && !matchesDesigner({ contributorIds: parsed.contributorIds }, options.designerId)) || (options.finalized !== undefined && parsed.finalized !== options.finalized) || (options.tag && !(parsed.tags ?? []).some((tag) => tag.toLocaleLowerCase() === options.tag?.trim().toLocaleLowerCase()))) return [];
        return [parsed];
      } catch {
        return [];
      }
    });
  };
  const close = (): void => { database.close(); };
  return { replace, search, close };
};
