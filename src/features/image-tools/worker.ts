import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { defaultBatchExecutor, isBatchImageTool, type ImageToolItem, type ImageToolJob, type ToolExecutor } from './jobs';
import { transformImageBytes } from './local-codec';
import { inspectImageBytes, publishImageResult, type PublishedImage } from './publisher';

export type ProviderBatchRequest = {
  job: ImageToolJob;
  item: ImageToolItem;
  sourceBytes: Uint8Array;
  signal: AbortSignal;
};
export type ProviderBatchResponse = Uint8Array | { bytes: Uint8Array; remoteRequestId?: string; supportsRemoteCancellation?: boolean };
export type BatchWorkerDeps = {
  executeProvider?: (request: ProviderBatchRequest) => Promise<ProviderBatchResponse>;
  /** Aliases keep the worker usable by provider adapters and test fakes. */
  providerExecutor?: (request: ProviderBatchRequest) => Promise<ProviderBatchResponse>;
  execute?: (request: ProviderBatchRequest) => Promise<ProviderBatchResponse>;
  publish?: (input: { outputRoot: string; relativePath: string; bytes: Uint8Array }) => Promise<PublishedImage>;
  now?: () => string;
};
export type BatchWorkerResult = { item: ImageToolItem; published?: PublishedImage };

const providerTools = new Set(['remove-background', 'upscale']);
const localTools = new Set(['resize', 'format-convert']);
const isAbortError = (error: unknown): boolean => typeof error === 'object' && error !== null && ('name' in error && (error as { name?: string }).name === 'AbortError' || 'message' in error && (error as { message?: string }).message === 'ABORT_ERR');
const errorCode = (error: unknown): string => typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string' && (error as { message: string }).message ? (error as { message: string }).message : 'IMAGE_TOOL_ITEM_FAILED';
const outputRelativePath = (relativePath: string, job: ImageToolJob): string => {
  if (job.tool !== 'resize' && job.tool !== 'format-convert') return relativePath;
  const sourceExtension = extname(relativePath).toLowerCase();
  const inferredFormat = sourceExtension === '.jpg' || sourceExtension === '.jpeg' ? 'jpeg' : sourceExtension === '.webp' ? 'webp' : 'png';
  const requestedFormat = typeof job.params.format === 'string' ? job.params.format : inferredFormat;
  const extension = extname(relativePath);
  const format = requestedFormat === 'jpeg' ? 'jpg' : requestedFormat;
  return `${relativePath.slice(0, relativePath.length - extension.length)}.${format}`;
};
const executorFor = (job: ImageToolJob): ToolExecutor => job.executor ?? defaultBatchExecutor(job.tool);

/** Processes one item and atomically publishes a validated result. */
export const processImageToolItem = async (job: ImageToolJob, item: ImageToolItem, deps: BatchWorkerDeps = {}, signal = new AbortController().signal): Promise<BatchWorkerResult> => {
  if (!isBatchImageTool(job.tool) || (!providerTools.has(job.tool) && !localTools.has(job.tool))) throw new Error('BATCH_TOOL_UNSUPPORTED');
  const now = deps.now ?? (() => new Date().toISOString());
  const sourceBytes = new Uint8Array(await readFile(join(job.sourceRoot, item.relativePath)));
  if (signal.aborted) throw new DOMException('The operation was aborted', 'AbortError');
  let bytes: Uint8Array;
  let remoteRequestId: string | undefined;
  let remoteCancellationSupported = false;
  const executor = executorFor(job);
  if (executor.kind === 'local') {
    if (!localTools.has(job.tool)) throw new Error('EXECUTOR_TOOL_MISMATCH');
    if (job.tool === 'format-convert' && typeof job.params.format !== 'string') throw new Error('OUTPUT_FORMAT_REQUIRED');
    const sourceExtension = extname(item.relativePath).toLowerCase();
    const inferredFormat = sourceExtension === '.jpg' || sourceExtension === '.jpeg' ? 'jpeg' : sourceExtension === '.webp' ? 'webp' : 'png';
    const requestedFormat = job.params.format;
    const format = requestedFormat === 'png' || requestedFormat === 'jpeg' || requestedFormat === 'webp' ? requestedFormat : inferredFormat;
    bytes = await transformImageBytes(sourceBytes, job.tool as 'resize' | 'format-convert', { ...job.params, format });
  } else {
    if (!providerTools.has(job.tool) || !executor.connectionId) throw new Error('CONNECTION_REQUIRED');
    const executeProvider = deps.executeProvider ?? deps.providerExecutor ?? deps.execute;
    if (!executeProvider) throw new Error('PROVIDER_EXECUTOR_UNAVAILABLE');
    const response = await executeProvider({ job, item, sourceBytes, signal });
    if (response instanceof Uint8Array) bytes = response;
    else { bytes = response.bytes; remoteRequestId = response.remoteRequestId; remoteCancellationSupported = response.supportsRemoteCancellation ?? executor.supportsRemoteCancellation === true; }
  }
  if (signal.aborted) {
    if (executor.kind === 'provider' && !remoteCancellationSupported) throw new Error('RESULT_UNKNOWN_AFTER_CANCEL');
    throw new DOMException('The operation was aborted', 'AbortError');
  }
  const metadata = await inspectImageBytes(bytes);
  if (job.tool === 'remove-background' && !metadata.hasAlpha) throw new Error('TRANSPARENCY_REQUIRED');
  const publish = deps.publish ?? ((input: { outputRoot: string; relativePath: string; bytes: Uint8Array }) => publishImageResult(input));
  const published = await publish({ outputRoot: job.outputRoot, relativePath: outputRelativePath(item.relativePath, job), bytes });
  return {
    published,
    item: {
      ...item,
      state: 'completed',
      resultPath: published.path,
      remoteRequestId: remoteRequestId ?? item.remoteRequestId,
      completedAt: now(),
      updatedAt: now(),
      errorCode: undefined,
    },
  };
};

export const failureItem = (item: ImageToolItem, error: unknown, now = new Date().toISOString()): ImageToolItem => ({
  ...item,
  state: isAbortError(error) ? 'cancelled' : errorCode(error) === 'RESULT_UNKNOWN_AFTER_CANCEL' || errorCode(error) === 'RESULT_UNKNOWN_AFTER_RESTART' ? 'unknown' : 'failed',
  errorCode: errorCode(error),
  updatedAt: now,
});

export const unknownItem = (item: ImageToolItem, now = new Date().toISOString()): ImageToolItem => ({ ...item, state: 'unknown', errorCode: 'RESULT_UNKNOWN_AFTER_RESTART', updatedAt: now });

export const createImageToolWorker = (deps: BatchWorkerDeps = {}) => ({
  process: (job: ImageToolJob, item: ImageToolItem, signal?: AbortSignal) => processImageToolItem(job, item, deps, signal),
});

export const createBatchWorker = createImageToolWorker;
