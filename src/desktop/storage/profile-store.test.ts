import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { createProfileStore } from './profile-store';

const directories: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const makeDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-profile-'));
  directories.push(directory);
  return directory;
};

it('returns null when profile.json is missing', async () => {
  const store = createProfileStore(await makeDirectory());

  await expect(store.loadProfile()).resolves.toBeNull();
});

it('merges a patch and reloads the saved profile', async () => {
  const store = createProfileStore(await makeDirectory());

  await expect(store.saveProfile({
    displayName: 'Sifan',
    avatarDataUrl: 'data:image/webp;base64,AA==',
    onboarding: { profileCompleted: true },
  })).resolves.toMatchObject({
    formatVersion: 1,
    displayName: 'Sifan',
    onboarding: { profileCompleted: true, modelStepCompleted: false },
  });
  await expect(store.loadProfile()).resolves.toMatchObject({ displayName: 'Sifan' });
});

it('rejects malformed JSON without overwriting the existing file', async () => {
  const directory = await makeDirectory();
  const path = join(directory, 'profile.json');
  await writeFile(path, '{bad', 'utf8');
  const store = createProfileStore(directory);

  await expect(store.loadProfile()).rejects.toThrow('INVALID_PROFILE');
  await expect(readFile(path, 'utf8')).resolves.toBe('{bad');
});
