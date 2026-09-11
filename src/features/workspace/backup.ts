export type BackupFileEntry = {
  path: string;
  size: number;
  sha256: string;
  storage: 'file' | 'sqlite';
};

export type BackupManifest = {
  kind: 'designhub-backup';
  formatVersion: 1;
  workspaceId: string;
  workspaceName: string;
  workspaceFormatVersion: number;
  createdAt: string;
  directories: string[];
  files: BackupFileEntry[];
};

export type BackupArtifact = {
  directory: string;
  workspaceId: string;
  createdAt: string;
};

export type RestoreBackupResult = {
  directory: string;
  workspaceId: string;
};

export type MigrationResult = {
  fromFormatVersion: number;
  toFormatVersion: number;
};

export type WorkspaceBackupStore = {
  createBackup: (input: { destinationParentDirectory: string }) => Promise<BackupArtifact>;
  restoreBackup: (input: { backupDirectory: string; destinationParentDirectory: string }) => Promise<RestoreBackupResult>;
  migrateMetadata: (input: { backupDirectory: string; toFormatVersion: number }) => Promise<MigrationResult>;
};

export const createWorkspaceBackupStore = (implementation: WorkspaceBackupStore): WorkspaceBackupStore => ({
  createBackup: (input) => implementation.createBackup(input),
  restoreBackup: (input) => implementation.restoreBackup(input),
  migrateMetadata: (input) => implementation.migrateMetadata(input),
});
