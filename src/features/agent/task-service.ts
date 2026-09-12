import type { ChatRequest, ChatResponse, GeneratedImage } from '../providers/adapter';
import type { TaskRecord } from '../tasks/state';
import type { TaskSource } from '../tasks/state';
import type { TaskRuntime } from '../tasks/runtime';
import type { Region } from '../canvas/selection';
import type { ImageTool } from '../image-tools/target';
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
  region?: Region;
};

export type PortfolioAnalysisInput = {
  source: { kind: 'designer-draft'; id: string };
  connectionId: string;
  sources: PortfolioImageSource[];
};

type ConversationAdapter = {
  chat: (request: ChatRequest, signal?: AbortSignal) => Promise<ChatResponse>;
  analyzeVision?: (request: { prompt: string; image: { url: string } | { base64: string; mimeType?: string } }, signal?: AbortSignal) => Promise<ChatResponse>;
  generateImage?: (request: { prompt: string; model?: string; size?: string; count?: number }, signal?: AbortSignal) => Promise<{ images: GeneratedImage[]; cost: number | null }>;
  editImage?: (request: { prompt: string; image: Blob; mask?: Blob; model?: string; size?: string; tool?: ImageTool; region?: Region }, signal?: AbortSignal) => Promise<{ images: GeneratedImage[]; cost: number | null }>;
};

export type AgentTaskService = {
  submitConversation: (input: ConversationInput) => Promise<TaskRecord>;
  submitPortfolioAnalysis: (input: PortfolioAnalysisInput) => Promise<TaskRecord>;
  submitImageGeneration: (input: ImageGenerationInput) => Promise<TaskRecord>;
  submitImageEdit: (input: ImageEditInput) => Promise<TaskRecord>;
  retry: (taskId: string) => Promise<TaskRecord | undefined>;
  cancel: (taskId: string) => TaskRecord | undefined;
  flush: () => Promise<void>;
};

export type AgentTaskServiceOptions = {
  runtime: TaskRuntime;
  resolveAdapter: (connectionId: string) => Promise<ConversationAdapter>;
  persistGeneratedImages?: (input: { projectId: string; images: GeneratedImage[] }) => Promise<string[]>;
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
          await options.runtime.fail(task.id, errorCode(error));
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
        await options.runtime.complete(task.id, {
          text: JSON.stringify({ candidates: analysis.candidates }),
          cost: analysis.cost,
        });
      } catch (error) {
        if (controller.signal.aborted) await options.runtime.complete(task.id);
        else await options.runtime.fail(task.id, errorCode(error));
      } finally {
        controllers.delete(task.id);
      }
    })();
    pending.add(execution);
    void execution.finally(() => pending.delete(execution));
  };
  const createImageTask = (input: ImageGenerationInput | ImageEditInput, capability: 'image-generation' | 'image-editing'): TaskRecord => {
    if (!input.projectId.trim() || !input.documentId.trim() || !input.connectionId.trim() || !input.prompt.trim()) throw new Error('IMAGE_TASK_BINDING_REQUIRED');
    return options.runtime.start({
      id: taskId(),
      requestId: requestId(),
      requestText: input.prompt.trim(),
      source: { kind: 'project', id: input.projectId.trim() },
      documentId: input.documentId.trim(),
      baseRevisionId: input.baseRevisionId ?? null,
      ...(input.designerVersionId ? { designerVersionId: input.designerVersionId } : {}),
      ...('model' in input && input.model ? { model: input.model } : {}),
      ...('size' in input && input.size ? { size: input.size } : {}),
      ...('count' in input && input.count === undefined ? {} : 'count' in input ? { count: input.count } : {}),
      ...('tool' in input && input.tool ? { tool: input.tool } : {}),
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
  const executeImageTask = async (task: TaskRecord, input: ImageGenerationInput | ImageEditInput, operation: 'generate' | 'edit'): Promise<void> => {
    const controller = new AbortController();
    controllers.set(task.id, controller);
    const execution = (async (): Promise<void> => {
      try {
        const adapter = await options.resolveAdapter(input.connectionId);
        const response = operation === 'generate'
          ? (adapter.generateImage ? await adapter.generateImage({ prompt: input.prompt.trim(), ...('model' in input && input.model ? { model: input.model } : {}), ...('size' in input && input.size ? { size: input.size } : {}), ...('count' in input && input.count === undefined ? {} : 'count' in input ? { count: input.count } : {}) }, controller.signal) : undefined)
          : (adapter.editImage ? await adapter.editImage({ prompt: input.prompt.trim(), image: (input as ImageEditInput).image, ...('mask' in input && input.mask ? { mask: input.mask } : {}), ...('model' in input && input.model ? { model: input.model } : {}), ...('size' in input && input.size ? { size: input.size } : {}), ...('tool' in input && input.tool ? { tool: input.tool } : {}), ...('region' in input && input.region ? { region: input.region } : {}) }, controller.signal) : undefined);
        if (!response) throw new Error('IMAGE_CAPABILITY_UNAVAILABLE');
        if (response.images.length === 0) throw new Error('IMAGE_RESULT_EMPTY');
        const assetIds = options.persistGeneratedImages ? await options.persistGeneratedImages({ projectId: input.projectId, images: response.images }) : [];
        await options.runtime.complete(task.id, {
          assetIds,
          imageCount: response.images.length,
          cost: response.cost,
          candidate: {
            id: `candidate-${task.id}`,
            baseRevisionId: task.baseRevisionId ?? null,
            assetIds: [...assetIds],
            ...(assetIds[0] ? { sceneAssetId: assetIds[0] } : {}),
            createdAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        if (controller.signal.aborted) await options.runtime.complete(task.id);
        else await options.runtime.fail(task.id, errorCode(error));
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
    if (input.source.kind !== 'designer-draft' || !input.source.id.trim() || !input.connectionId.trim() || input.sources.length === 0) throw new Error('PORTFOLIO_TASK_BINDING_REQUIRED');
    const task = options.runtime.start({
      id: taskId(),
      requestId: requestId(),
      requestText: `Portfolio analysis: ${input.sources.map((source) => source.id).join(', ')}`,
      source: { kind: 'designer-draft', id: input.source.id.trim() },
      providerId: input.connectionId.trim(),
      capability: 'vision-analysis',
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
  const submitImageEdit = async (input: ImageEditInput): Promise<TaskRecord> => {
    const task = createImageTask(input, 'image-editing');
    await executeImageTask(task, input, 'edit');
    return task;
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
      }, 'edit');
      return running;
    }
    if (previous.capability === 'image-generation') {
      if (previous.source.kind !== 'project' || !previous.documentId) return undefined;
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
        ...(previous.model ? { model: previous.model } : {}),
        ...(previous.size ? { size: previous.size } : {}),
        ...(previous.count === undefined ? {} : { count: previous.count }),
      }, 'generate');
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
  return { submitConversation, submitPortfolioAnalysis, submitImageGeneration, submitImageEdit, retry, cancel, flush };
};
