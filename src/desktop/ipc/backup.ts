import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import type { BackupArtifact, RestoreBackupResult } from '../../features/workspace/backup';
import { isTrustedProjectLibraryRequest } from './workspace';

export const backupCreateChannel = 'workspace:backup-create';
export const backupRestoreChannel = 'workspace:backup-restore';

type BackupSender = { mainFrame: { url: string }; getURL: () => string };
type BackupRequest = { sender: BackupSender; senderFrame: { url: string } | null };
type BackupWindow = { webContents: BackupSender };

const isWorkspaceId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isDirectory = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

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
