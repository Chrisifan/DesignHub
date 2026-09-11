// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

const workspaceManifestName = 'designhub.workspace.json';
const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-workspace-open-identity-'));
  temporaryDirectories.push(directory);
  return directory;
};

let manifestReadCount = 0;
let onSecondManifestRead: (() => Promise<void>) | null = null;

vi.doMock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  const readFileWithHook = async (...args: Parameters<typeof actual.readFile>): ReturnType<typeof actual.readFile> => {
    const content = await actual.readFile(...args);
    const path = String(args[0]);
    if (path.endsWith(workspaceManifestName) && onSecondManifestRead) {
      manifestReadCount += 1;
      if (manifestReadCount === 2) {
        const hook = onSecondManifestRead;
        onSecondManifestRead = null;
        await hook();
      }
    }
    return content;
  };
  return { ...actual, readFile: readFileWithHook };
});

afterEach(async () => {
  onSecondManifestRead = null;
  manifestReadCount = 0;
  await Promise.all(temporaryDirectories.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
  vi.resetModules();
});

it('rejects opening writable when the workspace directory is replaced after the manifest read', async () => {
  const { createWorkspace, initializeWorkspaceWriterLock, openWorkspace } = await import('../../src/desktop/storage/workspace-store');
  const parent = await createTemporaryDirectory();
  const created = await createWorkspace({ parentDirectory: parent, name: 'opening identity' });
  created.close();

  const originalDirectory = created.workspace.directory;
  const movedDirectory = join(parent, 'moved-opening-identity');
  const originalManifestPath = join(originalDirectory, workspaceManifestName);
  const originalManifest = await readFile(originalManifestPath, 'utf8');
  const replacementManifest = {
    ...(JSON.parse(originalManifest) as Record<string, unknown>),
    workspaceId: randomUUID(),
    name: 'replacement opening identity',
  };
  const staleStagingName = '.00000000-0000-4000-8000-000000000000.creating-00000000-0000-4000-8000-000000000001';

  const replaceWorkspaceAfterManifestRead = async () => {
    await rename(originalDirectory, movedDirectory);
    await mkdir(originalDirectory);
    await Promise.all([
      mkdir(join(originalDirectory, '.designhub')),
      mkdir(join(originalDirectory, 'projects')),
      mkdir(join(originalDirectory, 'shared-assets')),
      mkdir(join(originalDirectory, 'trash')),
    ]);
    await writeFile(originalManifestPath, `${JSON.stringify(replacementManifest, null, 2)}\n`);
    initializeWorkspaceWriterLock(originalDirectory);
    await mkdir(join(originalDirectory, 'projects', staleStagingName));
  };
  onSecondManifestRead = replaceWorkspaceAfterManifestRead;

  let opened: Awaited<ReturnType<typeof openWorkspace>> | null = null;
  let openError: unknown = null;
  try {
    opened = await openWorkspace(originalDirectory);
  } catch (error) {
    openError = error;
  } finally {
    opened?.close();
  }

  expect(openError).toBeInstanceOf(Error);
  expect((openError as Error).message).toBe('INVALID_WORKSPACE_PATH');
  expect(opened).toBeNull();
  expect(existsSync(join(movedDirectory, workspaceManifestName))).toBe(true);
  await expect(readFile(originalManifestPath, 'utf8')).resolves.toContain(String(replacementManifest.workspaceId));
  await expect(readdir(join(originalDirectory, 'projects'))).resolves.toEqual([staleStagingName]);
  expect(existsSync(join(originalDirectory, '.designhub', 'project-index.sqlite'))).toBe(false);
});
