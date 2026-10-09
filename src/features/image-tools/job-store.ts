import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { recoverImageToolSnapshot, validateRelativePath, type ImageToolItem, type ImageToolJob } from './jobs';

export type ImageToolJobSnapshot = { job: ImageToolJob; items: ImageToolItem[] };

const safeId = (value: string): boolean => /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value);
const clone = <T>(value: T): T => structuredClone(value);
const stateValues = new Set(['queued', 'running', 'completed', 'failed', 'cancelled', 'unknown']);
const inside = (parent: string, child: string): boolean => {
  const value = relative(resolve(parent), resolve(child));
  return value === '' || (value !== '..' && !value.startsWith(`..${sep}`) && !isAbsolute(value));
};
const isValidResultPath = (job: ImageToolJob, value: unknown): value is string => typeof value === 'string' && isAbsolute(value) && inside(job.outputRoot, value);
const isValidItem = (job: ImageToolJob, value: unknown): value is ImageToolItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ImageToolItem>;
  return typeof item.id === 'string'
    && safeId(item.id)
    && item.jobId === job.id
    && typeof item.relativePath === 'string'
    && validateRelativePath(item.relativePath)
    && typeof item.state === 'string'
    && stateValues.has(item.state)
    && typeof item.attempt === 'number'
    && Number.isInteger(item.attempt)
    && item.attempt > 0
    && typeof item.updatedAt === 'string'
    && (item.resultBytes === undefined || (typeof item.resultBytes === 'number' && Number.isInteger(item.resultBytes) && item.resultBytes >= 0))
    && (item.resultWidth === undefined || (typeof item.resultWidth === 'number' && Number.isInteger(item.resultWidth) && item.resultWidth > 0))
    && (item.resultHeight === undefined || (typeof item.resultHeight === 'number' && Number.isInteger(item.resultHeight) && item.resultHeight > 0))
    && (item.resultFormat === undefined || typeof item.resultFormat === 'string')
    && (item.resultHasAlpha === undefined || typeof item.resultHasAlpha === 'boolean')
    && (item.providerCost === undefined || item.providerCost === null || (typeof item.providerCost === 'number' && Number.isFinite(item.providerCost)))
    && (item.supportsRemoteCancellation === undefined || typeof item.supportsRemoteCancellation === 'boolean')
    && (item.supportsStatusQuery === undefined || typeof item.supportsStatusQuery === 'boolean')
    && (item.outputRoot === undefined || (typeof item.outputRoot === 'string' && isAbsolute(item.outputRoot) && inside(job.outputRoot, item.outputRoot)))
    && (item.resultPath === undefined || isValidResultPath(job, item.resultPath));
};
const isValidJob = (value: unknown, id: string): value is ImageToolJob => {
  if (!value || typeof value !== 'object') return false;
  const job = value as Partial<ImageToolJob>;
  return job.id === id
    && safeId(id)
    && typeof job.sourceRoot === 'string'
    && job.sourceRoot.length > 0
    && typeof job.outputRoot === 'string'
    && job.outputRoot.length > 0
    && typeof job.tool === 'string'
    && typeof job.state === 'string'
    && stateValues.has(job.state)
    && Array.isArray(job.itemIds)
    && job.itemIds.every((itemId) => typeof itemId === 'string' && safeId(itemId));
};

export const createImageToolJobStore = (root: string) => {
  const directory = join(root, 'image-tool-jobs');
  const pathFor = (id: string): string => {
    if (!safeId(id)) throw new Error('IMAGE_TOOL_JOB_ID_INVALID');
    return join(directory, `${id}.json`);
  };
  const save = async (job: ImageToolJob, items: readonly ImageToolItem[]): Promise<void> => {
    const path = pathFor(job.id);
    if (!safeId(job.id) || items.some((item) => !isValidItem(job, item))) throw new Error('IMAGE_TOOL_PATH_INVALID');
    const payload: ImageToolJobSnapshot = { job: clone(job), items: clone([...items]) };
    await mkdir(directory, { recursive: true });
    const temporary = `${path}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(payload)}\n`, 'utf8');
      await rename(temporary, path);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  };
  const load = async (id: string): Promise<ImageToolJobSnapshot | null> => {
    try {
      const parsed = JSON.parse(await readFile(pathFor(id), 'utf8')) as ImageToolJobSnapshot;
      if (!parsed || !isValidJob(parsed.job, id) || !Array.isArray(parsed.items) || parsed.items.some((item) => !isValidItem(parsed.job, item))) throw new Error('IMAGE_TOOL_JOB_INVALID');
      const migrated = { ...parsed, job: { ...parsed.job, schemaVersion: Math.max(2, parsed.job.schemaVersion ?? 1) } };
      return clone(migrated);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT') return null;
      throw error;
    }
  };
  const list = async (): Promise<ImageToolJobSnapshot[]> => {
    const names = await readdir(directory).catch(() => [] as string[]);
    const ids = names
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
      .filter(safeId)
      .sort();
    const snapshots = await Promise.all(ids.map((id) => load(id)));
    return snapshots.filter((snapshot): snapshot is ImageToolJobSnapshot => Boolean(snapshot));
  };
  const recoverOnStartup = async (now = new Date().toISOString()): Promise<ImageToolJobSnapshot[]> => {
    const snapshots = await list();
    const recovered: ImageToolJobSnapshot[] = [];
    for (const snapshot of snapshots) {
      if (!snapshot.items.some((item) => item.state === 'running')) {
        recovered.push(snapshot);
        continue;
      }
      const next = recoverImageToolSnapshot(snapshot.job, snapshot.items, now);
      await save(next.job, next.items);
      recovered.push(next);
    }
    return recovered;
  };
  return { save, load, list, recoverOnStartup };
};
