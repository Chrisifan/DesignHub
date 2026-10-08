import type { ImageToolItem, ImageToolJob } from './jobs';

export type ImageToolJobFilter = 'all' | 'active' | 'recent' | 'archived';

export const isImageToolJobActive = (state: ImageToolJob['state']): boolean =>
  state === 'queued' || state === 'running' || state === 'paused' || state === 'unknown';

export const getImageToolJobProgress = (
  items: readonly ImageToolItem[],
): { completed: number; total: number; percent: number } => {
  const completed = items.filter((item) => item.state === 'completed').length;
  return {
    completed,
    total: items.length,
    percent: items.length ? Math.round((completed / items.length) * 100) : 0,
  };
};

const basename = (path: string): string =>
  path.replace(/[\\/]$/u, '').split(/[\\/]/u).pop() || path;

export const getImageToolJobContentName = (
  items: readonly ImageToolItem[],
  fallback: string,
): { display: string; full: string } => {
  const full = [...new Set(items.map((item) => basename(item.relativePath)))].join('、') || fallback;
  const characters = Array.from(full);
  return {
    full,
    display: characters.length > 10 ? characters.slice(0, 7).join('') + '...' : full,
  };
};

export const filterImageToolJobs = <T extends { job: ImageToolJob }>(
  jobs: readonly T[],
  filter: ImageToolJobFilter,
): T[] =>
  jobs.filter(({ job }) =>
    filter === 'active'
      ? isImageToolJobActive(job.state)
      : filter === 'recent'
        ? job.state === 'completed' || job.state === 'failed'
        : filter === 'archived'
          ? job.state === 'cancelled'
          : true,
  );

export const pathConflicts = (source: string, output: string): boolean => {
  const normalize = (value: string): string =>
    value.replaceAll('\\', '/').replace(/\/+$/u, '').toLowerCase();
  const sourcePath = normalize(source);
  const outputPath = normalize(output);
  return Boolean(sourcePath && outputPath) &&
    (sourcePath === outputPath || outputPath.startsWith(sourcePath + '/') || sourcePath.startsWith(outputPath + '/'));
};

export const joinImageToolPath = (root: string, relativePath: string): string =>
  root.replace(/[\\/]$/u, '') + '/' + relativePath.replace(/^[\\/]+/u, '');

export const imageToolFileUrl = (path: string): string =>
  path.startsWith('file://') ? path : encodeURI('file://' + path);

export const imageToolPreviewKey = (jobId: string, itemId: string): string => jobId + ':' + itemId;

export const imageToolPreviewSource = (
  jobId: string,
  item: ImageToolItem,
  previews: Readonly<Record<string, string>>,
  allowFileFallback: boolean,
): string | undefined => {
  if (!item.resultPath) return undefined;
  return previews[imageToolPreviewKey(jobId, item.id)] ??
    (allowFileFallback ? imageToolFileUrl(item.resultPath) : undefined);
};
