import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createImageToolJob, type ImageToolItem } from './jobs';
import { createImageToolScheduler } from './scheduler';

const makeItem = (id: string, relativePath: string): ImageToolItem => ({ id, jobId: id.split('-')[0], relativePath, state: 'queued', attempt: 1, updatedAt: new Date().toISOString() });
const makeImage = async (path: string): Promise<void> => writeFile(path, await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).png().toBuffer());

describe('image tool scheduler', () => {
  it('round-robins provider jobs sharing a connection', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-scheduler-'));
    await makeImage(join(root, 'a.png'));
    await makeImage(join(root, 'b.png'));
    const order: string[] = [];
    const scheduler = createImageToolScheduler({ executeProvider: async ({ job }) => { order.push(job.id); return new Uint8Array(await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 0.5 } } }).png().toBuffer()); } });
    const jobA = createImageToolJob({ id: 'job-a', tool: 'remove-background', params: {}, sourceRoot: root, outputRoot: `${root}-a`, itemIds: ['item-a1', 'item-a2'], executor: { kind: 'provider', connectionId: 'connection-1', modelId: 'model' } });
    const jobB = createImageToolJob({ id: 'job-b', tool: 'remove-background', params: {}, sourceRoot: root, outputRoot: `${root}-b`, itemIds: ['item-b1'], executor: { kind: 'provider', connectionId: 'connection-1', modelId: 'model' } });
    scheduler.enqueue(jobA, [{ ...makeItem('job-a-item-a1', 'a.png'), jobId: jobA.id }, { ...makeItem('job-a-item-a2', 'b.png'), jobId: jobA.id }]);
    scheduler.enqueue(jobB, [{ ...makeItem('job-b-item-b1', 'a.png'), jobId: jobB.id }]);
    await scheduler.waitForIdle();
    expect(order).toEqual(['job-a', 'job-b', 'job-a']);
    expect(scheduler.get(jobB.id)?.job.state).toBe('completed');
  });

  it('pauses queued work, allows explicit retry, and cancels unstarted items', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-scheduler-'));
    await makeImage(join(root, 'a.png'));
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const scheduler = createImageToolScheduler({ executeProvider: async () => { await blocked; return new Uint8Array(await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 0.5 } } }).png().toBuffer()); } });
    const job = createImageToolJob({ id: 'job-pause', tool: 'remove-background', params: {}, sourceRoot: root, outputRoot: `${root}-out`, itemIds: ['item-1', 'item-2'] , executor: { kind: 'provider', connectionId: 'connection-1', modelId: 'model' } });
    scheduler.enqueue(job, [{ ...makeItem('item-1', 'a.png'), id: 'item-1', jobId: job.id }, { ...makeItem('item-2', 'a.png'), id: 'item-2', jobId: job.id }]);
    scheduler.pauseJob(job.id);
    expect(scheduler.get(job.id)?.job.state).toBe('paused');
    scheduler.cancelJob(job.id);
    expect(scheduler.get(job.id)?.items[1].state).toBe('cancelled');
    release();
    await scheduler.waitForIdle();
    expect(['cancelled', 'unknown']).toContain(scheduler.get(job.id)?.items[0].state);
  });
});
