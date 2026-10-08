import type { BrowserWindow } from 'electron';
import { backupChooseDirectoryChannel, backupCreateChannel, backupRestoreChannel, chooseBackupDirectoryHandler, createBackupHandler, restoreBackupHandler } from './backup';
import { diagnosticsExportChannel, exportDiagnosticsHandler } from './diagnostics';
import { exportHistoryListChannel, listExportHistoryHandler } from './export-history';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import type { BackupArtifact, RestoreBackupResult } from '../../features/workspace/backup';
import type { ExportHistoryRecord } from '../../features/delivery/export-history';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};

export type RegisterSupportHandlersOptions = {
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  getLibrary: () => ProjectLibraryHandle | null;
  showDirectoryDialog: (window: BrowserWindow, properties: string[]) => Promise<{ canceled: boolean; filePaths: string[] }>;
  createBackup: (workspace: ProjectLibraryHandle, destinationParentDirectory: string) => Promise<BackupArtifact>;
  restoreBackup: (input: { backupDirectory: string; destinationParentDirectory: string }) => Promise<RestoreBackupResult>;
  loadExportHistory: (workspace: ProjectLibraryHandle, libraryId: string, projectId: string) => Promise<ExportHistoryRecord[]>;
  writeDiagnostics: (input: { runtime: string; errorCode?: string | null }) => Promise<string | null>;
};

export const registerSupportHandlers = ({
  ipc,
  getWindow,
  getTrustedUrl,
  getLibrary,
  showDirectoryDialog,
  createBackup,
  restoreBackup,
  loadExportHistory,
  writeDiagnostics,
}: RegisterSupportHandlersOptions): void => {
  const getContext = () => {
    const window = getWindow();
    const trustedUrl = getTrustedUrl();
    return window && trustedUrl ? { window, trustedUrl } : null;
  };

  ipc.handle(backupChooseDirectoryChannel, (event, kind) => {
    const context = getContext();
    return context
      ? chooseBackupDirectoryHandler(context.window, context.trustedUrl, showDirectoryDialog)(event as never, kind)
      : null;
  });
  ipc.handle(backupCreateChannel, (event, input) => {
    const context = getContext();
    return context
      ? createBackupHandler(context.window, context.trustedUrl, getLibrary, createBackup)(event as never, input)
      : null;
  });
  ipc.handle(backupRestoreChannel, (event, input) => {
    const context = getContext();
    return context
      ? restoreBackupHandler(context.window, context.trustedUrl, restoreBackup)(event as never, input)
      : null;
  });
  ipc.handle(exportHistoryListChannel, (event, input) => {
    const context = getContext();
    return context
      ? listExportHistoryHandler(context.window, context.trustedUrl, getLibrary, loadExportHistory)(event as never, input)
      : null;
  });
  ipc.handle(diagnosticsExportChannel, (event, input) => {
    const context = getContext();
    return context
      ? exportDiagnosticsHandler(context.window, context.trustedUrl, writeDiagnostics)(event as never, input)
      : null;
  });
};
