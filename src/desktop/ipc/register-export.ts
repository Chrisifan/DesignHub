import type { BrowserWindow } from 'electron';
import { exportDocumentChannel, exportDocumentHandler, type ExportBridgeInput, type ExportBridgeResult } from './export';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};

export type RegisterExportOptions = {
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  getLibrary: () => ProjectLibraryHandle | null;
  exportDocument: (workspace: ProjectLibraryHandle, input: ExportBridgeInput) => Promise<ExportBridgeResult | null>;
};

export const registerExportHandlers = ({
  ipc,
  getWindow,
  getTrustedUrl,
  getLibrary,
  exportDocument,
}: RegisterExportOptions): void => {
  ipc.handle(exportDocumentChannel, (event, input) => {
    const window = getWindow();
    const trustedUrl = getTrustedUrl();
    if (!window || !trustedUrl) return null;
    return exportDocumentHandler(window, trustedUrl, getLibrary, exportDocument)(event as never, input);
  });
};
