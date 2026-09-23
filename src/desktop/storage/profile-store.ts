import { access, constants, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { lstatSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';

import { emptyAppProfile, isAppProfile, type AppProfile, type ProfilePatch } from '../../features/profile/model';

export const profileFileName = 'profile.json';

type FileOperations = {
  rename: typeof rename;
};

const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

const assertRegularFile = (path: string): void => {
  try {
    const status = lstatSync(path);
    if (!status.isFile() || status.isSymbolicLink()) throw new Error('INVALID_PROFILE');
  } catch (error) {
    if (isMissing(error)) return;
    if (error instanceof Error && error.message === 'INVALID_PROFILE') throw error;
    throw new Error('INVALID_PROFILE');
  }
};

export const createProfileStore = (
  userDataDirectory: string,
  operations: FileOperations = { rename },
) => {
  const path = join(userDataDirectory, profileFileName);

  const loadProfile = async (): Promise<AppProfile | null> => {
    assertRegularFile(path);
    try {
      await access(path, constants.R_OK);
      const value: unknown = JSON.parse(await readFile(path, 'utf8'));
      if (!isAppProfile(value)) throw new Error('INVALID_PROFILE');
      return value;
    } catch (error) {
      if (isMissing(error)) return null;
      if (error instanceof Error && error.message === 'INVALID_PROFILE') throw error;
      throw new Error('INVALID_PROFILE');
    }
  };

  const saveProfile = async (patch: ProfilePatch): Promise<AppProfile> => {
    const current = (await loadProfile()) ?? emptyAppProfile();
    const profile: AppProfile = {
      ...current,
      ...(patch.displayName === undefined ? {} : { displayName: patch.displayName }),
      ...(patch.avatarDataUrl === undefined ? {} : { avatarDataUrl: patch.avatarDataUrl }),
      onboarding: {
        ...current.onboarding,
        ...(patch.onboarding ?? {}),
      },
    };
    if (!isAppProfile(profile)) throw new Error('INVALID_PROFILE');
    assertRegularFile(path);
    const temporary = join(dirname(path), `.${randomUUID()}.profile.tmp`);
    try {
      await writeFile(temporary, `${JSON.stringify(profile, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      await operations.rename(temporary, path);
      return profile;
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  };

  return { loadProfile, saveProfile };
};
