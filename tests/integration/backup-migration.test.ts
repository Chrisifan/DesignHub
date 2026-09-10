// @vitest-environment node

import { createHash, randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, expect, it } from 'vitest';

import {
  backupCompletionName,
  backupManifestName,
  createWorkspaceBackupStore,
} from '../../src/desktop/storage/backup-store';
import {
  createProjectStore,
  projectDatabaseName,
  workspaceProjectIndexName,
} from '../../src/desktop/storage/project-store';
import { createWorkspace, openWorkspace, workspaceManifestName } from '../../src/desktop/storage/workspace-store';
import type { BackupManifest } from '../../src/features/workspace/backup';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (prefix: string) => {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
};

const sha256 = (content: string | Buffer): string => createHash('sha256').update(content).digest('hex');

const readBackupManifest = async (backupDirectory: string): Promise<BackupManifest> => JSON.parse(
  await readFile(join(backupDirectory, backupManifestName), 'utf8'),
) as BackupManifest;

const replaceManifest = async (backupDirectory: string, manifest: BackupManifest): Promise<void> => {
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(join(backupDirectory, backupManifestName), manifestContent);
  await writeFile(join(backupDirectory, backupCompletionName), `${JSON.stringify({
    kind: 'designhub-backup-complete',
    manifestSha256: sha256(manifestContent),
  }, null, 2)}\n`);
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

it('backs up committed WAL data and the complete current M02 managed workspace, then restores it to a new child', async () => {
  const sourceParent = await createTemporaryDirectory('designhub-backup-source-');
  const destinationParent = await createTemporaryDirectory('designhub-backup-target-');
  const restoreParent = await createTemporaryDirectory('designhub-restore-target-');
  const existingDirectory = join(restoreParent, 'Workspace');
  await mkdir(existingDirectory);
  await writeFile(join(existingDirectory, 'keep.txt'), 'keep');

  const workspace = await createWorkspace({ parentDirectory: sourceParent, name: 'Workspace' });
  const projects = createProjectStore(workspace);
  const active = await projects.createProjectContainer({
    workspaceId: workspace.workspace.workspaceId,
    operationId: 'backup-active',
    name: 'Active project',
  });
  const trashed = await projects.createProjectContainer({
    workspaceId: workspace.workspace.workspaceId,
    operationId: 'backup-trash',
    name: 'Trashed project',
  });
  await projects.moveProjectToTrash({ workspaceId: workspace.workspace.workspaceId, projectId: trashed.projectId });
  await mkdir(join(workspace.workspace.directory, 'shared-assets', 'nested'));
  await writeFile(join(workspace.workspace.directory, 'shared-assets', 'nested', 'asset.txt'), 'managed asset');
  await writeFile(join(workspace.workspace.directory, 'shared-assets', 'nested', 'raw.sqlite'), 'ordinary asset with a database-like suffix');
  await writeFile(join(workspace.workspace.directory, 'shared-assets', 'nested', 'texture.sqlite-wal'), 'ordinary sidecar-like asset');

  const sourceDatabasePath = join(workspace.workspace.directory, 'projects', active.projectId, projectDatabaseName);
  const liveDatabase = new Database(sourceDatabasePath);
  liveDatabase.pragma('journal_mode = WAL');
  liveDatabase.pragma('wal_autocheckpoint = 0');
  liveDatabase.exec('CREATE TABLE wal_content (value TEXT NOT NULL); INSERT INTO wal_content VALUES (\'committed in wal\');');
  expect(existsSync(`${sourceDatabasePath}-wal`)).toBe(true);

  try {
    const artifact = await createWorkspaceBackupStore(workspace).createBackup({ destinationParentDirectory: destinationParent });
    const manifest = await readBackupManifest(artifact.directory);
    const paths = manifest.files.map(({ path }) => path);

    expect(existsSync(join(artifact.directory, backupCompletionName))).toBe(true);
    expect(manifest).toMatchObject({
      kind: 'designhub-backup',
      formatVersion: 1,
      workspaceId: workspace.workspace.workspaceId,
      workspaceFormatVersion: 1,
    });
    expect(paths).toEqual(expect.arrayContaining([
      workspaceManifestName,
      `.designhub/${workspaceProjectIndexName}`,
      `projects/${active.projectId}/${projectDatabaseName}`,
      `trash/${trashed.projectId}/${projectDatabaseName}`,
      'shared-assets/nested/asset.txt',
      'shared-assets/nested/raw.sqlite',
      'shared-assets/nested/texture.sqlite-wal',
    ]));
    expect(manifest.files.find(({ path }) => path === 'shared-assets/nested/raw.sqlite')?.storage).toBe('file');
    expect(paths.some((path) => path.includes('writer-lock'))).toBe(false);
    expect(paths).not.toContain(`projects/${active.projectId}/${projectDatabaseName}-wal`);
    expect(paths).not.toContain(`projects/${active.projectId}/${projectDatabaseName}-shm`);
    expect(manifest.directories).toEqual(expect.arrayContaining(['.designhub', 'projects', 'shared-assets', 'shared-assets/nested', 'trash']));
    expect(JSON.stringify(manifest)).not.toContain(workspace.workspace.directory);
    expect(Object.keys(manifest)).not.toEqual(expect.arrayContaining(['key', 'credentials', 'sourceDirectory']));
    manifest.files.forEach((entry) => {
      expect(entry.path.startsWith('/')).toBe(false);
      expect(entry.path.includes('..')).toBe(false);
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/u);
    });

    const restored = await createWorkspaceBackupStore(workspace).restoreBackup({
      backupDirectory: artifact.directory,
      destinationParentDirectory: restoreParent,
    });
    expect(restored.directory).not.toBe(existingDirectory);
    await expect(readFile(join(existingDirectory, 'keep.txt'), 'utf8')).resolves.toBe('keep');
    await expect(readFile(join(restored.directory, 'shared-assets', 'nested', 'asset.txt'), 'utf8')).resolves.toBe('managed asset');

    const restoredDatabase = new Database(join(restored.directory, 'projects', active.projectId, projectDatabaseName), { readonly: true });
    try {
      expect(restoredDatabase.prepare('SELECT value FROM wal_content').get()).toEqual({ value: 'committed in wal' });
    } finally {
      restoredDatabase.close();
    }

    const restoredWorkspace = await openWorkspace(restored.directory);
    expect(restoredWorkspace.workspace).toMatchObject({ workspaceId: workspace.workspace.workspaceId, openMode: 'writable' });
    restoredWorkspace.close();
  } finally {
    liveDatabase.close();
    workspace.close();
  }
});

it.each(['file-copy', 'database-backup', 'backup-publish'] as const)('does not publish a completed backup or modify the source after an injected %s failure', async (failAt) => {
  const sourceParent = await createTemporaryDirectory(`designhub-backup-failure-source-${failAt}-`);
  const destinationParent = await createTemporaryDirectory(`designhub-backup-failure-target-${failAt}-`);
  const workspace = await createWorkspace({ parentDirectory: sourceParent, name: `Failure ${failAt}` });
  const project = await createProjectStore(workspace).createProjectContainer({
    workspaceId: workspace.workspace.workspaceId,
    operationId: `failure-${failAt}`,
    name: `Failure ${failAt}`,
  });
  const sourceDatabasePath = join(workspace.workspace.directory, 'projects', project.projectId, projectDatabaseName);

  try {
    await expect(createWorkspaceBackupStore(workspace, { failAt }).createBackup({ destinationParentDirectory: destinationParent })).rejects.toThrow('INJECTED');
    expect(await readdir(destinationParent)).toEqual([]);
    await expect(readFile(join(workspace.workspace.directory, workspaceManifestName), 'utf8')).resolves.toContain(workspace.workspace.workspaceId);
    const sourceDatabase = new Database(sourceDatabasePath, { readonly: true });
    try {
      expect(sourceDatabase.pragma('integrity_check', { simple: true })).toBe('ok');
    } finally {
      sourceDatabase.close();
    }
  } finally {
    workspace.close();
  }
});

it('rejects incomplete, tampered, and internally corrupt backup artifacts without publishing a restored workspace', async () => {
  const sourceParent = await createTemporaryDirectory('designhub-invalid-backup-source-');
  const backupParent = await createTemporaryDirectory('designhub-invalid-backup-artifacts-');
  const restoreParent = await createTemporaryDirectory('designhub-invalid-restore-target-');
  const workspace = await createWorkspace({ parentDirectory: sourceParent, name: 'Integrity' });
  const project = await createProjectStore(workspace).createProjectContainer({
    workspaceId: workspace.workspace.workspaceId,
    operationId: 'integrity-project',
    name: 'Integrity project',
  });

  try {
    const store = createWorkspaceBackupStore(workspace);
    const artifact = await store.createBackup({ destinationParentDirectory: backupParent });
    const baselineEntries = await readdir(restoreParent);

    const extraEnvelopeDirectory = join(backupParent, `extra-envelope-${randomUUID()}`);
    await cp(artifact.directory, extraEnvelopeDirectory, { recursive: true });
    await writeFile(join(extraEnvelopeDirectory, 'credentials.txt'), 'not part of a backup artifact');
    await expect(store.restoreBackup({ backupDirectory: extraEnvelopeDirectory, destinationParentDirectory: restoreParent })).rejects.toThrow('INVALID_BACKUP');
    expect(await readdir(restoreParent)).toEqual(baselineEntries);

    const incompleteDirectory = join(backupParent, `incomplete-${randomUUID()}`);
    await cp(artifact.directory, incompleteDirectory, { recursive: true });
    await unlink(join(incompleteDirectory, backupCompletionName));
    await expect(store.restoreBackup({ backupDirectory: incompleteDirectory, destinationParentDirectory: restoreParent })).rejects.toThrow('INCOMPLETE_BACKUP');
    expect(await readdir(restoreParent)).toEqual(baselineEntries);

    const tamperedDirectory = join(backupParent, `tampered-${randomUUID()}`);
    await cp(artifact.directory, tamperedDirectory, { recursive: true });
    await writeFile(join(tamperedDirectory, 'workspace', 'shared-assets', 'tampered.txt'), 'not in manifest');
    await expect(store.restoreBackup({ backupDirectory: tamperedDirectory, destinationParentDirectory: restoreParent })).rejects.toThrow('INVALID_BACKUP_CONTENT');
    expect(await readdir(restoreParent)).toEqual(baselineEntries);

    const corruptDatabaseDirectory = join(backupParent, `corrupt-${randomUUID()}`);
    await cp(artifact.directory, corruptDatabaseDirectory, { recursive: true });
    const corruptDatabaseRelativePath = `projects/${project.projectId}/${projectDatabaseName}`;
    const corruptDatabasePath = join(corruptDatabaseDirectory, 'workspace', ...corruptDatabaseRelativePath.split('/'));
    const corruptContent = 'not a sqlite database';
    await writeFile(corruptDatabasePath, corruptContent);
    const corruptManifest = await readBackupManifest(corruptDatabaseDirectory);
    corruptManifest.files = corruptManifest.files.map((entry) => entry.path === corruptDatabaseRelativePath
      ? { ...entry, size: Buffer.byteLength(corruptContent), sha256: sha256(corruptContent) }
      : entry);
    await replaceManifest(corruptDatabaseDirectory, corruptManifest);

    await expect(store.restoreBackup({ backupDirectory: corruptDatabaseDirectory, destinationParentDirectory: restoreParent })).rejects.toThrow('INVALID_BACKUP_DATABASE');
    expect(await readdir(restoreParent)).toEqual(baselineEntries);
  } finally {
    workspace.close();
  }
});

it('requires a verified matching backup and rolls back a failed metadata-format publication', async () => {
  const sourceParent = await createTemporaryDirectory('designhub-migration-source-');
  const backupParent = await createTemporaryDirectory('designhub-migration-backup-');
  const created = await createWorkspace({ parentDirectory: sourceParent, name: 'Migration' });
  created.close();
  const migrating = await openWorkspace(created.workspace.directory, 2);
  expect(migrating.workspace.openMode).toBe('migration-required');

  try {
    const artifact = await createWorkspaceBackupStore(migrating).createBackup({ destinationParentDirectory: backupParent });
    const manifestPath = join(migrating.workspace.directory, workspaceManifestName);
    const originalManifest = await readFile(manifestPath, 'utf8');

    await expect(createWorkspaceBackupStore(migrating).migrateMetadata({
      backupDirectory: artifact.directory,
      toFormatVersion: 1.5,
    })).rejects.toThrow('MIGRATION_NOT_ALLOWED');
    await expect(readFile(manifestPath, 'utf8')).resolves.toBe(originalManifest);

    await expect(createWorkspaceBackupStore(migrating, { failAt: 'migration-publish' }).migrateMetadata({
      backupDirectory: artifact.directory,
      toFormatVersion: 2,
    })).rejects.toThrow('INJECTED_MIGRATION_PUBLISH_FAILURE');
    await expect(readFile(manifestPath, 'utf8')).resolves.toBe(originalManifest);

    const tamperedBackup = join(backupParent, `migration-tampered-${randomUUID()}`);
    await cp(artifact.directory, tamperedBackup, { recursive: true });
    await writeFile(join(tamperedBackup, backupManifestName), '{}\n');
    await expect(createWorkspaceBackupStore(migrating).migrateMetadata({
      backupDirectory: tamperedBackup,
      toFormatVersion: 2,
    })).rejects.toThrow('INVALID_BACKUP');
    await expect(readFile(manifestPath, 'utf8')).resolves.toBe(originalManifest);

    await expect(createWorkspaceBackupStore(migrating).migrateMetadata({
      backupDirectory: artifact.directory,
      toFormatVersion: 2,
    })).resolves.toEqual({ fromFormatVersion: 1, toFormatVersion: 2 });
    const migratedManifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    expect(migratedManifest.formatVersion).toBe(2);
    expect((await readBackupManifest(artifact.directory)).workspaceFormatVersion).toBe(1);
  } finally {
    migrating.close();
  }

  const reopened = await openWorkspace(created.workspace.directory, 2);
  expect(reopened.workspace.openMode).toBe('writable');
  reopened.close();
});
