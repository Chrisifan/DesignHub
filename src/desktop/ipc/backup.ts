import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import type { BackupArtifact, RestoreBackupResult } from '../../features/workspace/backup';
import { isTrustedWorkspaceRequest } from './workspace';

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
  getWorkspace: () => WorkspaceHandle | null,
  createBackup: (workspace: WorkspaceHandle, destinationParentDirectory: string) => Promise<BackupArtifact>,
) => async (event: BackupRequest, input: unknown): Promise<BackupArtifact | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  if (!isWorkspaceId(value.workspaceId) || !isDirectory(value.destinationParentDirectory)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== value.workspaceId) return null;
  return createBackup(workspace, value.destinationParentDirectory);
};

export const restoreBackupHandler = (
  window: BackupWindow,
  trustedUrl: string,
  restoreBackup: (input: { backupDirectory: string; destinationParentDirectory: string }) => Promise<RestoreBackupResult>,
) => async (event: BackupRequest, input: unknown): Promise<RestoreBackupResult | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  if (!isDirectory(value.backupDirectory) || !isDirectory(value.destinationParentDirectory)) return null;
  return restoreBackup({ backupDirectory: value.backupDirectory, destinationParentDirectory: value.destinationParentDirectory });
};
