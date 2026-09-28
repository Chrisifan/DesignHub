import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createImageToolJob, type ImageToolItem } from './jobs';
import { processImageToolItem } from './worker';

const inputImage = async (path: string): Promise<void> => writeFile(path, await sharp({ create: { width: 2, height: 3, channels: 4, background: '#00ff00' } }).png().toBuffer());
const item = (jobId: string): ImageToolItem => ({ id: 'item-1', jobId, relativePath: 'source.png', state: 'queued', attempt: 1, updatedAt: new Date().toISOString() });

describe('batch image worker', () => {
  it('runs local resize and publishes a validated result', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-worker-'));
    await inputImage(join(root, 'source.png'));
    const job = createImageToolJob({ id: 'job-local', tool: 'resize', params: { width: 6, height: 4, format: 'webp' }, sourceRoot: root, outputRoot: `${root}-out`, itemIds: ['item-1'], executor: { kind: 'local', engine: 'image-codec' } });
    const result = await processImageToolItem(job, item(job.id));
    expect(result.item).toMatchObject({ state: 'completed', resultPath: `${root}-out/source.webp` });
    await expect(sharp(await readFile(result.item.resultPath!)).metadata()).resolves.toMatchObject({ width: 6, height: 4, format: 'webp' });
  });

  it('passes provider metadata through the completed item', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-worker-'));
    await inputImage(join(root, 'source.png'));
    const job = createImageToolJob({ id: 'job-provider', tool: 'upscale', params: { scale: 2 }, sourceRoot: root, outputRoot: `${root}-out`, itemIds: ['item-1'], executor: { kind: 'provider', connectionId: 'connection-1', modelId: 'model-1' } });
    const result = await processImageToolItem(job, item(job.id), { executeProvider: async () => ({ bytes: new Uint8Array(await readFile(join(root, 'source.png'))), remoteRequestId: 'remote-1' }) });
    expect(result.item).toMatchObject({ state: 'completed', remoteRequestId: 'remote-1' });
  });

  it('rejects opaque remove-background results before publishing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-worker-'));
    await inputImage(join(root, 'source.png'));
    const job = createImageToolJob({ id: 'job-opaque', tool: 'remove-background', params: {}, sourceRoot: root, outputRoot: `${root}-out`, itemIds: ['item-1'], executor: { kind: 'provider', connectionId: 'connection-1', modelId: 'model-1' } });
    const opaque = new Uint8Array(await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } }).png().toBuffer());
    await expect(processImageToolItem(job, item(job.id), { executeProvider: async () => opaque })).rejects.toThrow('TRANSPARENCY_REQUIRED');
  });
});
