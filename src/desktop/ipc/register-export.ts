import type { BrowserWindow } from 'electron';
import { exportProjectDesignChannel, exportProjectDesignHandler, type ExportBridgeInput, type ExportBridgeResult } from './export';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};

export type RegisterExportOptions = {
  [key: string]: unknown;
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  getLibrary: () => ProjectLibraryHandle | null;
  exportProjectDesign?: (workspace: ProjectLibraryHandle, input: ExportBridgeInput) => Promise<ExportBridgeResult | null>;
};

export const registerExportHandlers = ({
  ipc,
  getWindow,
  getTrustedUrl,
  getLibrary,
  exportProjectDesign,
}: RegisterExportOptions): void => {
  ipc.handle(exportProjectDesignChannel, (event, input) => {
    const window = getWindow();
    const trustedUrl = getTrustedUrl();
    if (!window || !trustedUrl) return null;
    return exportProjectDesignHandler(window, trustedUrl, getLibrary, exportProjectDesign ?? (async () => null))(event as never, input);
  });
};
