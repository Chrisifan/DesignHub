import type { SearchIndexItem, SearchQuery, SearchRecord } from '../../features/library/indexer';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { isTrustedWorkspaceRequest } from './workspace';

export const searchRebuildChannel = 'library:search-rebuild';
export const searchQueryChannel = 'library:search-query';

type SearchSender = { mainFrame: { url: string }; getURL: () => string };
type SearchRequest = { sender: SearchSender; senderFrame: { url: string } | null };
type SearchWindow = { webContents: SearchSender };

const isWorkspaceId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isRecords = (value: unknown): value is readonly SearchRecord[] => Array.isArray(value);

export const rebuildSearchHandler = (
  window: SearchWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  rebuild: (workspace: WorkspaceHandle, records: readonly SearchRecord[]) => Promise<void>,
) => async (event: SearchRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return false;
  const value = input as Record<string, unknown>;
  if (!isWorkspaceId(value.workspaceId) || !isRecords(value.records)) return false;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== value.workspaceId) return false;
  await rebuild(workspace, value.records);
  return true;
};

export const searchQueryHandler = (
  window: SearchWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  search: (workspace: WorkspaceHandle, options: SearchQuery) => Promise<SearchIndexItem[]>,
) => async (event: SearchRequest, input: unknown): Promise<SearchIndexItem[] | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  if (!isWorkspaceId(value.workspaceId)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== value.workspaceId) return null;
  const options: SearchQuery = {
    workspaceId: value.workspaceId,
    ...(typeof value.query === 'string' ? { query: value.query } : {}),
    ...(typeof value.designerId === 'string' ? { designerId: value.designerId } : {}),
    ...(typeof value.finalized === 'boolean' ? { finalized: value.finalized } : {}),
    ...(typeof value.tag === 'string' ? { tag: value.tag } : {}),
  };
  return search(workspace, options);
};
