import type { ChatRequest, ChatResponse, GeneratedImage } from '../providers/adapter';
import type { TaskRecord } from '../tasks/state';
import type { TaskSource } from '../tasks/state';
import type { TaskRuntime } from '../tasks/runtime';

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
  mask?: Blob;
  model?: string;
  size?: string;
};

type ConversationAdapter = {
  chat: (request: ChatRequest, signal?: AbortSignal) => Promise<ChatResponse>;
  generateImage?: (request: { prompt: string; model?: string; size?: string; count?: number }, signal?: AbortSignal) => Promise<{ images: GeneratedImage[]; cost: number | null }>;
  editImage?: (request: { prompt: string; image: Blob; mask?: Blob; model?: string; size?: string }, signal?: AbortSignal) => Promise<{ images: GeneratedImage[]; cost: number | null }>;
};

export type AgentTaskService = {
  submitConversation: (input: ConversationInput) => Promise<TaskRecord>;
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
};

const taskId = (): string => `conversation-${crypto.randomUUID()}`;
const requestId = (): string => `request-${crypto.randomUUID()}`;
const errorCode = (error: unknown): string => {
  if (error && typeof error === 'object' && 'kind' in error && typeof error.kind === 'string') return error.kind;
  if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'CANCELLED';
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
        await options.runtime.complete(task.id, { text: response.text });
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
          : (adapter.editImage ? await adapter.editImage({ prompt: input.prompt.trim(), image: (input as ImageEditInput).image, ...('mask' in input && input.mask ? { mask: input.mask } : {}), ...('model' in input && input.model ? { model: input.model } : {}), ...('size' in input && input.size ? { size: input.size } : {}) }, controller.signal) : undefined);
        if (!response) throw new Error('IMAGE_CAPABILITY_UNAVAILABLE');
        const assetIds = options.persistGeneratedImages ? await options.persistGeneratedImages({ projectId: input.projectId, images: response.images }) : [];
        await options.runtime.complete(task.id, { assetIds, imageCount: response.images.length, cost: response.cost });
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
  return { submitConversation, submitImageGeneration, submitImageEdit, retry, cancel, flush };
};
