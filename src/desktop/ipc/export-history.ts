import type { ExportHistoryRecord } from '../../features/delivery/export-history';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { isTrustedWorkspaceRequest } from './workspace';

export const exportHistoryListChannel = 'export-history:list';

type HistorySender = { mainFrame: { url: string }; getURL: () => string };
type HistoryRequest = { sender: HistorySender; senderFrame: { url: string } | null };
type HistoryWindow = { webContents: HistorySender };

const isId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const listExportHistoryHandler = (
  window: HistoryWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  load: (workspace: WorkspaceHandle, workspaceId: string, projectId: string) => Promise<ExportHistoryRecord[]>,
) => async (event: HistoryRequest, input: unknown): Promise<ExportHistoryRecord[] | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  if (!isId(value.workspaceId) || !isId(value.projectId)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== value.workspaceId) return null;
  return load(workspace, value.workspaceId, value.projectId);
};
