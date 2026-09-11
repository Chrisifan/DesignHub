import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron, expect, test } from 'playwright/test';

const readSmokeResult = async (path: string): Promise<{ projectId: string } | null> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as { projectId: string };
  } catch {
    return null;
  }
};

const runStorageSmoke = async (executablePath?: string): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-electron-storage-'));
  const resultPath = join(directory, 'storage-result.json');
  const electronApp = await _electron.launch({
    args: executablePath ? [] : ['.'],
    executablePath,
    env: { ...process.env, DESIGNHUB_STORAGE_SMOKE_RESULT: resultPath },
  });

  try {
    await expect.poll(async () => readSmokeResult(resultPath)).toMatchObject({ projectId: expect.any(String) });
  } finally {
    await electronApp.close();
    await rm(directory, { recursive: true, force: true });
  }
};

test('runs the actual main-process project storage entry without a renderer bridge', async () => {
  await runStorageSmoke();
});

test('runs the project storage entry from a packaged Electron executable', async () => {
  const packagedExecutable = process.env.DESIGNHUB_PACKAGED_APP_PATH;
  test.skip(!packagedExecutable, 'Set DESIGNHUB_PACKAGED_APP_PATH after pnpm package.');
  await runStorageSmoke(packagedExecutable);
});
