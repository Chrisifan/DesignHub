export type BackupSchedule = 'manual' | 'daily' | 'weekly';

export type WorkspaceBackupSettings = {
  destinationParentDirectory: string | null;
  schedule: BackupSchedule;
  lastRunAt: string | null;
  lastArtifactPath: string | null;
};

export type WorkspaceSettings = {
  formatVersion: 1;
  backup: WorkspaceBackupSettings;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isOptionalPath = (value: unknown): value is string | null => value === null
  || (typeof value === 'string' && value.length <= 4096 && !/[\u0000-\u001F]/u.test(value));

const isTimestamp = (value: unknown): value is string | null => value === null
  || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));

export const isWorkspaceSettings = (value: unknown): value is WorkspaceSettings => {
  if (!isRecord(value) || value.formatVersion !== 1 || !isRecord(value.backup)) return false;
  const backup = value.backup;
  return (backup.schedule === 'manual' || backup.schedule === 'daily' || backup.schedule === 'weekly')
    && isOptionalPath(backup.destinationParentDirectory)
    && isTimestamp(backup.lastRunAt)
    && isOptionalPath(backup.lastArtifactPath);
};
