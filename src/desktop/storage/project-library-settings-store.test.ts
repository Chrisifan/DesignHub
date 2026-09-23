import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';

import { createProjectLibrarySettingsStore, projectLibrarySettingsFileName } from './project-library-settings-store';

it('returns no selected directory before a project library has been chosen', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-library-settings-'));
  try {
    const settings = createProjectLibrarySettingsStore(directory);
    await expect(settings.loadProjectLibraryDirectory()).resolves.toBeNull();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('persists one selected project library directory across store instances', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-library-settings-'));
  try {
    const settings = createProjectLibrarySettingsStore(directory);
    await settings.saveProjectLibraryDirectory('/Volumes/DesignHub Library');
    await expect(createProjectLibrarySettingsStore(directory).loadProjectLibraryDirectory())
      .resolves.toBe('/Volumes/DesignHub Library');
    await expect(readFile(join(directory, projectLibrarySettingsFileName), 'utf8'))
      .resolves.toContain('"directory": "/Volumes/DesignHub Library"');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('rejects a malformed selected-directory preference', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-library-settings-'));
  try {
    const settings = createProjectLibrarySettingsStore(directory);
    await settings.saveProjectLibraryDirectory('/Volumes/DesignHub Library');
    const path = join(directory, projectLibrarySettingsFileName);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, '{"directory":42}');
    await expect(settings.loadProjectLibraryDirectory()).rejects.toThrow('INVALID_PROJECT_LIBRARY_SETTINGS');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('preserves the previous preference when its atomic replacement fails', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-library-settings-'));
  try {
    const settings = createProjectLibrarySettingsStore(directory);
    await settings.saveProjectLibraryDirectory('/Volumes/Previous Library');
    const failingSettings = createProjectLibrarySettingsStore(directory, {
      rename: vi.fn(async () => { throw new Error('disk full'); }),
    });
    await expect(failingSettings.saveProjectLibraryDirectory('/Volumes/Next Library')).rejects.toThrow('disk full');
    await expect(settings.loadProjectLibraryDirectory()).resolves.toBe('/Volumes/Previous Library');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
