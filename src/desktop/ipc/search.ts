import type { SearchIndexItem, SearchQuery, SearchRecord } from '../../features/library/indexer';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { isTrustedProjectLibraryRequest } from './workspace';

export const searchRebuildChannel = 'library:search-rebuild';
export const searchQueryChannel = 'library:search-query';

type SearchSender = { mainFrame: { url: string }; getURL: () => string };
type SearchRequest = { sender: SearchSender; senderFrame: { url: string } | null };
type SearchWindow = { webContents: SearchSender };

const isWorkspaceId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isSearchRecord = (value: unknown): value is SearchRecord => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return isWorkspaceId(record.libraryId)
    && isWorkspaceId(record.projectId)
    && Array.isArray(record.contributorIds)
    && record.contributorIds.every((entry) => typeof entry === 'string')
    && (record.title === undefined || typeof record.title === 'string')
    && (record.brief === undefined || typeof record.brief === 'string')
    && (record.size === undefined || typeof record.size === 'string')
    && (record.tags === undefined || (Array.isArray(record.tags) && record.tags.every((entry) => typeof entry === 'string')))
    && (record.finalized === undefined || typeof record.finalized === 'boolean')
    && (record.updatedAt === undefined || typeof record.updatedAt === 'string');
};
const isRecords = (value: unknown): value is readonly SearchRecord[] => Array.isArray(value) && value.every(isSearchRecord);

export const rebuildSearchHandler = (
  window: SearchWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  rebuild: (workspace: ProjectLibraryHandle, records: readonly SearchRecord[]) => Promise<void>,
) => async (event: SearchRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return false;
  const value = input as Record<string, unknown>;
  if (!isWorkspaceId(value.libraryId) || !isRecords(value.records)) return false;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== value.libraryId) return false;
  await rebuild(workspace, value.records);
  return true;
};

export const searchQueryHandler = (
  window: SearchWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  search: (workspace: ProjectLibraryHandle, options: SearchQuery) => Promise<SearchIndexItem[]>,
) => async (event: SearchRequest, input: unknown): Promise<SearchIndexItem[] | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  if (!isWorkspaceId(value.libraryId)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== value.libraryId) return null;
  const options: SearchQuery = {
    libraryId: value.libraryId,
    ...(typeof value.query === 'string' ? { query: value.query } : {}),
    ...(typeof value.designerId === 'string' ? { designerId: value.designerId } : {}),
    ...(typeof value.finalized === 'boolean' ? { finalized: value.finalized } : {}),
    ...(typeof value.tag === 'string' ? { tag: value.tag } : {}),
  };
  return search(workspace, options);
};
