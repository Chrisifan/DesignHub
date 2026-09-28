import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateRelativePath, type ImageToolItem, type ImageToolJob } from './jobs';

export type ImageToolJobSnapshot = { job: ImageToolJob; items: ImageToolItem[] };

const safeId = (value: string): boolean => /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value);
const clone = <T>(value: T): T => structuredClone(value);

export const createImageToolJobStore = (root: string) => {
  const directory = join(root, 'image-tool-jobs');
  const pathFor = (id: string): string => {
    if (!safeId(id)) throw new Error('IMAGE_TOOL_JOB_ID_INVALID');
    return join(directory, `${id}.json`);
  };
  const save = async (job: ImageToolJob, items: readonly ImageToolItem[]): Promise<void> => {
    const path = pathFor(job.id);
    if (!safeId(job.id) || items.some((item) => !safeId(item.id) || item.jobId !== job.id || !validateRelativePath(item.relativePath))) throw new Error('IMAGE_TOOL_PATH_INVALID');
    const payload: ImageToolJobSnapshot = { job: clone(job), items: clone([...items]) };
    await mkdir(directory, { recursive: true });
    const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(payload)}\n`, 'utf8');
    await rename(temporary, path);
  };
  const load = async (id: string): Promise<ImageToolJobSnapshot | null> => {
    try {
      const parsed = JSON.parse(await readFile(pathFor(id), 'utf8')) as ImageToolJobSnapshot;
      if (!parsed || !parsed.job || parsed.job.id !== id || !Array.isArray(parsed.items) || parsed.items.some((item) => !validateRelativePath(item.relativePath))) throw new Error('IMAGE_TOOL_JOB_INVALID');
      return clone(parsed);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT') return null;
      throw error;
    }
  };
  return { save, load };
};
