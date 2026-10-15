import { createAgentTaskService } from '../agent/task-service';
import { createTaskRuntime } from '../tasks/runtime';
import type { TaskRecord } from '../tasks/state';
import { createOpenAICompatibleAdapter } from './adapter';
import type { ImageTransport } from './config';

export type LiveProviderSmokeOptions = {
  baseUrl: string;
  apiKey: string;
  models: {
    conversation: string;
    vision: string;
    imageGeneration: string;
    imageEditing: string;
  };
  imageTransport?: ImageTransport;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  timeoutMs?: number;
  now?: () => number;
};

export type LiveProviderSmokeCheck = {
  name: 'conversation' | 'vision-analysis' | 'image-generation' | 'image-editing';
  status: 'passed' | 'failed';
  elapsedMs: number;
  cost: number | 'unavailable';
  remoteCancellation: 'available' | 'unavailable';
  quality: 'pending-human-review';
  error?: string;
};

export type LiveProviderSmokeReport = {
  status: 'passed' | 'failed';
  checks: LiveProviderSmokeCheck[];
};

const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';

const safeTaskError = (task: TaskRecord): string => task.errorCode
  ?? task.providerFailure?.providerCode
  ?? task.providerFailure?.kind
  ?? 'LIVE_PROVIDER_CHECK_FAILED';

export const runLiveProviderSmoke = async (options: LiveProviderSmokeOptions): Promise<LiveProviderSmokeReport> => {
  const now = options.now ?? Date.now;
  const timeoutMs = Number.isFinite(options.timeoutMs) && Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 30_000;
  const adapter = createOpenAICompatibleAdapter({
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    imageTransport: options.imageTransport ?? 'images',
    models: {
      conversation: options.models.conversation,
      'vision-analysis': options.models.vision,
      'image-generation': options.models.imageGeneration,
      'image-editing': options.models.imageEditing,
    },
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  let assetSequence = 0;
  const service = createAgentTaskService({
    runtime: createTaskRuntime(),
    resolveAdapter: async () => adapter,
    persistGeneratedImages: async ({ images }) => images.map(() => `live-smoke-asset-${assetSequence += 1}`),
  });

  const check = async (
    name: LiveProviderSmokeCheck['name'],
    submit: () => Promise<TaskRecord>,
  ): Promise<LiveProviderSmokeCheck> => {
    const started = now();
    try {
      const submitted = await submit();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const completed = await Promise.race([
        service.flush().then(() => true),
        new Promise<false>((resolve) => {
          timeout = setTimeout(() => resolve(false), timeoutMs);
        }),
      ]);
      if (timeout) clearTimeout(timeout);
      if (!completed) {
        service.cancel(submitted.id);
        return {
          name,
          status: 'failed',
          elapsedMs: Math.max(0, now() - started),
          cost: 'unavailable',
          remoteCancellation: 'unavailable',
          quality: 'pending-human-review',
          error: 'TIMEOUT',
        };
      }
      const task = service.getTask(submitted.id) ?? submitted;
      const passed = task.state === 'completed';
      return {
        name,
        status: passed ? 'passed' : 'failed',
        elapsedMs: Math.max(0, now() - started),
        cost: typeof task.result?.cost === 'number' ? task.result.cost : 'unavailable',
        remoteCancellation: task.remoteSupportsCancellation === true ? 'available' : 'unavailable',
        quality: 'pending-human-review',
        ...(passed ? {} : { error: safeTaskError(task) }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LIVE_PROVIDER_CHECK_FAILED';
      return {
        name,
        status: 'failed',
        elapsedMs: Math.max(0, now() - started),
        cost: 'unavailable',
        remoteCancellation: 'unavailable',
        quality: 'pending-human-review',
        error: message.includes(options.apiKey) ? message.replaceAll(options.apiKey, '[redacted]') : message,
      };
    }
  };

  const image = new Blob([Buffer.from(samplePngBase64, 'base64')], { type: 'image/png' });
  const checks: LiveProviderSmokeCheck[] = [];
  checks.push(await check('conversation', () => service.submitConversation({
    source: { kind: 'creation-draft', id: 'live-smoke-conversation' },
    connectionId: 'openai-compatible',
    model: options.models.conversation,
    message: 'Reply with the word ok.',
  })));
  checks.push(await check('vision-analysis', () => service.submitPortfolioAnalysis({
    source: { kind: 'designer-draft', id: 'live-smoke-designer' },
    connectionId: 'openai-compatible',
    sources: [{ id: 'authorized-fixed-sample', description: 'Authorized fixed one-pixel image.', image: { base64: samplePngBase64, mimeType: 'image/png' } }],
    rightsConfirmed: true,
  })));
  checks.push(await check('image-generation', () => service.submitImageGeneration({
    projectId: 'live-smoke-project',
    connectionId: 'openai-compatible',
    model: options.models.imageGeneration,
    prompt: 'Create a minimal solid black square.',
    size: '1024x1024',
    count: 1,
  })));
  checks.push(await check('image-editing', () => service.submitImageEdit({
    projectId: 'live-smoke-project',
    connectionId: 'openai-compatible',
    model: options.models.imageEditing,
    prompt: 'Remove the background while preserving the subject.',
    image,
    tool: 'remove-background',
    toolParams: { edgeRefinement: 50 },
  })));

  return { status: checks.every((item) => item.status === 'passed') ? 'passed' : 'failed', checks };
};
