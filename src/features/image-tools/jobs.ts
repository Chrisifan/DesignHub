import type { ImageTool, ToolParams } from './target';
export type { ToolParams } from './target';

/** Tools exposed by the file-oriented batch workbench. Canvas-only tools stay in ImageTool. */
export const batchImageTools = ['remove-background', 'upscale', 'resize', 'format-convert'] as const;
export type BatchImageTool = (typeof batchImageTools)[number];
export type ImageToolJobTool = ImageTool | BatchImageTool;

export type ToolExecutor =
  | { kind: 'provider'; connectionId: string; modelId: string; supportsRemoteCancellation?: boolean; supportsStatusQuery?: boolean }
  | { kind: 'local'; engine: 'image-codec' };

export type ImageToolJobState = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'unknown';
export type ImageToolItemState = Exclude<ImageToolJobState, 'paused'>;

export type ImageToolJob = {
  id: string;
  tool: ImageToolJobTool;
  params: ToolParams;
  sourceRoot: string;
  outputRoot: string;
  state: ImageToolJobState;
  itemIds: string[];
  /** New jobs should persist this identity; it is optional for old snapshots. */
  libraryId?: string;
  executor?: ToolExecutor;
  schemaVersion?: number;
  createdAt: string;
  updatedAt: string;
};

export type ImageToolItem = {
  id: string;
  jobId: string;
  relativePath: string;
  state: ImageToolItemState;
  attempt: number;
  resultPath?: string;
  errorCode?: string;
  remoteRequestId?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
};

const controlCharacters = /[\u0000-\u001F\u007F]/u;
const reservedDeviceName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;

/** Relative paths are persisted, so reject ambiguous or escaping forms up front. */
export const validateRelativePath = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0 || controlCharacters.test(value)) return false;
  if (value.startsWith('/') || value.startsWith('\\') || /^[A-Za-z]:[\\/]/u.test(value)) return false;
  const normalized = value.replaceAll('\\', '/');
  const parts = normalized.split('/');
  return parts.every((part) => part.length > 0 && part !== '.' && part !== '..' && !reservedDeviceName.test(part));
};

export const createImageToolJob = (input: Omit<ImageToolJob, 'state' | 'createdAt' | 'updatedAt'> & Partial<Pick<ImageToolJob, 'createdAt' | 'updatedAt'>>): ImageToolJob => {
  if (!input.id.trim() || !input.sourceRoot.trim() || !input.outputRoot.trim() || input.sourceRoot === input.outputRoot) throw new Error('IMAGE_TOOL_JOB_ROOTS_INVALID');
  const canonical = (value: string): string => value.replaceAll('\\', '/').replace(/\/{2,}/gu, '/').replace(/\/$/u, '');
  const sourceRoot = canonical(input.sourceRoot);
  const outputRoot = canonical(input.outputRoot);
  if (sourceRoot === outputRoot || outputRoot.startsWith(`${sourceRoot}/`) || sourceRoot.startsWith(`${outputRoot}/`)) throw new Error('IMAGE_TOOL_JOB_ROOTS_INVALID');
  const now = new Date().toISOString();
  return { ...input, schemaVersion: input.schemaVersion ?? 1, state: 'queued', createdAt: input.createdAt ?? now, updatedAt: input.updatedAt ?? now };
};

export const isBatchImageTool = (tool: ImageToolJobTool): tool is BatchImageTool => (batchImageTools as readonly string[]).includes(tool);

export const defaultBatchExecutor = (tool: ImageToolJobTool): ToolExecutor =>
  tool === 'resize' || tool === 'format-convert'
    ? { kind: 'local', engine: 'image-codec' }
    : { kind: 'provider', connectionId: '', modelId: '' };

export const recoverImageToolSnapshot = (job: ImageToolJob, items: readonly ImageToolItem[], now = new Date().toISOString()): { job: ImageToolJob; items: ImageToolItem[] } => {
  const recovered = items.map((item) => item.state === 'running' ? { ...item, state: 'unknown' as const, errorCode: 'RESULT_UNKNOWN_AFTER_RESTART', updatedAt: now } : { ...item });
  return { job: { ...job, state: aggregateImageToolJobState(recovered), updatedAt: now }, items: recovered };
};

export const aggregateImageToolJobState = (items: readonly ImageToolItem[]): ImageToolJobState => {
  if (items.length === 0) return 'queued';
  if (items.some((item) => item.state === 'running')) return 'running';
  if (items.some((item) => item.state === 'unknown')) return 'unknown';
  if (items.some((item) => item.state === 'queued')) return 'queued';
  if (items.every((item) => item.state === 'cancelled')) return 'cancelled';
  if (items.some((item) => item.state === 'failed')) return 'failed';
  return 'completed';
};

export const canRetryImageToolItem = (item: ImageToolItem): boolean => item.state === 'failed' || item.state === 'cancelled' || item.state === 'unknown';

export const retryImageToolItem = (item: ImageToolItem, now = new Date().toISOString()): ImageToolItem => {
  if (!canRetryImageToolItem(item)) throw new Error('IMAGE_TOOL_ITEM_NOT_RETRYABLE');
  return { ...item, state: 'queued', attempt: item.attempt + 1, errorCode: undefined, resultPath: undefined, updatedAt: now };
};
