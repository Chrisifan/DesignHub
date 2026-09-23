import { access, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants, lstatSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';

export const projectLibrarySettingsFileName = 'project-library.json';

type FileOperations = {
  rename: typeof rename;
};

type ProjectLibrarySettings = { formatVersion: 1; directory: string };

const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

const isSettings = (value: unknown): value is ProjectLibrarySettings => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const settings = value as Record<string, unknown>;
  return settings.formatVersion === 1 && typeof settings.directory === 'string' && settings.directory.trim().length > 0;
};

const assertRegularFile = (path: string): void => {
  try {
    const status = lstatSync(path);
    if (!status.isFile() || status.isSymbolicLink()) throw new Error('INVALID_PROJECT_LIBRARY_SETTINGS');
  } catch (error) {
    if (isMissing(error)) return;
    if (error instanceof Error && error.message === 'INVALID_PROJECT_LIBRARY_SETTINGS') throw error;
    throw new Error('INVALID_PROJECT_LIBRARY_SETTINGS');
  }
};

export const createProjectLibrarySettingsStore = (
  userDataDirectory: string,
  operations: FileOperations = { rename },
) => {
  const path = join(userDataDirectory, projectLibrarySettingsFileName);

  const loadProjectLibraryDirectory = async (): Promise<string | null> => {
    assertRegularFile(path);
    try {
      await access(path, constants.R_OK);
      const value: unknown = JSON.parse(await readFile(path, 'utf8'));
      if (!isSettings(value)) throw new Error('INVALID_PROJECT_LIBRARY_SETTINGS');
      return value.directory;
    } catch (error) {
      if (isMissing(error)) return null;
      if (error instanceof Error && error.message === 'INVALID_PROJECT_LIBRARY_SETTINGS') throw error;
      throw new Error('INVALID_PROJECT_LIBRARY_SETTINGS');
    }
  };

  const saveProjectLibraryDirectory = async (directory: string): Promise<void> => {
    if (typeof directory !== 'string' || directory.trim().length === 0) throw new Error('INVALID_PROJECT_LIBRARY_SETTINGS');
    assertRegularFile(path);
    const temporary = join(dirname(path), `.${randomUUID()}.project-library.tmp`);
    try {
      await writeFile(temporary, `${JSON.stringify({ formatVersion: 1, directory } satisfies ProjectLibrarySettings, null, 2)}\n`, {
        encoding: 'utf8', flag: 'wx',
      });
      await operations.rename(temporary, path);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  };

  return { loadProjectLibraryDirectory, saveProjectLibraryDirectory };
};
