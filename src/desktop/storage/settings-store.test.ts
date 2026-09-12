import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

import { createWorkspace, openWorkspace } from './workspace-store';
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
    const handle = await createWorkspace({ parentDirectory: root, name: 'Studio' });
    await saveWorkspaceSettings(handle, handle.workspace.workspaceId, settings);
    const directory = handle.workspace.directory;
    handle.close();
    const reopened = await openWorkspace(directory);
    await expect(loadWorkspaceSettings(reopened, reopened.workspace.workspaceId)).resolves.toEqual(settings);
    reopened.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('writes an atomic settings file and rejects malformed content', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-settings-'));
  try {
    const handle = await createWorkspace({ parentDirectory: root, name: 'Studio' });
    await saveWorkspaceSettings(handle, handle.workspace.workspaceId, settings);
    const path = join(handle.workspace.directory, '.designhub', workspaceSettingsFileName);
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(settings);
    await writeFile(path, '{"formatVersion":1,"backup":{"schedule":"hourly"}}');
    await expect(loadWorkspaceSettings(handle, handle.workspace.workspaceId)).rejects.toThrow('INVALID_WORKSPACE_SETTINGS');
    handle.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects settings writes from a read-only workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-settings-'));
  try {
    const handle = await createWorkspace({ parentDirectory: root, name: 'Studio' });
    const directory = handle.workspace.directory;
    handle.close();
    const writable = await openWorkspace(directory);
    const readonly = await openWorkspace(directory);
    await expect(saveWorkspaceSettings(readonly, readonly.workspace.workspaceId, settings)).rejects.toThrow('WORKSPACE_NOT_WRITABLE');
    readonly.close();
    writable.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
