import { existsSync, mkdirSync, lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import { buildSearchIndex, type SearchIndexItem, type SearchQuery, type SearchRecord } from '../../features/library/indexer';
import { matchesDesigner, matchesSearch } from '../../features/library/filter';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { getWritableWorkspaceLease } from './workspace-store';

export const searchIndexDatabaseName = 'search-index.sqlite';
const internalDirectoryName = '.designhub';

export type SearchIndexStore = {
  replace: (records: readonly SearchRecord[]) => Promise<void>;
  search: (options: SearchQuery) => Promise<SearchIndexItem[]>;
  close: () => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const getInternalDirectory = (handle: WorkspaceHandle): string => {
  const directory = getWritableWorkspaceLease(handle)?.directory ?? handle.workspace.directory;
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

const parsePayload = (value: unknown): SearchIndexItem | null => {
  if (!isRecord(value) || typeof value.workspaceId !== 'string' || typeof value.projectId !== 'string' || typeof value.documentId !== 'string') return null;
  if (typeof value.title !== 'undefined' && typeof value.title !== 'string') return null;
  if (typeof value.brief !== 'undefined' && typeof value.brief !== 'string') return null;
  if (!Array.isArray(value.contributorIds) || !value.contributorIds.every((entry) => typeof entry === 'string')) return null;
  return value as unknown as SearchIndexItem;
};

export const createSearchIndexStore = (handle: WorkspaceHandle): SearchIndexStore => {
  const directory = getInternalDirectory(handle);
  const databasePath = join(directory, searchIndexDatabaseName);
  const writable = handle.workspace.openMode === 'writable' && Boolean(getWritableWorkspaceLease(handle));
  if (!writable && !existsSync(databasePath)) {
    return {
      replace: async () => { throw new Error('WORKSPACE_NOT_WRITABLE'); },
      search: async () => [],
      close: () => undefined,
    };
  }
  if (writable) mkdirSync(directory, { recursive: true });
  const database = new Database(databasePath, writable ? {} : { readonly: true, fileMustExist: true });
  if (writable) configure(database);
  const replace = async (records: readonly SearchRecord[]): Promise<void> => {
    if (handle.workspace.openMode !== 'writable' || !getWritableWorkspaceLease(handle)) throw new Error('WORKSPACE_NOT_WRITABLE');
    const items = buildSearchIndex(records);
    const transaction = database.transaction((next: readonly SearchIndexItem[]): void => {
      database.prepare('DELETE FROM search_documents').run();
      const insert = database.prepare('INSERT INTO search_documents (workspace_id, project_id, document_id, payload) VALUES (?, ?, ?, ?)');
      next.forEach((item) => insert.run(item.workspaceId, item.projectId, item.documentId, JSON.stringify(item)));
    });
    transaction(items);
  };
  const search = async (options: SearchQuery): Promise<SearchIndexItem[]> => {
    if (!options.workspaceId.trim()) return [];
    const rows = database.prepare('SELECT payload FROM search_documents WHERE workspace_id = ?').all(options.workspaceId) as Array<{ payload: string }>;
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
