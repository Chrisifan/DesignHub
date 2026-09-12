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
