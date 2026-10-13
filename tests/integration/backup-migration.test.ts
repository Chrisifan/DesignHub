// @vitest-environment node

import { createHash, randomUUID } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { existsSync, rmSync, symlinkSync } from 'node:fs';
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
import { initializeProjectLibrary, openProjectLibrary, projectLibraryManifestName } from '../../src/desktop/storage/project-library-store';
import { saveWorkspaceSettings } from '../../src/desktop/storage/settings-store';
import { createSearchIndexStore } from '../../src/desktop/storage/search-index-store';
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

  const workspace = await initializeProjectLibrary(sourceParent);
  await saveWorkspaceSettings(workspace, workspace.library.libraryId, {
    formatVersion: 1,
    backup: {
      destinationParentDirectory: destinationParent,
      schedule: 'weekly',
      lastRunAt: null,
      lastArtifactPath: null,
    },
  });
  const searchStore = createSearchIndexStore(workspace);
  await searchStore.replace([{
    libraryId: workspace.library.libraryId,
    projectId: 'project-indexed',
    title: 'Indexed project',
    contributorIds: ['designer-a'],
  }]);
  searchStore.close();
  const projects = createProjectStore(workspace);
  const active = await projects.createProjectContainer({
    libraryId: workspace.library.libraryId,
    operationId: 'backup-active',
    name: 'Active project',
  });
  const trashed = await projects.createProjectContainer({
    libraryId: workspace.library.libraryId,
    operationId: 'backup-trash',
    name: 'Trashed project',
  });
  await projects.moveProjectToTrash({ libraryId: workspace.library.libraryId, projectId: trashed.projectId });
  await mkdir(join(workspace.library.directory, 'shared-assets', 'nested'));
  await writeFile(join(workspace.library.directory, 'shared-assets', 'nested', 'asset.txt'), 'managed asset');
  await writeFile(join(workspace.library.directory, 'shared-assets', 'nested', 'raw.sqlite'), 'ordinary asset with a database-like suffix');
  await writeFile(join(workspace.library.directory, 'shared-assets', 'nested', 'texture.sqlite-wal'), 'ordinary sidecar-like asset');

  const sourceDatabasePath = join(workspace.library.directory, 'projects', active.projectId, projectDatabaseName);
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
      workspaceId: workspace.library.libraryId,
      workspaceFormatVersion: 1,
    });
    expect(paths).toEqual(expect.arrayContaining([
      projectLibraryManifestName,
      `.designhub/${workspaceProjectIndexName}`,
      '.designhub/settings.json',
      '.designhub/search-index.sqlite',
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
    expect(JSON.stringify(manifest)).not.toContain(workspace.library.directory);
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

    const restoredWorkspace = await openProjectLibrary(restored.directory);
    expect(restoredWorkspace.library).toMatchObject({ libraryId: workspace.library.libraryId, openMode: 'writable' });
    restoredWorkspace.close();
  } finally {
    liveDatabase.close();
    workspace.close();
  }
});

it('rejects a backup destination inside the source workspace before staging', async () => {
  const sourceParent = await createTemporaryDirectory('designhub-backup-nested-source-');
  const workspace = await initializeProjectLibrary(sourceParent);
  const nestedDestination = join(workspace.library.directory, 'projects');
  await expect(createWorkspaceBackupStore(workspace).createBackup({ destinationParentDirectory: nestedDestination }))
    .rejects.toThrow('INVALID_BACKUP_DESTINATION');
  await expect(readdir(nestedDestination)).resolves.not.toContain(expect.stringContaining('.designhub-backup-'));
  workspace.close();
});

it.each(['file-copy', 'database-backup', 'backup-publish'] as const)('does not publish a completed backup or modify the source after an injected %s failure', async (failAt) => {
  const sourceParent = await createTemporaryDirectory(`designhub-backup-failure-source-${failAt}-`);
  const destinationParent = await createTemporaryDirectory(`designhub-backup-failure-target-${failAt}-`);
  const workspace = await initializeProjectLibrary(sourceParent);
  const project = await createProjectStore(workspace).createProjectContainer({
    libraryId: workspace.library.libraryId,
    operationId: `failure-${failAt}`,
    name: `Failure ${failAt}`,
  });
  const sourceDatabasePath = join(workspace.library.directory, 'projects', project.projectId, projectDatabaseName);

  try {
    await expect(createWorkspaceBackupStore(workspace, { failAt }).createBackup({ destinationParentDirectory: destinationParent })).rejects.toThrow('INJECTED');
    expect(await readdir(destinationParent)).toEqual([]);
    await expect(readFile(join(workspace.library.directory, projectLibraryManifestName), 'utf8')).resolves.toContain(workspace.library.libraryId);
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

it('rejects a managed source file replaced by an external symlink after enumeration', async () => {
  const sourceParent = await createTemporaryDirectory('designhub-backup-source-race-');
  const destinationParent = await createTemporaryDirectory('designhub-backup-source-race-target-');
  const externalDirectory = await createTemporaryDirectory('designhub-backup-source-race-external-');
  const externalFile = join(externalDirectory, 'external.txt');
  const workspace = await initializeProjectLibrary(sourceParent);
  const managedAsset = join(workspace.library.directory, 'shared-assets', 'asset.txt');
  await writeFile(managedAsset, 'managed content');
  await writeFile(externalFile, 'external sentinel');

  try {
    await expect(createWorkspaceBackupStore(workspace, {
      onBackupSourceEnumerated: () => {
        rmSync(managedAsset);
        symlinkSync(externalFile, managedAsset);
      },
    }).createBackup({ destinationParentDirectory: destinationParent })).rejects.toThrow('UNMANAGED_BACKUP_SOURCE');
    expect(await readdir(destinationParent)).toEqual([]);
    await expect(readFile(externalFile, 'utf8')).resolves.toBe('external sentinel');
  } finally {
    workspace.close();
  }
});

it('rejects a backup staging root replaced by a symlink before creating any external content', async () => {
  const sourceParent = await createTemporaryDirectory('designhub-backup-staging-race-source-');
  const destinationParent = await createTemporaryDirectory('designhub-backup-staging-race-target-');
  const externalDirectory = await createTemporaryDirectory('designhub-backup-staging-race-external-');
  const externalSentinel = join(externalDirectory, 'sentinel.txt');
  await writeFile(externalSentinel, 'external sentinel');
  const workspace = await initializeProjectLibrary(sourceParent);
  await writeFile(join(workspace.library.directory, 'shared-assets', 'asset.txt'), 'managed content');

  try {
    await expect(createWorkspaceBackupStore(workspace, {
      onBackupStagingReserved: (directory) => {
        rmSync(directory, { recursive: true });
        symlinkSync(externalDirectory, directory, 'dir');
      },
    }).createBackup({ destinationParentDirectory: destinationParent })).rejects.toThrow('INVALID_BACKUP_DESTINATION');
    expect(await readdir(destinationParent)).toEqual([]);
    expect(await readdir(externalDirectory)).toEqual(['sentinel.txt']);
    await expect(readFile(externalSentinel, 'utf8')).resolves.toBe('external sentinel');
  } finally {
    workspace.close();
  }
});

it('rejects non-M02 credential-like files inside the internal directory', async () => {
  const sourceParent = await createTemporaryDirectory('designhub-backup-internal-policy-source-');
  const destinationParent = await createTemporaryDirectory('designhub-backup-internal-policy-target-');
  const workspace = await initializeProjectLibrary(sourceParent);
  const credentialContent = 'api-key=do-not-back-up';
  await writeFile(join(workspace.library.directory, '.designhub', 'credentials.json'), credentialContent);

  try {
    await expect(createWorkspaceBackupStore(workspace).createBackup({ destinationParentDirectory: destinationParent })).rejects.toThrow('UNMANAGED_INTERNAL_FILE');
    expect(await readdir(destinationParent)).toEqual([]);
    await expect(readFile(join(workspace.library.directory, '.designhub', 'credentials.json'), 'utf8')).resolves.toBe(credentialContent);
  } finally {
    workspace.close();
  }
});

it('rejects a checksum-consistent backup artifact containing a non-M02 internal file', async () => {
  const sourceParent = await createTemporaryDirectory('designhub-backup-internal-artifact-source-');
  const backupParent = await createTemporaryDirectory('designhub-backup-internal-artifact-backup-');
  const restoreParent = await createTemporaryDirectory('designhub-backup-internal-artifact-restore-');
  const workspace = await initializeProjectLibrary(sourceParent);
  const credentialRelativePath = '.designhub/credentials.json';
  const credentialContent = 'api-key=do-not-restore';

  try {
    const store = createWorkspaceBackupStore(workspace);
    const artifact = await store.createBackup({ destinationParentDirectory: backupParent });
    await writeFile(join(artifact.directory, 'workspace', ...credentialRelativePath.split('/')), credentialContent);
    const manifest = await readBackupManifest(artifact.directory);
    expect(manifest.directories).toContain('.designhub');
    manifest.files.push({
      path: credentialRelativePath,
      size: Buffer.byteLength(credentialContent),
      sha256: sha256(credentialContent),
      storage: 'file',
    });
    await replaceManifest(artifact.directory, manifest);

    await expect(store.restoreBackup({
      backupDirectory: artifact.directory,
      destinationParentDirectory: restoreParent,
    })).rejects.toThrow('UNMANAGED_INTERNAL_FILE');
    expect(await readdir(restoreParent)).toEqual([]);
  } finally {
    workspace.close();
  }
});

it('rejects incomplete, tampered, and internally corrupt backup artifacts without publishing a restored workspace', async () => {
  const sourceParent = await createTemporaryDirectory('designhub-invalid-backup-source-');
  const backupParent = await createTemporaryDirectory('designhub-invalid-backup-artifacts-');
  const restoreParent = await createTemporaryDirectory('designhub-invalid-restore-target-');
  const workspace = await initializeProjectLibrary(sourceParent);
  const project = await createProjectStore(workspace).createProjectContainer({
    libraryId: workspace.library.libraryId,
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

it.each(['staging', 'final'] as const)('rejects a %s restore directory replaced by a symlink without touching the external target', async (phase) => {
  const sourceParent = await createTemporaryDirectory(`designhub-restore-${phase}-source-`);
  const backupParent = await createTemporaryDirectory(`designhub-restore-${phase}-backup-`);
  const restoreParent = await createTemporaryDirectory(`designhub-restore-${phase}-target-`);
  const externalDirectory = await createTemporaryDirectory(`designhub-restore-${phase}-external-`);
  const externalSentinel = join(externalDirectory, 'sentinel.txt');
  await writeFile(externalSentinel, 'external sentinel');
  const workspace = await initializeProjectLibrary(sourceParent);
  await writeFile(join(workspace.library.directory, 'shared-assets', 'asset.txt'), 'managed content');

  try {
    const artifact = await createWorkspaceBackupStore(workspace).createBackup({ destinationParentDirectory: backupParent });
    const replaceWithSymlink = (directory: string): void => {
      const replacementPath = phase === 'final' ? join(directory, 'trash') : directory;
      rmSync(replacementPath, { recursive: true });
      symlinkSync(externalDirectory, replacementPath, 'dir');
    };
    const options = phase === 'staging'
      ? { onRestoreStagingPrepared: replaceWithSymlink }
      : { onRestoreDestinationReserved: replaceWithSymlink };

    await expect(createWorkspaceBackupStore(workspace, options).restoreBackup({
      backupDirectory: artifact.directory,
      destinationParentDirectory: restoreParent,
    })).rejects.toThrow('UNMANAGED_RESTORE_DESTINATION');
    expect(await readdir(restoreParent)).toEqual([]);
    await expect(readFile(externalSentinel, 'utf8')).resolves.toBe('external sentinel');
    expect(await readdir(externalDirectory)).toEqual(['sentinel.txt']);
  } finally {
    workspace.close();
  }
});

it('requires a verified matching backup and rolls back a failed metadata-format publication', async () => {
  const sourceParent = await createTemporaryDirectory('designhub-migration-source-');
  const backupParent = await createTemporaryDirectory('designhub-migration-backup-');
  const created = await initializeProjectLibrary(sourceParent);
  created.close();
  const migrating = await openProjectLibrary(created.library.directory, 2);
  expect(migrating.library.openMode).toBe('migration-required');

  try {
    const artifact = await createWorkspaceBackupStore(migrating).createBackup({ destinationParentDirectory: backupParent });
    const manifestPath = join(migrating.library.directory, projectLibraryManifestName);
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

  const reopened = await openProjectLibrary(created.library.directory, 2);
  expect(reopened.library.openMode).toBe('writable');
  reopened.close();
});

it('recovers the original manifest after interruption between its move and migration publication', async () => {
  const sourceParent = await createTemporaryDirectory('designhub-migration-interruption-source-');
  const backupParent = await createTemporaryDirectory('designhub-migration-interruption-backup-');
  const created = await initializeProjectLibrary(sourceParent);
  created.close();
  const migrating = await openProjectLibrary(created.library.directory, 2);
  const manifestPath = join(migrating.library.directory, projectLibraryManifestName);
  const originalManifest = await readFile(manifestPath, 'utf8');

  const artifact = await createWorkspaceBackupStore(migrating).createBackup({ destinationParentDirectory: backupParent });
  await expect(createWorkspaceBackupStore(migrating, { failAt: 'migration-after-original-move' }).migrateMetadata({
    backupDirectory: artifact.directory,
    toFormatVersion: 2,
  })).rejects.toThrow('INJECTED_MIGRATION_INTERRUPTION');
  expect(existsSync(manifestPath)).toBe(false);
  expect((await readdir(migrating.library.directory)).some((name) => name.includes('.rollback-'))).toBe(true);
  migrating.close();

  const recovered = await openProjectLibrary(created.library.directory, 2);
  try {
    expect(recovered.library).toMatchObject({
      libraryId: created.library.libraryId,
      formatVersion: 1,
      openMode: 'migration-required',
    });
    await expect(readFile(manifestPath, 'utf8')).resolves.toBe(originalManifest);
    expect((await readdir(recovered.library.directory)).some((name) => name.includes('.rollback-') || name.includes('.migration-'))).toBe(false);
  } finally {
    recovered.close();
  }

  const reopened = await openProjectLibrary(created.library.directory, 2);
  expect(reopened.library.formatVersion).toBe(1);
  reopened.close();
});
