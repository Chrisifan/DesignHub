import type { BrowserWindow } from 'electron';

import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import type { BackupArtifact, RestoreBackupResult } from '../../features/workspace/backup';
import { isTrustedProjectLibraryRequest } from './workspace';

export const backupChooseDirectoryChannel = 'workspace:backup-choose-directory';
export const backupCreateChannel = 'workspace:backup-create';
export const backupRestoreChannel = 'workspace:backup-restore';

type BackupSender = { mainFrame: { url: string }; getURL: () => string };
type BackupRequest = { sender: BackupSender; senderFrame: { url: string } | null };
type BackupWindow = { webContents: BackupSender };
type DirectoryDialog = (window: BrowserWindow, properties: string[]) => Promise<{ canceled: boolean; filePaths: string[] }>;

const isWorkspaceId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isDirectory = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const chooseBackupDirectoryHandler = (
  window: BackupWindow,
  trustedUrl: string,
  showDirectoryDialog: DirectoryDialog,
) => async (event: BackupRequest, kind: unknown): Promise<string | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || (kind !== 'source' && kind !== 'destination')) return null;
  const properties = kind === 'source'
    ? ['openDirectory', 'treatPackageAsDirectory']
    : ['openDirectory', 'createDirectory'];
  const result = await showDirectoryDialog(window as never, properties);
  return result.canceled ? null : result.filePaths[0] ?? null;
};

export const createBackupHandler = (
  window: BackupWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  createBackup: (workspace: ProjectLibraryHandle, destinationParentDirectory: string) => Promise<BackupArtifact>,
) => async (event: BackupRequest, input: unknown): Promise<BackupArtifact | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  if (!isWorkspaceId(value.libraryId) || !isDirectory(value.destinationParentDirectory)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== value.libraryId) return null;
  return createBackup(workspace, value.destinationParentDirectory);
};

export const restoreBackupHandler = (
  window: BackupWindow,
  trustedUrl: string,
  restoreBackup: (input: { backupDirectory: string; destinationParentDirectory: string }) => Promise<RestoreBackupResult>,
) => async (event: BackupRequest, input: unknown): Promise<RestoreBackupResult | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  if (!isDirectory(value.backupDirectory) || !isDirectory(value.destinationParentDirectory)) return null;
  return restoreBackup({ backupDirectory: value.backupDirectory, destinationParentDirectory: value.destinationParentDirectory });
};
