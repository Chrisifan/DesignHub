import { mkdtemp, mkdir, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it, vi } from 'vitest';

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

const createResultHandlers = (directory: string, fixture: ReturnType<typeof createFixture>) => {
  const library = { library: { libraryId: 'workspace-1', directory, openMode: 'writable' } } as never;
  const openPath = vi.fn(async () => '');
  const revealPath = vi.fn();
  const importAsset = vi.fn(async () => null);
  const handlers = createImageToolIpcHandlers({
    window: fixture.window as never,
    trustedUrl: fixture.event.senderFrame.url,
    getLibrary: () => library,
    showDialog: async () => ({ canceled: true, filePaths: [] }),
    openPath,
    revealPath,
    importAsset,
  });
  const input = { libraryId: 'workspace-1', projectId: 'project-1', jobId: fixture.job.id, path: fixture.item.resultPath! };
  return { handlers, input, openPath, revealPath, importAsset, library };
};

it('rejects a persisted result replaced with an external symlink for every result action', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-image-tools-'));
  try {
    const fixture = createFixture(directory);
    await mkdir(fixture.outputRoot, { recursive: true });
    await writeFile(fixture.item.resultPath!, 'original-result');
    const store = createImageToolJobStore(join(directory, '.designhub'));
    await store.save(fixture.job, [fixture.item]);
    const externalPath = join(directory, 'external.png');
    const externalBytes = Buffer.from('external-image-must-stay-unchanged');
    await writeFile(externalPath, externalBytes);
    await unlink(fixture.item.resultPath!);
    await symlink(externalPath, fixture.item.resultPath!);
    const { handlers, input, openPath, revealPath, importAsset } = createResultHandlers(directory, fixture);

    expect.soft(await handlers.readResult(fixture.event, input)).toBeNull();
    expect.soft(await handlers.openResult(fixture.event, input)).toBe(false);
    expect.soft(await handlers.revealResult(fixture.event, input)).toBe(false);
    expect.soft(await handlers.importResult(fixture.event, input)).toBeNull();
    expect.soft(openPath).not.toHaveBeenCalled();
    expect.soft(revealPath).not.toHaveBeenCalled();
    expect.soft(importAsset).not.toHaveBeenCalled();
    expect(await readFile(externalPath)).toEqual(externalBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it.each(['missing', 'directory', 'unregistered', 'internal-symlink', 'escaping-parent-symlink', 'unsupported-extension'] as const)(
  'fails closed for a %s result without invoking external actions',
  async (kind) => {
    const directory = await mkdtemp(join(tmpdir(), 'designhub-image-tools-'));
    try {
      const fixture = createFixture(directory);
      await mkdir(fixture.outputRoot, { recursive: true });
      if (kind === 'escaping-parent-symlink') {
        const externalDirectory = join(directory, 'external');
        await mkdir(externalDirectory);
        await writeFile(join(externalDirectory, 'result.png'), 'external-image');
        await symlink(externalDirectory, join(fixture.outputRoot, 'linked'), 'dir');
        fixture.item.resultPath = join(fixture.outputRoot, 'linked', 'result.png');
      } else if (kind === 'internal-symlink') {
        const target = join(fixture.outputRoot, 'target.png');
        await writeFile(target, 'internal-image');
        await symlink(target, fixture.item.resultPath!);
      } else if (kind === 'directory') {
        await mkdir(fixture.item.resultPath!);
      } else if (kind !== 'missing') {
        if (kind === 'unsupported-extension') fixture.item.resultPath = join(fixture.outputRoot, 'result.gif');
        await writeFile(fixture.item.resultPath!, 'image-bytes');
      }
      const store = createImageToolJobStore(join(directory, '.designhub'));
      await store.save(fixture.job, kind === 'unregistered' ? [{ ...fixture.item, resultPath: undefined }] : [fixture.item]);
      const { handlers, input, openPath, revealPath, importAsset } = createResultHandlers(directory, fixture);

      expect.soft(await handlers.readResult(fixture.event, input)).toBeNull();
      expect.soft(await handlers.openResult(fixture.event, input)).toBe(false);
      expect.soft(await handlers.revealResult(fixture.event, input)).toBe(false);
      expect.soft(await handlers.importResult(fixture.event, input)).toBeNull();
      expect.soft(openPath).not.toHaveBeenCalled();
      expect.soft(revealPath).not.toHaveBeenCalled();
      expect(importAsset).not.toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

it.each([
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.PNG', 'image/png'],
])('allows registered regular %s results with the explicit MIME type', async (extension, mimeType) => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-image-tools-'));
  try {
    const fixture = createFixture(directory);
    fixture.item.resultPath = join(fixture.outputRoot, `result${extension}`);
    await mkdir(fixture.outputRoot, { recursive: true });
    await writeFile(fixture.item.resultPath, 'image-bytes');
    await createImageToolJobStore(join(directory, '.designhub')).save(fixture.job, [fixture.item]);
    const { handlers, input, openPath, revealPath, importAsset, library } = createResultHandlers(directory, fixture);

    await expect(handlers.readResult(fixture.event, input)).resolves.toBe(`data:${mimeType};base64,aW1hZ2UtYnl0ZXM=`);
    await expect(handlers.openResult(fixture.event, input)).resolves.toBe(true);
    await expect(handlers.revealResult(fixture.event, input)).resolves.toBe(true);
    await expect(handlers.importResult(fixture.event, input)).resolves.toBeNull();
    expect(openPath).toHaveBeenCalledExactlyOnceWith(fixture.item.resultPath);
    expect(revealPath).toHaveBeenCalledExactlyOnceWith(fixture.item.resultPath);
    expect(importAsset).toHaveBeenCalledExactlyOnceWith(library, {
      libraryId: 'workspace-1', projectId: 'project-1',
      items: [{ name: `result${extension}`, mimeType, data: new Uint8Array(Buffer.from('image-bytes')) }],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('keeps opening the job output directory without requiring a registered file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-image-tools-'));
  try {
    const fixture = createFixture(directory);
    await mkdir(fixture.outputRoot, { recursive: true });
    await createImageToolJobStore(join(directory, '.designhub')).save(fixture.job, [fixture.item]);
    const { handlers, input, openPath } = createResultHandlers(directory, fixture);

    await expect(handlers.openOutput(fixture.event, { ...input, path: fixture.outputRoot })).resolves.toBe(true);
    expect(openPath).toHaveBeenCalledExactlyOnceWith(fixture.outputRoot);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

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
