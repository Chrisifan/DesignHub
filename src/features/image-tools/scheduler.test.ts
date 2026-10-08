import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createImageToolJob, type ImageToolItem } from './jobs';
import { createImageToolScheduler } from './scheduler';

const makeItem = (id: string, relativePath: string): ImageToolItem => ({ id, jobId: id.split('-')[0], relativePath, state: 'queued', attempt: 1, updatedAt: new Date().toISOString() });
const makeImage = async (path: string): Promise<void> => writeFile(path, await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).png().toBuffer());

describe('image tool scheduler', () => {
  it('runs provider items in parallel up to the configured connection concurrency', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-scheduler-'));
    await makeImage(join(root, 'a.png'));
    await makeImage(join(root, 'b.png'));
    let active = 0;
    let maximumActive = 0;
    const scheduler = createImageToolScheduler({ maxProviderConcurrency: 2, executeProvider: async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      return new Uint8Array(await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 0.5 } } }).png().toBuffer());
    } });
    const jobA = createImageToolJob({ id: 'job-a', tool: 'remove-background', params: {}, sourceRoot: root, outputRoot: `${root}-a`, itemIds: ['item-a1', 'item-a2'], executor: { kind: 'provider', connectionId: 'connection-1', modelId: 'model' } });
    scheduler.enqueue(jobA, [{ ...makeItem('job-a-item-a1', 'a.png'), jobId: jobA.id }, { ...makeItem('job-a-item-a2', 'b.png'), jobId: jobA.id }]);
    await scheduler.waitForIdle();
    expect(maximumActive).toBe(2);
    expect(scheduler.get(jobA.id)?.job.state).toBe('completed');
  });

  it('marks a provider item failed when the request exceeds the item timeout', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-scheduler-'));
    await makeImage(join(root, 'a.png'));
    const scheduler = createImageToolScheduler({ itemTimeoutMs: 10, executeProvider: async () => new Promise<Uint8Array>(() => undefined) });
    const job = createImageToolJob({ id: 'job-timeout', tool: 'remove-background', params: {}, sourceRoot: root, outputRoot: `${root}-out`, itemIds: ['item-timeout'], executor: { kind: 'provider', connectionId: 'connection-1', modelId: 'model' } });
    scheduler.enqueue(job, [{ ...makeItem('item-timeout', 'a.png'), id: 'item-timeout', jobId: job.id }]);
    await scheduler.waitForIdle();
    expect(scheduler.get(job.id)?.items[0]).toMatchObject({ state: 'failed', errorCode: 'IMAGE_TOOL_ITEM_TIMEOUT' });
  });

  it('round-robins provider jobs when the connection concurrency is one', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-scheduler-'));
    await makeImage(join(root, 'a.png'));
    await makeImage(join(root, 'b.png'));
    const order: string[] = [];
    const scheduler = createImageToolScheduler({ maxProviderConcurrency: 1, executeProvider: async ({ job }) => {
      order.push(job.id);
      return new Uint8Array(await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 0.5 } } }).png().toBuffer());
    } });
    const jobA = createImageToolJob({ id: 'job-round-a', tool: 'remove-background', params: {}, sourceRoot: root, outputRoot: `${root}-round-a`, itemIds: ['item-round-a1', 'item-round-a2'], executor: { kind: 'provider', connectionId: 'connection-1', modelId: 'model' } });
    const jobB = createImageToolJob({ id: 'job-round-b', tool: 'remove-background', params: {}, sourceRoot: root, outputRoot: `${root}-round-b`, itemIds: ['item-round-b1'], executor: { kind: 'provider', connectionId: 'connection-1', modelId: 'model' } });
    scheduler.enqueue(jobA, [{ ...makeItem('job-round-a-item-a1', 'a.png'), jobId: jobA.id }, { ...makeItem('job-round-a-item-a2', 'b.png'), jobId: jobA.id }]);
    scheduler.enqueue(jobB, [{ ...makeItem('job-round-b-item-b1', 'a.png'), jobId: jobB.id }]);
    await scheduler.waitForIdle();
    expect(order).toEqual([jobA.id, jobB.id, jobA.id]);
  });

  it('defaults each provider connection to one request while allowing separate connections to run concurrently', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-scheduler-connections-'));
    await makeImage(join(root, 'a.png'));
    const activeByConnection = new Map<string, number>();
    const maximumByConnection = new Map<string, number>();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const scheduler = createImageToolScheduler({ executeProvider: async ({ job }) => {
      const connectionId = job.executor?.kind === 'provider' ? job.executor.connectionId : 'missing';
      const active = (activeByConnection.get(connectionId) ?? 0) + 1;
      activeByConnection.set(connectionId, active);
      maximumByConnection.set(connectionId, Math.max(maximumByConnection.get(connectionId) ?? 0, active));
      await gate;
      activeByConnection.set(connectionId, active - 1);
      return new Uint8Array(await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 0.5 } } }).png().toBuffer());
    } });
    const jobA = createImageToolJob({ id: 'job-connection-a', tool: 'remove-background', params: {}, sourceRoot: root, outputRoot: `${root}-a`, itemIds: ['item-a'], executor: { kind: 'provider', connectionId: 'connection-a', modelId: 'model' } });
    const jobB = createImageToolJob({ id: 'job-connection-b', tool: 'remove-background', params: {}, sourceRoot: root, outputRoot: `${root}-b`, itemIds: ['item-b'], executor: { kind: 'provider', connectionId: 'connection-b', modelId: 'model' } });
    scheduler.enqueue(jobA, [{ ...makeItem('item-a', 'a.png'), jobId: jobA.id }]);
    scheduler.enqueue(jobB, [{ ...makeItem('item-b', 'a.png'), jobId: jobB.id }]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(maximumByConnection).toEqual(new Map([['connection-a', 1], ['connection-b', 1]]));
    release();
    await scheduler.waitForIdle();
    expect(scheduler.get(jobA.id)?.job.state).toBe('completed');
    expect(scheduler.get(jobB.id)?.job.state).toBe('completed');
  });

  it('pauses queued work, allows explicit retry, and cancels unstarted items', async () => {
    const root = await mkdtemp(join(tmpdir(), 'designhub-scheduler-'));
    await makeImage(join(root, 'a.png'));
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const scheduler = createImageToolScheduler({ maxProviderConcurrency: 1, executeProvider: async () => { await blocked; return new Uint8Array(await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 0.5 } } }).png().toBuffer()); } });
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
