import type { ExportHistoryRecord } from '../../features/delivery/export-history';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { isTrustedProjectLibraryRequest } from './workspace';

export const exportHistoryListChannel = 'export-history:list';

type HistorySender = { mainFrame: { url: string }; getURL: () => string };
type HistoryRequest = { sender: HistorySender; senderFrame: { url: string } | null };
type HistoryWindow = { webContents: HistorySender };

const isId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const listExportHistoryHandler = (
  window: HistoryWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  load: (workspace: ProjectLibraryHandle, libraryId: string, projectId: string) => Promise<ExportHistoryRecord[]>,
) => async (event: HistoryRequest, input: unknown): Promise<ExportHistoryRecord[] | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  if (!isId(value.libraryId) || !isId(value.projectId)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== value.libraryId) return null;
  return load(workspace, value.libraryId, value.projectId);
};
