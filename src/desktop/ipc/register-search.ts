import type { BrowserWindow } from 'electron';
import { rebuildSearchHandler, searchQueryHandler, searchQueryChannel, searchRebuildChannel } from './search';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import type { SearchIndexItem, SearchQuery, SearchRecord } from '../../features/library/indexer';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};

export type RegisterSearchOptions = {
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  getLibrary: () => ProjectLibraryHandle | null;
  rebuild: (workspace: ProjectLibraryHandle, records: readonly SearchRecord[]) => Promise<void>;
  search: (workspace: ProjectLibraryHandle, options: SearchQuery) => Promise<SearchIndexItem[]>;
};

export const registerSearchHandlers = ({
  ipc,
  getWindow,
  getTrustedUrl,
  getLibrary,
  rebuild,
  search,
}: RegisterSearchOptions): void => {
  const getContext = () => {
    const window = getWindow();
    const trustedUrl = getTrustedUrl();
    return window && trustedUrl ? { window, trustedUrl } : null;
  };

  ipc.handle(searchRebuildChannel, (event, input) => {
    const context = getContext();
    return context
      ? rebuildSearchHandler(context.window, context.trustedUrl, getLibrary, rebuild)(event as never, input)
      : false;
  });
  ipc.handle(searchQueryChannel, (event, input) => {
    const context = getContext();
    return context
      ? searchQueryHandler(context.window, context.trustedUrl, getLibrary, search)(event as never, input)
      : null;
  });
};
