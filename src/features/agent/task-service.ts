import type { ChatRequest, ChatResponse } from '../providers/adapter';
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

type ConversationAdapter = {
  chat: (request: ChatRequest, signal?: AbortSignal) => Promise<ChatResponse>;
};

export type AgentTaskService = {
  submitConversation: (input: ConversationInput) => Promise<TaskRecord>;
  retry: (taskId: string) => Promise<TaskRecord | undefined>;
  cancel: (taskId: string) => TaskRecord | undefined;
  flush: () => Promise<void>;
};

export type AgentTaskServiceOptions = {
  runtime: TaskRuntime;
  resolveAdapter: (connectionId: string) => Promise<ConversationAdapter>;
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
  return { submitConversation, retry, cancel, flush };
};
