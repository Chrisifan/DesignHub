import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

import { initializeProjectLibrary, openProjectLibrary } from './project-library-store';
import {
  loadWorkspaceSettings,
  saveWorkspaceSettings,
  workspaceSettingsFileName,
  type WorkspaceSettings,
} from './settings-store';

const settings: WorkspaceSettings = {
  formatVersion: 1,
  backup: {
    destinationParentDirectory: '/Volumes/backup',
    schedule: 'weekly',
    lastRunAt: '2026-09-13T00:00:00.000Z',
    lastArtifactPath: '/Volumes/backup/designhub-1',
  },
};

it('persists workspace backup settings and restores them after reopening', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-settings-'));
  try {
    const handle = await initializeProjectLibrary(root);
    await saveWorkspaceSettings(handle, handle.library.libraryId, settings);
    const directory = handle.library.directory;
    handle.close();
    const reopened = await openProjectLibrary(directory);
    await expect(loadWorkspaceSettings(reopened, reopened.library.libraryId)).resolves.toEqual(settings);
    reopened.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('writes an atomic settings file and rejects malformed content', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-settings-'));
  try {
    const handle = await initializeProjectLibrary(root);
    await saveWorkspaceSettings(handle, handle.library.libraryId, settings);
    const path = join(handle.library.directory, '.designhub', workspaceSettingsFileName);
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(settings);
    await writeFile(path, '{"formatVersion":1,"backup":{"schedule":"hourly"}}');
    await expect(loadWorkspaceSettings(handle, handle.library.libraryId)).rejects.toThrow('INVALID_WORKSPACE_SETTINGS');
    handle.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects settings writes from a read-only workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-settings-'));
  try {
    const handle = await initializeProjectLibrary(root);
    const directory = handle.library.directory;
    handle.close();
    const writable = await openProjectLibrary(directory);
    const readonly = await openProjectLibrary(directory);
    await expect(saveWorkspaceSettings(readonly, readonly.library.libraryId, settings)).rejects.toThrow('WORKSPACE_NOT_WRITABLE');
    readonly.close();
    writable.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects settings symlinks instead of reading or replacing an external file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-settings-'));
  const externalRoot = await mkdtemp(join(tmpdir(), 'designhub-settings-external-'));
  try {
    const handle = await initializeProjectLibrary(root);
    const settingsPath = join(handle.library.directory, '.designhub', workspaceSettingsFileName);
    const externalPath = join(externalRoot, 'settings.json');
    await writeFile(externalPath, `${JSON.stringify(settings)}\n`);
    await symlink(externalPath, settingsPath);
    await expect(loadWorkspaceSettings(handle, handle.library.libraryId)).rejects.toThrow('INVALID_WORKSPACE_SETTINGS');
    await expect(saveWorkspaceSettings(handle, handle.library.libraryId, settings)).rejects.toThrow('INVALID_WORKSPACE_SETTINGS');
    await expect(readFile(externalPath, 'utf8')).resolves.toContain('Volumes/backup');
    handle.close();
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(externalRoot, { recursive: true, force: true });
  }
});
