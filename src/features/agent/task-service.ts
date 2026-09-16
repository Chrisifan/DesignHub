import type { ChatRequest, ChatResponse, GeneratedImage, VisionRequest } from '../providers/adapter';
import { isSafeProviderCode, type TaskProviderFailure, type TaskRecord } from '../tasks/state';
import type { TaskSource } from '../tasks/state';
import type { TaskRuntime } from '../tasks/runtime';
import type { Region } from '../canvas/selection';
import { validateToolParams, type ImageTool, type ToolParams } from '../image-tools/target';
import { analyzePortfolio, type PortfolioImageSource } from './analyze-portfolio';

export type ConversationInput = {
  projectId?: string;
  source?: TaskSource;
  documentId?: string;
  designerVersionId?: string;
  baseRevisionId?: string | null;
  connectionId: string;
  message: string;
};

export type ImageGenerationInput = {
  projectId: string;
  documentId: string;
  baseRevisionId?: string | null;
  designerVersionId?: string;
  connectionId: string;
  prompt: string;
  model?: string;
  size?: string;
  count?: number;
};

export type DesignerArtworkGenerationInput = {
  source: { kind: 'designer-draft'; id: string };
  connectionId: string;
  prompt: string;
  model?: string;
  size?: string;
  count?: number;
};

export type ImageEditInput = {
  projectId: string;
  documentId: string;
  baseRevisionId?: string | null;
  designerVersionId?: string;
  connectionId: string;
  prompt: string;
  image: Blob;
  sourceAssetId?: string;
  mask?: Blob;
  model?: string;
  size?: string;
  tool?: ImageTool;
  toolParams?: ToolParams;
  region?: Region;
};

export type PortfolioAnalysisInput = {
  source: { kind: 'designer-draft'; id: string };
  connectionId: string;
  sources: PortfolioImageSource[];
  rightsConfirmed: boolean;
};

export type ImageGenerationTestInput = {
  connectionId: string;
  prompt: string;
  model?: string;
  size?: string;
};

export type ConversationTestInput = {
  connectionId: string;
  model?: string;
};

export type ConversationTestResult = {
  cost: number | null;
};

export type ImageGenerationTestResult = {
  image: GeneratedImage;
  cost: number | null;
};

type ConversationAdapter = {
  chat: (request: ChatRequest, signal?: AbortSignal) => Promise<ChatResponse>;
  analyzeVision?: (request: VisionRequest, signal?: AbortSignal) => Promise<ChatResponse>;
  generateImage?: (request: { prompt: string; model?: string; size?: string; count?: number }, signal?: AbortSignal) => Promise<{ images: GeneratedImage[]; cost: number | null }>;
  editImage?: (request: { prompt: string; image: Blob; mask?: Blob; model?: string; size?: string; tool?: ImageTool; toolParams?: ToolParams; region?: Region }, signal?: AbortSignal) => Promise<{ images: GeneratedImage[]; cost: number | null }>;
};

export type AgentTaskService = {
  submitConversation: (input: ConversationInput) => Promise<TaskRecord>;
  submitPortfolioAnalysis: (input: PortfolioAnalysisInput) => Promise<TaskRecord>;
  submitImageGeneration: (input: ImageGenerationInput) => Promise<TaskRecord>;
  submitDesignerArtworkGeneration: (input: DesignerArtworkGenerationInput) => Promise<TaskRecord>;
  submitImageEdit: (input: ImageEditInput) => Promise<TaskRecord>;
  testConversation: (input: ConversationTestInput) => Promise<ConversationTestResult>;
  testImageGeneration: (input: ImageGenerationTestInput) => Promise<ImageGenerationTestResult>;
  retry: (taskId: string) => Promise<TaskRecord | undefined>;
  cancel: (taskId: string) => TaskRecord | undefined;
  flush: () => Promise<void>;
};

export type AgentTaskServiceOptions = {
  runtime: TaskRuntime;
  resolveAdapter: (connectionId: string) => Promise<ConversationAdapter>;
  persistGeneratedImages?: (input: { projectId: string; images: GeneratedImage[] }) => Promise<string[]>;
  persistDesignerArtwork?: (input: { designerDraftId: string; images: GeneratedImage[] }) => Promise<string[]>;
  loadSourceImage?: (input: { projectId: string; assetId: string }) => Promise<Blob | null>;
};

const taskId = (): string => `conversation-${crypto.randomUUID()}`;
const requestId = (): string => `request-${crypto.randomUUID()}`;
const errorCode = (error: unknown): string => {
  if (error && typeof error === 'object' && 'kind' in error && typeof error.kind === 'string') return error.kind;
  if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'CANCELLED';
  if (error instanceof Error && /^[A-Z][A-Z0-9_]{2,63}$/u.test(error.message)) return error.message;
  return 'PROVIDER_REQUEST_FAILED';
};

const providerFailure = (error: unknown): TaskProviderFailure | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as Record<string, unknown>;
  const kind = value.kind;
  if (kind !== 'http' && kind !== 'rate_limited' && kind !== 'invalid_response' && kind !== 'cancelled') return undefined;
  const status = typeof value.status === 'number' && Number.isInteger(value.status) && value.status >= 100 && value.status <= 599
    ? value.status : undefined;
  const providerCode = isSafeProviderCode(value.providerCode) ? value.providerCode : undefined;
  const retryAfterSeconds = typeof value.retryAfterSeconds === 'number' && Number.isFinite(value.retryAfterSeconds)
    && value.retryAfterSeconds >= 0 && value.retryAfterSeconds <= 86_400 ? Math.ceil(value.retryAfterSeconds) : undefined;
  return {
    kind,
    ...(status === undefined ? {} : { status }),
    ...(providerCode === undefined ? {} : { providerCode }),
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  };
};

const failTask = async (runtime: TaskRuntime, taskIdValue: string, error: unknown): Promise<void> => {
  const details = providerFailure(error);
  await runtime.fail(taskIdValue, errorCode(error), details);
};

const sourceDataValues = (sources: readonly PortfolioImageSource[]): string[] => sources.flatMap((source) => [
  source.description,
  'base64' in source.image ? source.image.base64 : source.image.url,
]).filter((value): value is string => typeof value === 'string' && value.length > 0);

const containsSourceData = (value: unknown, sources: readonly string[]): boolean => {
  if (typeof value === 'string') return sources.some((source) => value.includes(source));
  if (Array.isArray(value)) return value.some((item) => containsSourceData(item, sources));
  return Boolean(value && typeof value === 'object' && Object.values(value).some((item) => containsSourceData(item, sources)));
};

export const createAgentTaskService = (options: AgentTaskServiceOptions): AgentTaskService => {
  const controllers = new Map<string, AbortController>();
  const pending = new Set<Promise<unknown>>();
  const executeTask = async (task: TaskRecord, input: ConversationInput): Promise<void> => {
    const controller = new AbortController();
    controllers.set(task.id, controller);
    const execution = (async (): Promise<void> => {
      try {
        const adapter = await options.resolveAdapter(input.connectionId);
        const response = await adapter.chat({ messages: [{ role: 'user', content: input.message }] }, controller.signal);
        await options.runtime.complete(task.id, { text: response.text, cost: response.cost });
      } catch (error) {
        if (controller.signal.aborted) {
          await options.runtime.complete(task.id);
        } else {
          await failTask(options.runtime, task.id, error);
        }
      } finally {
        controllers.delete(task.id);
      }
    })();
    pending.add(execution);
    void execution.finally(() => pending.delete(execution));
  };
  const executePortfolioTask = async (task: TaskRecord, input: PortfolioAnalysisInput): Promise<void> => {
    const controller = new AbortController();
    controllers.set(task.id, controller);
    const execution = (async (): Promise<void> => {
      try {
        const adapter = await options.resolveAdapter(input.connectionId);
        const analysis = await analyzePortfolio({
          designerDraftId: input.source.id,
          connectionId: input.connectionId,
          sources: input.sources,
          adapter: adapter.analyzeVision ? { analyzeVision: adapter.analyzeVision } : undefined,
          signal: controller.signal,
        });
        if (containsSourceData(analysis.candidates, sourceDataValues(input.sources))) throw new Error('PORTFOLIO_RESPONSE_SOURCE_DATA');
        await options.runtime.complete(task.id, {
          text: JSON.stringify({ candidates: analysis.candidates }),
          cost: analysis.cost,
        });
      } catch (error) {
        if (controller.signal.aborted) await options.runtime.complete(task.id);
        else await failTask(options.runtime, task.id, error);
      } finally {
        controllers.delete(task.id);
      }
    })();
    pending.add(execution);
    void execution.finally(() => pending.delete(execution));
  };
  const createImageTask = (input: ImageGenerationInput | ImageEditInput | DesignerArtworkGenerationInput, capability: 'image-generation' | 'image-editing'): TaskRecord => {
    const source = 'source' in input ? input.source : { kind: 'project' as const, id: input.projectId };
    const documentId = 'documentId' in input ? input.documentId : undefined;
    if (!source.id.trim() || !input.connectionId.trim() || !input.prompt.trim()
      || (capability === 'image-editing' && (!documentId || source.kind !== 'project'))
      || (source.kind === 'project' && !documentId)) throw new Error('IMAGE_TASK_BINDING_REQUIRED');
    if ('tool' in input && (input.tool
      ? (!input.toolParams || !validateToolParams(input.tool, input.toolParams).ok)
      : input.toolParams !== undefined)) throw new Error('INVALID_PARAMS');
    return options.runtime.start({
      id: taskId(),
      requestId: requestId(),
      requestText: input.prompt.trim(),
      source: { kind: source.kind, id: source.id.trim() },
      ...(documentId ? {
        documentId: documentId.trim(),
        baseRevisionId: 'baseRevisionId' in input ? input.baseRevisionId ?? null : null,
      } : {}),
      ...('designerVersionId' in input && input.designerVersionId ? { designerVersionId: input.designerVersionId } : {}),
      ...('model' in input && input.model ? { model: input.model } : {}),
      ...('size' in input && input.size ? { size: input.size } : {}),
      ...('count' in input && input.count === undefined ? {} : 'count' in input ? { count: input.count } : {}),
      ...('tool' in input && input.tool ? { tool: input.tool } : {}),
      ...('tool' in input && input.toolParams ? { toolParams: { ...input.toolParams } } : {}),
      ...('region' in input && input.region ? { region: { ...input.region } } : {}),
      ...('sourceAssetId' in input && input.sourceAssetId ? { sourceAssetId: input.sourceAssetId } : {}),
      ...(capability === 'image-editing'
        ? { hasMask: 'mask' in input ? Boolean(input.mask) : false }
        : {}),
      providerId: input.connectionId.trim(),
      capability,
      createdAt: new Date().toISOString(),
    });
  };
  const executeImageTask = async (task: TaskRecord, input: ImageGenerationInput | ImageEditInput | DesignerArtworkGenerationInput, operation: 'generate' | 'edit'): Promise<void> => {
    const controller = new AbortController();
    controllers.set(task.id, controller);
    const execution = (async (): Promise<void> => {
      try {
        const adapter = await options.resolveAdapter(input.connectionId);
        const response = operation === 'generate'
          ? (adapter.generateImage ? await adapter.generateImage({ prompt: input.prompt.trim(), ...('model' in input && input.model ? { model: input.model } : {}), ...('size' in input && input.size ? { size: input.size } : {}), ...('count' in input && input.count === undefined ? {} : 'count' in input ? { count: input.count } : {}) }, controller.signal) : undefined)
          : (adapter.editImage ? await adapter.editImage({ prompt: input.prompt.trim(), image: (input as ImageEditInput).image, ...('mask' in input && input.mask ? { mask: input.mask } : {}), ...('model' in input && input.model ? { model: input.model } : {}), ...('size' in input && input.size ? { size: input.size } : {}), ...('tool' in input && input.tool ? { tool: input.tool } : {}), ...('toolParams' in input && input.toolParams ? { toolParams: { ...input.toolParams } } : {}), ...('region' in input && input.region ? { region: input.region } : {}) }, controller.signal) : undefined);
        if (!response) throw new Error('IMAGE_CAPABILITY_UNAVAILABLE');
        if (response.images.length === 0) throw new Error('IMAGE_RESULT_EMPTY');
        const assetIds = task.source?.kind === 'designer-draft'
          ? (options.persistDesignerArtwork
            ? await options.persistDesignerArtwork({ designerDraftId: task.source.id, images: response.images })
            : (() => { throw new Error('DESIGNER_ARTWORK_PERSISTENCE_UNAVAILABLE'); })())
          : (options.persistGeneratedImages && 'projectId' in input
            ? await options.persistGeneratedImages({ projectId: input.projectId, images: response.images })
            : []);
        await options.runtime.complete(task.id, {
          assetIds,
          imageCount: response.images.length,
          cost: response.cost,
          ...(task.source?.kind === 'project' ? {
            candidate: {
              id: `candidate-${task.id}`,
              baseRevisionId: task.baseRevisionId ?? null,
              assetIds: [...assetIds],
              ...(assetIds[0] ? { sceneAssetId: assetIds[0] } : {}),
              createdAt: new Date().toISOString(),
            },
          } : {}),
        });
      } catch (error) {
        if (controller.signal.aborted) await options.runtime.complete(task.id);
        else await failTask(options.runtime, task.id, error);
      } finally { controllers.delete(task.id); }
    })();
    pending.add(execution);
    void execution.finally(() => pending.delete(execution));
  };
  const submitConversation = async (input: ConversationInput): Promise<TaskRecord> => {
    const source = input.source ?? (input.projectId?.trim() ? { kind: 'project' as const, id: input.projectId.trim() } : undefined);
    if (!source?.id.trim() || !input.connectionId.trim() || !input.message.trim()) throw new Error('CONVERSATION_BINDING_REQUIRED');
    const task = options.runtime.start({
      id: taskId(),
      requestId: requestId(),
      requestText: input.message.trim(),
      source,
      ...(input.documentId ? { documentId: input.documentId } : {}),
      ...(input.baseRevisionId === undefined ? {} : { baseRevisionId: input.baseRevisionId }),
      ...(input.designerVersionId ? { designerVersionId: input.designerVersionId } : {}),
      providerId: input.connectionId,
      capability: 'conversation',
      createdAt: new Date().toISOString(),
    });
    await executeTask(task, input);
    return task;
  };
  const submitPortfolioAnalysis = async (input: PortfolioAnalysisInput): Promise<TaskRecord> => {
    if (input.source.kind !== 'designer-draft' || !input.source.id.trim() || !input.connectionId.trim() || input.sources.length === 0 || input.rightsConfirmed !== true) throw new Error('PORTFOLIO_TASK_BINDING_REQUIRED');
    const task = options.runtime.start({
      id: taskId(),
      requestId: requestId(),
      requestText: `Portfolio analysis: ${input.sources.map((source) => source.id).join(', ')}`,
      source: { kind: 'designer-draft', id: input.source.id.trim() },
      providerId: input.connectionId.trim(),
      capability: 'vision-analysis',
      portfolio: {
        sourceIds: input.sources.map((source) => source.id),
        rightsConfirmed: true,
      },
      createdAt: new Date().toISOString(),
    });
    await executePortfolioTask(task, input);
    return task;
  };
  const submitImageGeneration = async (input: ImageGenerationInput): Promise<TaskRecord> => {
    const task = createImageTask(input, 'image-generation');
    await executeImageTask(task, input, 'generate');
    return task;
  };
  const submitDesignerArtworkGeneration = async (input: DesignerArtworkGenerationInput): Promise<TaskRecord> => {
    if (input.source.kind !== 'designer-draft') throw new Error('DESIGNER_ARTWORK_BINDING_REQUIRED');
    const task = createImageTask(input, 'image-generation');
    await executeImageTask(task, input, 'generate');
    return task;
  };
  const submitImageEdit = async (input: ImageEditInput): Promise<TaskRecord> => {
    const task = createImageTask(input, 'image-editing');
    await executeImageTask(task, input, 'edit');
    return task;
  };
  const testConversation = async (input: ConversationTestInput): Promise<ConversationTestResult> => {
    if (!input.connectionId.trim()) throw new Error('CONVERSATION_TEST_BINDING_REQUIRED');
    const adapter = await options.resolveAdapter(input.connectionId);
    const response = await adapter.chat({
      messages: [{ role: 'user', content: 'Reply with OK.' }],
      ...(input.model?.trim() ? { model: input.model.trim() } : {}),
    });
    if (!response.text.trim()) throw new Error('CONVERSATION_TEST_RESULT_EMPTY');
    return { cost: response.cost };
  };
  const testImageGeneration = async (input: ImageGenerationTestInput): Promise<ImageGenerationTestResult> => {
    if (!input.connectionId.trim() || !input.prompt.trim()) throw new Error('IMAGE_TEST_BINDING_REQUIRED');
    const adapter = await options.resolveAdapter(input.connectionId);
    if (!adapter.generateImage) throw new Error('IMAGE_CAPABILITY_UNAVAILABLE');
    const response = await adapter.generateImage({
      prompt: input.prompt.trim(),
      ...(input.model?.trim() ? { model: input.model.trim() } : {}),
      ...(input.size?.trim() ? { size: input.size.trim() } : {}),
      count: 1,
    });
    const image = response.images[0];
    if (!image) throw new Error('IMAGE_RESULT_EMPTY');
    return { image, cost: response.cost };
  };
  const retry = async (taskId: string): Promise<TaskRecord | undefined> => {
    const previous = options.runtime.get(taskId);
    if (!previous?.requestText || !previous.providerId || !previous.source?.id) return undefined;
    if (previous.capability === 'image-editing') {
      if (previous.source.kind !== 'project' || !previous.documentId || !previous.sourceAssetId || previous.region || previous.hasMask !== false || !options.loadSourceImage) return undefined;
      const image = await options.loadSourceImage({ projectId: previous.source.id, assetId: previous.sourceAssetId });
      if (!image) return undefined;
      const retried = options.runtime.retry(taskId);
      if (!retried) return undefined;
      const running = options.runtime.run(retried.id);
      if (!running) return undefined;
      await executeImageTask(running, {
        projectId: previous.source.id,
        documentId: previous.documentId,
        baseRevisionId: previous.baseRevisionId ?? null,
        ...(previous.designerVersionId ? { designerVersionId: previous.designerVersionId } : {}),
        connectionId: previous.providerId,
        prompt: previous.requestText,
        image,
        sourceAssetId: previous.sourceAssetId,
        ...(previous.model ? { model: previous.model } : {}),
        ...(previous.size ? { size: previous.size } : {}),
        ...(previous.tool ? { tool: previous.tool } : {}),
        ...(previous.toolParams ? { toolParams: { ...previous.toolParams } } : {}),
      }, 'edit');
      return running;
    }
    if (previous.capability === 'image-generation') {
      if (previous.source.kind !== 'project' && previous.source.kind !== 'designer-draft') return undefined;
      if (previous.source.kind === 'project' && !previous.documentId) return undefined;
      const retried = options.runtime.retry(taskId);
      if (!retried) return undefined;
      const running = options.runtime.run(retried.id);
      if (!running) return undefined;
      const input: ImageGenerationInput | DesignerArtworkGenerationInput = previous.source.kind === 'designer-draft'
        ? {
          source: { kind: 'designer-draft', id: previous.source.id },
          connectionId: previous.providerId,
          prompt: previous.requestText,
          ...(previous.model ? { model: previous.model } : {}),
          ...(previous.size ? { size: previous.size } : {}),
          ...(previous.count === undefined ? {} : { count: previous.count }),
        }
        : {
          projectId: previous.source.id,
          documentId: previous.documentId as string,
          baseRevisionId: previous.baseRevisionId ?? null,
          ...(previous.designerVersionId ? { designerVersionId: previous.designerVersionId } : {}),
          connectionId: previous.providerId,
          prompt: previous.requestText,
          ...(previous.model ? { model: previous.model } : {}),
          ...(previous.size ? { size: previous.size } : {}),
          ...(previous.count === undefined ? {} : { count: previous.count }),
        };
      await executeImageTask(running, input, 'generate');
      return running;
    }
    if (previous.capability !== 'conversation') return undefined;
    const retried = options.runtime.retry(taskId);
    if (!retried) return undefined;
    const running = options.runtime.run(retried.id);
    if (!running) return undefined;
    await executeTask(running, {
      source: previous.source,
      ...(previous.documentId ? { documentId: previous.documentId } : {}),
      ...(previous.baseRevisionId === undefined ? {} : { baseRevisionId: previous.baseRevisionId }),
      ...(previous.designerVersionId ? { designerVersionId: previous.designerVersionId } : {}),
      connectionId: previous.providerId,
      message: previous.requestText,
    });
    return running;
  };
  const cancel = (taskIdValue: string): TaskRecord | undefined => {
    controllers.get(taskIdValue)?.abort();
    return options.runtime.cancel(taskIdValue);
  };
  const flush = async (): Promise<void> => {
    await Promise.all([...pending]);
    await options.runtime.flush();
  };
  return { submitConversation, submitPortfolioAnalysis, submitImageGeneration, submitDesignerArtworkGeneration, submitImageEdit, testConversation, testImageGeneration, retry, cancel, flush };
};
