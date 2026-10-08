import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createImageToolJobStore } from '../../features/image-tools/job-store';
import { createImageToolJob, type ImageToolItem } from '../../features/image-tools/jobs';
import { createImageToolIpcHandlers } from './image-tools';

const createFixture = (directory: string) => {
  const mainFrame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  const outputRoot = join(directory, 'output');
  const job = createImageToolJob({
    id: 'job-1',
    libraryId: 'workspace-1',
    tool: 'resize',
    params: { width: 100, height: 100, fit: 'contain', format: 'png' },
    sourceRoot: join(directory, 'source'),
    outputRoot,
    itemIds: ['item-1'],
  });
  const item: ImageToolItem = {
    id: 'item-1',
    jobId: job.id,
    relativePath: 'result.png',
    state: 'completed',
    attempt: 1,
    resultPath: join(outputRoot, 'result.png'),
    updatedAt: job.updatedAt,
  };
  return { event, window, job, item, outputRoot };
};

it('reads only registered image-tool results as data URLs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-image-tools-'));
  try {
    const fixture = createFixture(directory);
    await mkdir(fixture.outputRoot, { recursive: true });
    await writeFile(fixture.item.resultPath!, Buffer.from('png-bytes'));
    const store = createImageToolJobStore(join(directory, '.designhub'));
    await store.save(fixture.job, [fixture.item]);
    const library = { library: { libraryId: 'workspace-1', directory, openMode: 'writable' } } as never;
    const handlers = createImageToolIpcHandlers({
      window: fixture.window as never,
      trustedUrl: fixture.event.senderFrame.url,
      getLibrary: () => library,
      showDialog: async () => ({ canceled: true, filePaths: [] }),
    });

    await expect(handlers.readResult(fixture.event as never, {
      libraryId: 'workspace-1',
      jobId: fixture.job.id,
      path: fixture.item.resultPath,
    })).resolves.toBe('data:image/png;base64,cG5nLWJ5dGVz');
    await expect(handlers.readResult(fixture.event as never, {
      libraryId: 'workspace-1',
      jobId: fixture.job.id,
      path: join(fixture.outputRoot, 'other.png'),
    })).resolves.toBeNull();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('deduplicates concurrent hydration during image-tool listing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-image-tools-'));
  try {
    const fixture = createFixture(directory);
    const store = createImageToolJobStore(join(directory, '.designhub'));
    await store.save(fixture.job, [fixture.item]);
    const library = { library: { libraryId: 'workspace-1', directory, openMode: 'writable' } } as never;
    const handlers = createImageToolIpcHandlers({
      window: fixture.window as never,
      trustedUrl: fixture.event.senderFrame.url,
      getLibrary: () => library,
      showDialog: async () => ({ canceled: true, filePaths: [] }),
    });

    const results = await Promise.allSettled([
      handlers.list(fixture.event as never, 'workspace-1'),
      handlers.list(fixture.event as never, 'workspace-1'),
    ]);

    expect(results).toEqual([
      expect.objectContaining({ status: 'fulfilled', value: [expect.objectContaining({ job: expect.objectContaining({ id: fixture.job.id }) })] }),
      expect.objectContaining({ status: 'fulfilled', value: [expect.objectContaining({ job: expect.objectContaining({ id: fixture.job.id }) })] }),
    ]);
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 20));
    await rm(directory, { recursive: true, force: true });
  }
});
