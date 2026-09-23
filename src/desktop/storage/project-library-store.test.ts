// @vitest-environment node

import { mkdtemp, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, expect, it, vi } from 'vitest';

import { getWritableProjectLibraryLease, initializeProjectLibrary, openProjectLibrary, projectLibraryManifestName } from './project-library-store';

const temporaryDirectories: string[] = [];

const createLibraryDirectory = async (): Promise<string> => {
  const parent = await mkdtemp(join(tmpdir(), 'designhub-project-library-'));
  temporaryDirectories.push(parent);
  const directory = join(parent, 'selected-root');
  await mkdir(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

it('initializes the selected empty directory itself as a project library', async () => {
  const directory = await createLibraryDirectory();

  const handle = await initializeProjectLibrary(directory);

  expect(handle.library).toMatchObject({ directory: await realpath(directory), formatVersion: 1, openMode: 'writable' });
  expect(handle.library.libraryId).toMatch(/^[0-9a-f-]{36}$/u);
  expect(JSON.parse(await readFile(join(directory, projectLibraryManifestName), 'utf8'))).toMatchObject({
    kind: 'designhub-project-library',
    libraryId: handle.library.libraryId,
    formatVersion: 1,
  });
  await expect(readdir(join(directory, 'projects'))).resolves.toEqual([]);
  await expect(readdir(join(directory, '.designhub'))).resolves.toContain('writer-lock.sqlite');
  handle.close();
});

it('reopens an existing project library with the same identity and enforces one writer', async () => {
  const directory = await createLibraryDirectory();
  const first = await initializeProjectLibrary(directory);
  const second = await openProjectLibrary(directory);

  expect(second.library.libraryId).toBe(first.library.libraryId);
  expect(first.library.openMode).toBe('writable');
  expect(second.library.openMode).toBe('read-only');

  second.close();
  first.close();
  const third = await openProjectLibrary(directory);
  expect(third.library.openMode).toBe('writable');
  third.close();
});

it('rejects unknown non-empty directories without changing their contents', async () => {
  const directory = await createLibraryDirectory();
  const userFile = join(directory, 'keep.txt');
  await writeFile(userFile, 'user data');
  const before = await readdir(directory);

  await expect(initializeProjectLibrary(directory)).rejects.toThrow('PROJECT_LIBRARY_DIRECTORY_NOT_EMPTY');

  expect(await readdir(directory)).toEqual(before);
  await expect(readFile(userFile, 'utf8')).resolves.toBe('user data');
});

it('does not treat or modify a legacy workspace as a project library', async () => {
  const directory = await createLibraryDirectory();
  const legacyManifestPath = join(directory, 'designhub.workspace.json');
  const legacyManifest = JSON.stringify({ kind: 'designhub-workspace', workspaceId: 'legacy-id', name: 'Legacy', formatVersion: 1 });
  await writeFile(legacyManifestPath, legacyManifest);

  await expect(openProjectLibrary(directory)).rejects.toThrow('NOT_A_PROJECT_LIBRARY');

  expect(await readdir(directory)).toEqual(['designhub.workspace.json']);
  await expect(readFile(legacyManifestPath, 'utf8')).resolves.toBe(legacyManifest);
});

it('invalidates a writable lease after its root directory is replaced', async () => {
  const directory = await createLibraryDirectory();
  const handle = await initializeProjectLibrary(directory);
  const movedDirectory = `${directory}-moved`;

  await rename(directory, movedDirectory);
  await mkdir(directory);

  expect(getWritableProjectLibraryLease(handle)).toBeNull();
  handle.close();
});

it('cleans partial initialization after a lock-store failure so the directory can be retried', async () => {
  const directory = await createLibraryDirectory();
  const createLockTable = vi.spyOn(Database.prototype, 'exec').mockImplementationOnce(() => {
    throw new Error('INJECTED_LOCK_STORE_FAILURE');
  });

  await expect(initializeProjectLibrary(directory)).rejects.toThrow('INJECTED_LOCK_STORE_FAILURE');
  createLockTable.mockRestore();
  await expect(readdir(directory)).resolves.toEqual([]);

  const retried = await initializeProjectLibrary(directory);
  expect(retried.library.openMode).toBe('writable');
  retried.close();
});
