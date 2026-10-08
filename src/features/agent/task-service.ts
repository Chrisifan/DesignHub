import type { ChatRequest, ChatResponse, GeneratedImage, VisionRequest } from '../providers/adapter';
import {
  createDesignGenerationSlots,
  designGenerationSlotIds,
  type DesignGenerationSlotId,
  type TaskCandidate,
  type TaskRecord,
} from '../tasks/state';
import type { TaskSource } from '../tasks/state';
import type { TaskRuntime } from '../tasks/runtime';
import type { Region } from '../canvas/selection';
import type { DesignScene } from '../canvas/scene';
import { createScene } from '../canvas/scene';
import type { ImageTool, ToolParams } from '../image-tools/target';
import { analyzePortfolio, type PortfolioImageSource } from './analyze-portfolio';
import { buildDesignContextPrompt, type DesignGenerationContext } from './context';
import {
  buildGenerationVisualManifest,
  buildVisualContextAnalysisInstruction,
  deriveConservativeVisualContextPlan,
  extractAnalysisBrief,
  imageContextLabel,
  mergeVisualContextPlan,
  orderedVisualContextItems,
  parseVisualContextEnvelope,
  type VisualContextItem,
  type VisualContextPlan,
  type VisualContextRole,
} from './visual-context';
import type { ProjectDesign } from '../projects/metadata';
import type { ProjectGenerationRatio } from '../projects/size';
import type { DesignSceneCandidate } from '../composition/design-scene-candidate';
import { classifyTaskErrorCode, failTask, providerFailure } from './task-policy';
import { createImageTaskRecord } from './task-record-factory';
import { createTaskCandidateService } from './task-candidate-service';
import { createTaskRecovery } from './task-recovery';
import { createTaskRuntimeAdapter } from './task-runtime-adapter';

export type ConversationInput = {
  libraryId?: string;
  projectId?: string;
  analysisThreadId?: string;
  conversationParentTaskId?: string;
  referencedAssetIds?: string[];
  source?: TaskSource;
  documentId?: string;
  designerVersionId?: string;
  baseRevisionId?: string | null;
  connectionId: string;
  model?: string;
  message: string;
  attachments?: ConversationImageAttachment[];
};

export type DesignGenerationInput = {
  libraryId: string;
  projectId: string;
  documentId?: string;
  conversationTaskId: string;
  baseRevisionId?: string | null;
  connectionId: string;
  model?: string;
  generationRatio?: ProjectGenerationRatio;
  count?: 1 | 3;
};

export type DesignGenerationSlotRetryInput = {
  libraryId: string;
  taskId: string;
  slotId: DesignGenerationSlotId;
};

export type ConversationImageAttachment = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
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
  maskAssetId?: string;
  mask?: Blob;
  model?: string;
  size?: string;
  tool?: ImageTool;
  toolParams?: ToolParams;
  region?: Region;
  beforeScene?: DesignScene;
  targetLayerId?: string;
  projectDesign?: {
    sourceTaskId: string;
    sourceConversationTaskId?: string;
    width: number;
    height: number;
    title: string;
  };
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
  timeoutMs?: number;
};

export type ConversationTestInput = {
  connectionId: string;
  model?: string;
  timeoutMs?: number;
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
  streamChat?: (request: ChatRequest, signal?: AbortSignal) => AsyncIterable<{ text: string; finishReason?: string | null }>;
  analyzeVision?: (request: VisionRequest, signal?: AbortSignal) => Promise<ChatResponse>;
  generateImage?: (request: { prompt: string; model?: string; size?: string; count?: number; referenceImages?: Blob[] }, signal?: AbortSignal) => Promise<{ images: GeneratedImage[]; cost: number | null }>;
  editImage?: (request: { prompt: string; image: Blob; referenceImages?: Blob[]; mask?: Blob; model?: string; size?: string; tool?: ImageTool; toolParams?: ToolParams; region?: Region }, signal?: AbortSignal) => Promise<{ images: GeneratedImage[]; cost: number | null }>;
};

const runConnectionTest = async <T>(
  timeoutMs: number | undefined,
  request: (signal?: AbortSignal) => Promise<T>,
): Promise<T> => {
  if (timeoutMs === undefined) return request();
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('PROVIDER_TEST_TIMEOUT'));
    }, timeoutMs);
    void request(controller.signal).then(resolve, reject).finally(() => clearTimeout(timer));
  });
};

const buildToolCandidateScene = (scene: DesignScene, sourceAssetId: string, resultAssetId: string, targetLayerId?: string): DesignScene => createScene({
  ...scene,
  id: `${scene.id}-candidate-${resultAssetId}`,
  layers: scene.layers.map((layer) => layer.type === 'image' && (targetLayerId ? layer.id === targetLayerId : layer.assetId === sourceAssetId)
    ? { ...layer, assetId: resultAssetId }
    : layer),
});

export type AgentTaskService = {
  getTask: (taskId: string) => TaskRecord | undefined;
  publishCompositionCandidate: (input: { projectId: string; documentId: string; candidate: DesignSceneCandidate }) => Promise<TaskRecord>;
  resolveCompositionCandidate: (taskId: string, resolution: 'confirmed' | 'discarded') => Promise<TaskRecord>;
  submitConversation: (input: ConversationInput) => Promise<TaskRecord>;
  submitDesignGeneration: (input: DesignGenerationInput) => Promise<TaskRecord>;
  retryDesignGenerationSlot: (input: DesignGenerationSlotRetryInput) => Promise<TaskRecord>;
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
  imageRetryDelayMs?: number;
  persistGeneratedImages?: (input: { projectId: string; images: GeneratedImage[] }) => Promise<string[]>;
  persistProjectDesigns?: (input: { projectId: string; designs: ProjectDesign[] }) => Promise<void>;
  persistDesignerArtwork?: (input: { designerDraftId: string; images: GeneratedImage[] }) => Promise<string[]>;
  loadSourceImage?: (input: { projectId: string; assetId: string }) => Promise<Blob | null>;
  loadMaskImage?: (input: { projectId: string; assetId: string }) => Promise<Blob | null>;
  resolveDesignContext?: (input: { input: ConversationInput; attachmentAssetIds: string[] }) => Promise<DesignGenerationContext>;
  persistConversationAttachments?: (input: { projectId: string; attachments: ConversationImageAttachment[] }) => Promise<string[]>;
  loadContextImage?: (input: { projectId: string; assetId: string }) => Promise<ConversationImageAttachment | null>;
};

const waitForImageRetry = async (delayMs: number, signal: AbortSignal): Promise<void> => {
  if (signal.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
  if (delayMs <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    signal.addEventListener('abort', onAbort, { once: true });
  });
};

const requestWithGatewayTimeoutRetry = async <T>(request: () => Promise<T>, signal: AbortSignal, delayMs: number): Promise<T> => {
  try {
    return await request();
  } catch (error) {
    const failure = providerFailure(error);
    if (failure?.kind !== 'http' || failure.status !== 524 || signal.aborted) throw error;
    await waitForImageRetry(delayMs, signal);
    return request();
  }
};

const taskId = (): string => `conversation-${crypto.randomUUID()}`;
const requestId = (): string => `request-${crypto.randomUUID()}`;
const designTaskId = (): string => `design-generation-${crypto.randomUUID()}`;
const streamedProgressIntervalMs = 80;

const sourceDataValues = (sources: readonly PortfolioImageSource[]): string[] => sources.flatMap((source) => [
  source.description,
  'base64' in source.image ? source.image.base64 : source.image.url,
]).filter((value): value is string => typeof value === 'string' && value.length > 0);

const containsSourceData = (value: unknown, sources: readonly string[]): boolean => {
  if (typeof value === 'string') return sources.some((source) => value.includes(source));
  if (Array.isArray(value)) return value.some((item) => containsSourceData(item, sources));
  return Boolean(value && typeof value === 'object' && Object.values(value).some((item) => containsSourceData(item, sources)));
};

const generationPrompt = (context: DesignGenerationContext, assistantBrief?: string): string => [
  'Generate a polished design draft for the current DesignHub canvas.',
  buildDesignContextPrompt({ ...context, ...(assistantBrief ? { assistantBrief } : {}) }),
  context.designerSnapshot && Object.keys(context.designerSnapshot).length > 0 ? 'The result must follow the designer profile and avoid every negative rule.' : '',
].filter(Boolean).join('\n\n');

const latestGeneratedAssetIds = (tasks: readonly TaskRecord[], input: ConversationInput, analysisThreadId: string): string[] => {
  const latest = tasks
    .filter((candidate) => candidate.capability === 'design-generation'
      && candidate.state === 'completed'
      && candidate.analysisThreadId === analysisThreadId
      && candidate.source?.kind === 'project'
      && candidate.source.id === input.projectId
      && (input.documentId === undefined || candidate.documentId === input.documentId))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id.localeCompare(a.id))[0];
  if (!latest) return [];
  const candidateAssetIds = latest.result?.candidates?.flatMap((candidate) => candidate.assetIds) ?? [];
  return [...new Set(candidateAssetIds.length > 0 ? candidateAssetIds : latest.result?.assetIds ?? [])];
};

const latestConversationTask = (tasks: readonly TaskRecord[]): TaskRecord | undefined => {
  const parentIds = new Set(tasks.flatMap((task) => task.conversationParentTaskId ? [task.conversationParentTaskId] : []));
  return tasks
    .filter((task) => !parentIds.has(task.id))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id.localeCompare(a.id))[0];
};

export const createAgentTaskService = (options: AgentTaskServiceOptions): AgentTaskService => {
  const controllers = new Map<string, AbortController>();
  const generationControllers = new Map<string, Map<DesignGenerationSlotId, AbortController>>();
  const pending = new Set<Promise<unknown>>();
  const runtimeAdapter = createTaskRuntimeAdapter({ runtime: options.runtime, controllers, generationControllers });
  const recovery = createTaskRecovery({ runtime: options.runtime });
  const candidateService = createTaskCandidateService({ runtime: options.runtime });
  const loadVisualBlob = async (projectId: string, item: VisualContextItem): Promise<Blob | null> => {
    const attachment = await options.loadContextImage?.({ projectId, assetId: item.assetId });
    if (attachment) {
      return new Blob([new Uint8Array(attachment.bytes).buffer as ArrayBuffer], { type: attachment.mimeType });
    }
    if (item.roles.includes('edit-target') && options.loadSourceImage) {
      return options.loadSourceImage({ projectId, assetId: item.assetId });
    }
    return null;
  };
  const executeTask = async (task: TaskRecord, input: ConversationInput): Promise<void> => {
    const controller = new AbortController();
    controllers.set(task.id, controller);
    const execution = (async (): Promise<void> => {
      try {
        const adapter = await options.resolveAdapter(input.connectionId);
        const loadAssets = async (assetIds: readonly string[]): Promise<Array<{ assetId: string; attachment: ConversationImageAttachment }>> => {
          if (assetIds.length === 0 || task.source?.kind !== 'project' || !options.loadContextImage) return [];
          const loaded = await Promise.all(assetIds.map(async (assetId) => ({
            assetId,
            attachment: await options.loadContextImage!({ projectId: task.source!.id, assetId }),
          })));
          return loaded.filter((entry): entry is { assetId: string; attachment: ConversationImageAttachment } => Boolean(entry.attachment));
        };
        const imagePart = (attachment: ConversationImageAttachment) => ({
          type: 'image_url' as const,
          image_url: { url: `data:${attachment.mimeType};base64,${Buffer.from(attachment.bytes).toString('base64')}` },
        });
        const imageParts = (
          assetId: string,
          attachment: ConversationImageAttachment,
          roles: VisualContextRole[],
          origin: string,
        ) => [
          { type: 'text' as const, text: imageContextLabel({ assetId, roles: roles.length ? roles : ['visual-reference'], confidence: 0 }, origin) },
          imagePart(attachment),
        ];
        const threadTasks = task.analysisThreadId
          ? options.runtime.list().filter((candidate) => candidate.capability === 'conversation' && candidate.analysisThreadId === task.analysisThreadId && candidate.source?.id === task.source?.id && candidate.documentId === task.documentId && candidate.id !== task.id).sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id))
          : [];
        const currentAssetIds = [...new Set(
          task.contextAssetIds?.length
            ? task.contextAssetIds
            : task.conversationParentTaskId
              ? []
              : task.designContext?.document.currentImageAssetIds ?? [],
        )];
        const parent = task.conversationParentTaskId
          ? options.runtime.get(task.conversationParentTaskId)
          : undefined;
        const knownAssetIds = [...new Set([
          ...(task.designContext?.attachmentAssetIds ?? []),
          ...(task.designContext?.document.currentImageAssetIds ?? []),
          ...threadTasks.flatMap((historicalTask) => historicalTask.contextAssetIds ?? []),
          ...threadTasks.flatMap((historicalTask) => historicalTask.visualContextPlan?.items.map((item) => item.assetId) ?? []),
          ...(parent?.visualContextPlan?.items.map((item) => item.assetId) ?? []),
          ...currentAssetIds,
        ])];
        const messages: ChatRequest['messages'] = [{
          role: 'system',
          content: [
            task.designContext ? buildDesignContextPrompt(task.designContext) : '',
            buildVisualContextAnalysisInstruction({
              knownAssetIds,
              previousPlan: parent?.visualContextPlan,
            }),
          ].filter(Boolean).join('\n\n'),
        }];
        for (const historicalTask of threadTasks) {
          const historicalAttachments = await loadAssets(historicalTask.contextAssetIds ?? []);
          const historicalParts = historicalAttachments.flatMap(({ assetId, attachment }) => imageParts(
            assetId,
            attachment,
            historicalTask.visualContextPlan?.items.find((item) => item.assetId === assetId)?.roles ?? [],
            'conversation-history',
          ));
          messages.push({
            role: 'user',
            content: [{ type: 'text', text: historicalTask.requestText ?? '' }, ...historicalParts],
          });
        }
        const storedAttachments = currentAssetIds.length ? await loadAssets(currentAssetIds) : [];
        const rawAttachments = input.attachments?.length ? input.attachments : [];
        const currentImageParts = storedAttachments.length
          ? storedAttachments.flatMap(({ assetId, attachment }) => imageParts(
              assetId,
              attachment,
              parent?.visualContextPlan?.items.find((item) => item.assetId === assetId)?.roles ?? [],
              'current-turn',
            ))
          : rawAttachments.map(imagePart);
        messages.push({ role: 'user', content: [{ type: 'text', text: input.message }, ...currentImageParts] });
        const request = { messages, ...(task.model ? { model: task.model } : {}) };
        let text = '';
        let cost: number | null = null;
        let streamed = false;
        let lastStreamProgressAt = 0;
        const publishStreamProgress = (force = false): void => {
          if (!text.trim()) return;
          const now = Date.now();
          if (!force && lastStreamProgressAt !== 0 && now - lastStreamProgressAt < streamedProgressIntervalMs) return;
          options.runtime.updateProgress(task.id, text);
          lastStreamProgressAt = now;
        };
        if (adapter.streamChat) {
          streamed = true;
          for await (const event of adapter.streamChat(request, controller.signal)) {
            if (event.text) {
              text += event.text;
              publishStreamProgress();
            }
          }
          publishStreamProgress(true);
        } else {
          const response = await adapter.chat(request, controller.signal);
          text = response.text;
          cost = response.cost;
        }
        if (!text.trim()) throw new Error('EMPTY_PROVIDER_RESPONSE');
        const parsed = parseVisualContextEnvelope(text);
        const conservative = deriveConservativeVisualContextPlan({
          previous: parent?.visualContextPlan,
          initialAttachmentAssetIds: task.designContext?.attachmentAssetIds ?? [],
          currentAssetIds,
          canvasAssetIds: task.designContext?.document.currentImageAssetIds ?? [],
        });
        const visualContextPlan: VisualContextPlan = parsed
          ? mergeVisualContextPlan({
              previous: parent?.visualContextPlan,
              proposed: parsed.visualContextPlan,
              releasedAssetIds: parsed.releasedAssetIds,
              requiredAssetIds: currentAssetIds,
              knownAssetIds,
            })
          : conservative;
        const brief = parsed?.brief ?? extractAnalysisBrief(text) ?? text.trim();
        options.runtime.updateVisualContextPlan(task.id, visualContextPlan);
        if (!streamed || brief !== text) options.runtime.updateProgress(task.id, brief);
        await options.runtime.complete(task.id, { text: brief, cost });
      } catch (error) {
        if (controller.signal.aborted) {
          if (options.runtime.get(task.id)?.cancelRequested) await options.runtime.complete(task.id);
          else await failTask(options.runtime, task.id, new Error('CONVERSATION_ABORTED'));
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
    const task = createImageTaskRecord({
      id: taskId(),
      requestId: requestId(),
      requestText: input.prompt,
      source,
      ...('documentId' in input ? { documentId: input.documentId } : {}),
      ...('baseRevisionId' in input ? { baseRevisionId: input.baseRevisionId } : {}),
      ...('designerVersionId' in input ? { designerVersionId: input.designerVersionId } : {}),
      connectionId: input.connectionId,
      ...('model' in input ? { model: input.model } : {}),
      ...('size' in input ? { size: input.size } : {}),
      ...('count' in input ? { count: input.count } : {}),
      ...('tool' in input ? { tool: input.tool } : {}),
      ...('toolParams' in input ? { toolParams: input.toolParams } : {}),
      ...('region' in input ? { region: input.region } : {}),
      ...('sourceAssetId' in input ? { sourceAssetId: input.sourceAssetId } : {}),
      ...('maskAssetId' in input ? { maskAssetId: input.maskAssetId } : {}),
      ...(capability === 'image-editing' ? {
        hasMask: 'mask' in input ? Boolean(input.mask) || Boolean(input.maskAssetId) : Boolean('maskAssetId' in input && input.maskAssetId),
      } : {}),
      capability,
    });
    return options.runtime.start(task);
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
        const projectDesign = operation === 'edit' && 'projectDesign' in input ? input.projectDesign : undefined;
        const projectId = 'projectId' in input ? input.projectId : undefined;
        const outputImages = projectDesign ? response.images.slice(0, 1) : response.images;
        const assetIds = task.source?.kind === 'designer-draft'
          ? (options.persistDesignerArtwork
            ? await options.persistDesignerArtwork({ designerDraftId: task.source.id, images: outputImages })
            : (() => { throw new Error('DESIGNER_ARTWORK_PERSISTENCE_UNAVAILABLE'); })())
          : (options.persistGeneratedImages && 'projectId' in input
            ? await options.persistGeneratedImages({ projectId: input.projectId, images: outputImages })
            : []);
        if (projectDesign) {
          if (!options.persistProjectDesigns || !projectId) throw new Error('PROJECT_DESIGN_PERSISTENCE_UNAVAILABLE');
          await options.persistProjectDesigns({
            projectId,
            designs: assetIds.map((assetId) => ({
              id: `design-${crypto.randomUUID()}`,
              projectId,
              assetId,
              sourceTaskId: projectDesign.sourceTaskId,
              ...(projectDesign.sourceConversationTaskId ? { sourceConversationTaskId: projectDesign.sourceConversationTaskId } : {}),
              width: projectDesign.width,
              height: projectDesign.height,
              title: projectDesign.title,
              createdAt: new Date().toISOString(),
            })),
          });
        }
        const editInput = operation === 'edit' ? input as ImageEditInput : undefined;
        await options.runtime.complete(task.id, {
          assetIds,
          imageCount: outputImages.length,
          cost: response.cost,
          ...(editInput && task.source?.kind === 'project' && editInput.tool && editInput.sourceAssetId && editInput.beforeScene && assetIds[0]
            ? {
              toolCandidate: {
                taskId: task.id,
                tool: editInput.tool,
                sourceAssetId: editInput.sourceAssetId,
                baseRevisionId: task.baseRevisionId ?? null,
                resultAssetId: assetIds[0],
                beforeScene: editInput.beforeScene,
                candidateScene: buildToolCandidateScene(editInput.beforeScene, editInput.sourceAssetId, assetIds[0], editInput.targetLayerId),
                toolParams: editInput.toolParams,
                providerId: task.providerId,
                model: task.model,
                remoteRequestId: task.remoteRequestId,
              },
            }
            : {}),
          ...(task.source?.kind === 'project' ? {
            candidate: {
              id: `candidate-${task.id}`,
              baseRevisionId: task.baseRevisionId ?? null,
              assetIds: [...assetIds],
              ...(assetIds[0] ? { sceneAssetId: assetIds[0] } : {}),
              ...(task.parentConversationTaskId ? { parentConversationTaskId: task.parentConversationTaskId } : {}),
              ...(task.designerVersionId ? { designerVersionId: task.designerVersionId } : {}),
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
    const existingThreadTasks = input.analysisThreadId
      ? options.runtime.list().filter((candidate) => candidate.capability === 'conversation' && candidate.analysisThreadId === input.analysisThreadId)
      : [];
    const parent = input.conversationParentTaskId
      ? options.runtime.get(input.conversationParentTaskId)
      : latestConversationTask(existingThreadTasks.filter((candidate) => candidate.state === 'completed'));
    if (parent && (parent.source?.kind !== source.kind || parent.source.id !== source.id || (input.documentId && parent.documentId !== input.documentId))) throw new Error('CONVERSATION_CONTEXT_MISMATCH');
    if (parent?.analysisThreadId && input.analysisThreadId && parent.analysisThreadId !== input.analysisThreadId) throw new Error('CONVERSATION_CONTEXT_MISMATCH');
    const analysisThreadId = input.analysisThreadId ?? parent?.analysisThreadId ?? `analysis-${crypto.randomUUID()}`;
    if (options.runtime.list().some((candidate) => candidate.capability === 'conversation' && candidate.analysisThreadId === analysisThreadId && (candidate.state === 'queued' || candidate.state === 'running'))) throw new Error('CONVERSATION_THREAD_BUSY');
    const attachmentAssetIds = source.kind === 'project' && options.persistConversationAttachments && input.attachments?.length
      ? await options.persistConversationAttachments({ projectId: source.id, attachments: input.attachments })
      : [];
    const referencedAssetIds = [...new Set(input.referencedAssetIds ?? [])];
    if (referencedAssetIds.length && options.loadContextImage) {
      const referenced = await Promise.all(referencedAssetIds.map((assetId) => options.loadContextImage!({ projectId: source.id, assetId })));
      if (referenced.some((asset) => !asset)) throw new Error('CONTEXT_ASSET_MISSING');
    }
    const designContext = parent?.designContext
      ? structuredClone(parent.designContext)
      : source.kind === 'project' && options.resolveDesignContext
        ? await options.resolveDesignContext({ input, attachmentAssetIds })
        : undefined;
    const explicitAssetIds = [...new Set([...attachmentAssetIds, ...referencedAssetIds])];
    const inheritedGeneratedAssetIds = parent && explicitAssetIds.length === 0
      ? latestGeneratedAssetIds(options.runtime.list(), input, analysisThreadId)
      : [];
    const contextAssetIds = [...new Set([...explicitAssetIds, ...inheritedGeneratedAssetIds])];
    const task = options.runtime.start({
      id: taskId(),
      requestId: requestId(),
      requestText: input.message.trim(),
      source,
      ...(input.documentId ? { documentId: input.documentId } : {}),
      ...(input.baseRevisionId === undefined ? {} : { baseRevisionId: input.baseRevisionId }),
      ...(input.model?.trim() ? { model: input.model.trim() } : {}),
      analysisThreadId,
      ...(parent ? { conversationParentTaskId: parent.id } : {}),
      ...((input.designerVersionId ?? (designContext?.designerSnapshot?.id as string | undefined)) ? { designerVersionId: input.designerVersionId ?? designContext?.designerSnapshot?.id as string } : {}),
      ...(contextAssetIds.length ? { contextAssetIds } : {}),
      ...(designContext ? { contextVersion: designContext.version, designContext } : {}),
      providerId: input.connectionId,
      capability: 'conversation',
      createdAt: new Date().toISOString(),
    });
    await options.runtime.flush();
    await executeTask(task, input);
    return task;
  };
  const prepareDesignGeneration = async (task: TaskRecord) => {
    const context = task.designContext;
    if (!context || task.source?.kind !== 'project' || !task.providerId) throw new Error('DESIGN_CONTEXT_UNAVAILABLE');
    const adapter = await options.resolveAdapter(task.providerId);
    const plan = task.visualContextPlan ?? deriveConservativeVisualContextPlan({
      previous: undefined,
      initialAttachmentAssetIds: context.attachmentAssetIds,
      currentAssetIds: task.contextAssetIds ?? [],
      canvasAssetIds: context.document.currentImageAssetIds,
    });
    if (plan.clarificationRequired) throw new Error('VISUAL_CONTEXT_CLARIFICATION_REQUIRED');
    const items = orderedVisualContextItems(plan);
    const loaded = await Promise.all(items.map(async (item) => ({
      item,
      image: await loadVisualBlob(task.source!.id, item),
    })));
    if (loaded.some(({ image }) => !image)) throw new Error('CONTEXT_ASSET_MISSING');
    const visualInputs = loaded as Array<{ item: VisualContextItem; image: Blob }>;
    const editTarget = visualInputs.find(({ item }) => item.roles.includes('edit-target'));
    return {
      context,
      adapter,
      editTarget,
      referenceImages: visualInputs.filter((entry) => entry !== editTarget).map(({ image }) => image),
      generationReferenceImages: visualInputs.map(({ image }) => image),
      visualManifest: buildGenerationVisualManifest(items),
    };
  };
  const executeDesignGeneration = async (task: TaskRecord, onlySlots?: readonly DesignGenerationSlotId[]): Promise<void> => {
    const execution = (async (): Promise<void> => {
      const slotIds = onlySlots ?? task.generationSlots?.map((slot) => slot.id) ?? designGenerationSlotIds;
      let prepared: Awaited<ReturnType<typeof prepareDesignGeneration>>;
      try {
        prepared = await prepareDesignGeneration(task);
      } catch (error) {
        const failure = providerFailure(error);
        for (const slotId of slotIds) options.runtime.updateGenerationSlot(task.id, slotId, {
          state: 'failed',
          errorCode: classifyTaskErrorCode(error),
          ...(failure ? { providerFailure: failure } : {}),
        });
        await options.runtime.settleGenerationBatch(task.id);
        return;
      }
      if (options.runtime.get(task.id)?.cancelRequested) {
        for (const slotId of slotIds) options.runtime.updateGenerationSlot(task.id, slotId, {
          state: 'cancelled',
          errorCode: 'CANCELLED',
          providerFailure: { kind: 'cancelled' },
        });
        await options.runtime.settleGenerationBatch(task.id);
        return;
      }
      const controllersForTask = new Map<DesignGenerationSlotId, AbortController>();
      generationControllers.set(task.id, controllersForTask);
      for (const slotId of slotIds) options.runtime.updateGenerationSlot(task.id, slotId, { state: 'running' });
      const requests = slotIds.map(async (slotId) => {
        const slot = options.runtime.get(task.id)?.generationSlots?.find((candidate) => candidate.id === slotId);
        if (!slot) throw new Error('GENERATION_SLOT_NOT_FOUND');
        const controller = new AbortController();
        controllersForTask.set(slotId, controller);
        try {
          const prompt = `${task.requestText ?? generationPrompt(prepared.context, prepared.context.assistantBrief)}\n\n${prepared.visualManifest}\n\nCandidate direction\n${slot.direction}`;
          const size = `${prepared.context.document.width}x${prepared.context.document.height}`;
          const response = await requestWithGatewayTimeoutRetry(async () => prepared.editTarget && prepared.adapter.editImage
            ? prepared.adapter.editImage({ prompt, image: prepared.editTarget.image, ...(task.model ? { model: task.model } : {}), ...(prepared.referenceImages.length ? { referenceImages: prepared.referenceImages } : {}), size }, controller.signal)
            : prepared.adapter.generateImage
              ? prepared.adapter.generateImage({ prompt, ...(task.model ? { model: task.model } : {}), ...(prepared.generationReferenceImages.length ? { referenceImages: prepared.generationReferenceImages } : {}), size, count: 1 }, controller.signal)
              : undefined, controller.signal, options.imageRetryDelayMs ?? 2_000);
          const image = response?.images[0];
          if (!response) throw new Error('IMAGE_CAPABILITY_UNAVAILABLE');
          if (!image) throw new Error('IMAGE_RESULT_EMPTY');
          const assetIds = options.persistGeneratedImages
            ? await options.persistGeneratedImages({ projectId: task.source!.id, images: [image] })
            : [];
          const assetId = assetIds[0];
          if (!assetId) throw new Error('IMAGE_ASSET_PERSIST_FAILED');
          if (options.persistProjectDesigns) {
            await options.persistProjectDesigns({
              projectId: task.source!.id,
              designs: [{
                id: `design-${crypto.randomUUID()}`,
                projectId: task.source!.id,
                assetId,
                sourceTaskId: task.id,
                ...(task.parentConversationTaskId ? { sourceConversationTaskId: task.parentConversationTaskId } : {}),
                width: prepared.context.document.width,
                height: prepared.context.document.height,
                title: `Design ${new Date().toLocaleString()}`,
                createdAt: new Date().toISOString(),
              }],
            });
          }
          const candidate: TaskCandidate = {
            id: `candidate-${task.id}-${slotId}`,
            baseRevisionId: task.baseRevisionId ?? null,
            assetIds: [assetId],
            sceneAssetId: assetId,
            ...(task.parentConversationTaskId ? { parentConversationTaskId: task.parentConversationTaskId } : {}),
            ...(task.analysisThreadId ? { analysisThreadId: task.analysisThreadId } : {}),
            ...(task.designerVersionId ? { designerVersionId: task.designerVersionId } : {}),
            createdAt: new Date().toISOString(),
          };
          options.runtime.updateGenerationSlot(task.id, slotId, {
            state: 'completed',
            assetId,
            candidateId: candidate.id,
            cost: response.cost,
          }, candidate);
        } catch (error) {
          const failure = providerFailure(error);
          options.runtime.updateGenerationSlot(task.id, slotId, controller.signal.aborted
            ? { state: 'cancelled', errorCode: 'CANCELLED', providerFailure: { kind: 'cancelled' } }
            : { state: 'failed', errorCode: classifyTaskErrorCode(error), ...(failure ? { providerFailure: failure } : {}) });
        } finally {
          controllersForTask.delete(slotId);
        }
      });
      await Promise.allSettled(requests);
      await options.runtime.settleGenerationBatch(task.id);
    })().finally(() => { generationControllers.delete(task.id); });
    pending.add(execution);
    void execution.finally(() => pending.delete(execution));
  };
  const submitDesignGeneration = async (input: DesignGenerationInput): Promise<TaskRecord> => {
    if (!input.projectId.trim() || !input.conversationTaskId.trim() || !input.connectionId.trim()) throw new Error('DESIGN_GENERATION_BINDING_REQUIRED');
    const parent = options.runtime.get(input.conversationTaskId);
    if (!parent || parent.state !== 'completed' || parent.capability !== 'conversation' || parent.source?.kind !== 'project' || parent.source.id !== input.projectId || (input.documentId && parent.documentId && parent.documentId !== input.documentId)) throw new Error('CONVERSATION_CONTEXT_REQUIRED');
    if (parent.analysisThreadId) {
      const latest = latestConversationTask(options.runtime.list().filter((candidate) => candidate.capability === 'conversation' && candidate.analysisThreadId === parent.analysisThreadId && candidate.source?.id === input.projectId && (!input.documentId || candidate.documentId === input.documentId) && candidate.state === 'completed'));
      if (!latest || latest.id !== parent.id) throw new Error('CONVERSATION_CONTEXT_STALE');
    }
    if (!parent.designContext) throw new Error('DESIGN_CONTEXT_UNAVAILABLE');
    if (parent.designContext.libraryId !== input.libraryId) throw new Error('WORKSPACE_CONTEXT_MISMATCH');
    const visualContextPlan = parent.visualContextPlan ?? deriveConservativeVisualContextPlan({
      previous: undefined,
      initialAttachmentAssetIds: parent.designContext.attachmentAssetIds,
      currentAssetIds: parent.contextAssetIds ?? [],
      canvasAssetIds: parent.designContext.document.currentImageAssetIds,
    });
    if (visualContextPlan.clarificationRequired) throw new Error('VISUAL_CONTEXT_CLARIFICATION_REQUIRED');
    const orderedItems = orderedVisualContextItems(visualContextPlan);
    const plannedAssets = await Promise.all(orderedItems.map((item) => loadVisualBlob(input.projectId, item)));
    if (plannedAssets.some((asset) => !asset)) throw new Error('CONTEXT_ASSET_MISSING');
    const threadCandidates = parent.analysisThreadId
      ? options.runtime.list().filter((candidate) => candidate.capability === 'conversation' && candidate.analysisThreadId === parent.analysisThreadId && candidate.source?.id === input.projectId && (!input.documentId || candidate.documentId === input.documentId))
      : [parent];
    const threadAssetIds = orderedItems.map((item) => item.assetId);
    const threadUserMessage = threadCandidates
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id))
      .map((candidate) => candidate.requestText?.trim())
      .filter((message): message is string => Boolean(message))
      .join('\n');
    const task = options.runtime.start({
      id: designTaskId(),
      requestId: requestId(),
      requestText: generationPrompt({ ...parent.designContext, ...(threadUserMessage ? { userMessage: threadUserMessage } : {}) }, parent.result?.text),
      source: { kind: 'project', id: input.projectId },
      ...(input.documentId ? { documentId: input.documentId } : {}),
      baseRevisionId: input.baseRevisionId ?? parent.baseRevisionId ?? null,
      generationSlots: createDesignGenerationSlots(input.count ?? 3),
      count: input.count ?? 3,
      ...(parent.designerVersionId ? { designerVersionId: parent.designerVersionId } : {}),
      ...(threadAssetIds.length ? { contextAssetIds: threadAssetIds } : {}),
      visualContextPlan: structuredClone(visualContextPlan),
      ...(parent.analysisThreadId ? { analysisThreadId: parent.analysisThreadId } : {}),
      ...(parent.contextVersion ? { contextVersion: parent.contextVersion } : {}),
      designContext: {
        ...parent.designContext,
        ...(threadUserMessage ? { userMessage: threadUserMessage } : {}),
        ...(parent.result?.text ? { assistantBrief: parent.result.text } : {}),
      },
      parentConversationTaskId: input.conversationTaskId,
      ...(input.model?.trim() ? { model: input.model.trim() } : {}),
      providerId: input.connectionId,
      capability: 'design-generation',
      createdAt: new Date().toISOString(),
    });
    await options.runtime.flush();
    await executeDesignGeneration(task);
    return task;
  };
  const retryDesignGenerationSlot = async (input: DesignGenerationSlotRetryInput): Promise<TaskRecord> => {
    const task = options.runtime.get(input.taskId);
    if (!task || task.capability !== 'design-generation' || !task.generationSlots || task.source?.kind !== 'project') throw new Error('DESIGN_GENERATION_TASK_REQUIRED');
    if (task.designContext?.libraryId !== input.libraryId) throw new Error('WORKSPACE_CONTEXT_MISMATCH');
    const slot = task.generationSlots.find((candidate) => candidate.id === input.slotId);
    if (!slot) throw new Error('GENERATION_SLOT_NOT_FOUND');
    const retryPlan = task.visualContextPlan ?? deriveConservativeVisualContextPlan({
      previous: undefined,
      initialAttachmentAssetIds: task.designContext?.attachmentAssetIds ?? [],
      currentAssetIds: task.contextAssetIds ?? [],
      canvasAssetIds: task.designContext?.document.currentImageAssetIds ?? [],
    });
    if (retryPlan.clarificationRequired) throw new Error('VISUAL_CONTEXT_CLARIFICATION_REQUIRED');
    const retryAssets = await Promise.all(orderedVisualContextItems(retryPlan).map((item) => loadVisualBlob(task.source!.id, item)));
    if (retryAssets.some((asset) => !asset)) throw new Error('CONTEXT_ASSET_MISSING');
    const retried = options.runtime.retryGenerationSlot(task.id, input.slotId);
    if (!retried) throw new Error('GENERATION_SLOT_NOT_FOUND');
    await executeDesignGeneration(retried, [input.slotId]);
    return retried;
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
    await options.runtime.flush();
    await executeImageTask(task, input, 'generate');
    return task;
  };
  const submitDesignerArtworkGeneration = async (input: DesignerArtworkGenerationInput): Promise<TaskRecord> => {
    if (input.source.kind !== 'designer-draft') throw new Error('DESIGNER_ARTWORK_BINDING_REQUIRED');
    const task = createImageTask(input, 'image-generation');
    await options.runtime.flush();
    await executeImageTask(task, input, 'generate');
    return task;
  };
  const submitImageEdit = async (input: ImageEditInput): Promise<TaskRecord> => {
    const mask = input.mask ?? (input.maskAssetId && options.loadMaskImage
      ? await options.loadMaskImage({ projectId: input.projectId, assetId: input.maskAssetId })
      : undefined);
    if (input.maskAssetId && !mask) throw new Error('MASK_ASSET_MISSING');
    const task = createImageTask(input, 'image-editing');
    await options.runtime.flush();
    await executeImageTask(task, mask && !input.mask ? { ...input, mask } : input, 'edit');
    return task;
  };
  const testConversation = async (input: ConversationTestInput): Promise<ConversationTestResult> => {
    if (!input.connectionId.trim()) throw new Error('CONVERSATION_TEST_BINDING_REQUIRED');
    const adapter = await options.resolveAdapter(input.connectionId);
    const request = {
      messages: [{ role: 'user' as const, content: 'Reply with OK.' }],
      ...(input.model?.trim() ? { model: input.model.trim() } : {}),
    };
    const response = await runConnectionTest(input.timeoutMs, (signal) => signal
      ? adapter.chat(request, signal)
      : adapter.chat(request));
    if (!response.text.trim()) throw new Error('CONVERSATION_TEST_RESULT_EMPTY');
    return { cost: response.cost };
  };
  const testImageGeneration = async (input: ImageGenerationTestInput): Promise<ImageGenerationTestResult> => {
    if (!input.connectionId.trim() || !input.prompt.trim()) throw new Error('IMAGE_TEST_BINDING_REQUIRED');
    const adapter = await options.resolveAdapter(input.connectionId);
    if (!adapter.generateImage) throw new Error('IMAGE_CAPABILITY_UNAVAILABLE');
    const request = {
      prompt: input.prompt.trim(),
      ...(input.model?.trim() ? { model: input.model.trim() } : {}),
      ...(input.size?.trim() ? { size: input.size.trim() } : {}),
      count: 1,
    };
    const response = await runConnectionTest(input.timeoutMs, (signal) => signal
      ? adapter.generateImage!(request, signal)
      : adapter.generateImage!(request));
    const image = response.images[0];
    if (!image) throw new Error('IMAGE_RESULT_EMPTY');
    return { image, cost: response.cost };
  };
  const retry = async (taskId: string): Promise<TaskRecord | undefined> => {
    const previous = options.runtime.get(taskId);
    if (!previous?.requestText || !previous.providerId || !previous.source?.id) return undefined;
    if (previous.capability === 'image-editing') {
      if (previous.source.kind !== 'project' || !previous.documentId || !previous.sourceAssetId || !options.loadSourceImage) return undefined;
      if (previous.hasMask && (!previous.maskAssetId || !options.loadMaskImage)) return undefined;
      const image = await options.loadSourceImage({ projectId: previous.source.id, assetId: previous.sourceAssetId });
      if (!image) return undefined;
      const mask = previous.maskAssetId && options.loadMaskImage
        ? await options.loadMaskImage({ projectId: previous.source.id, assetId: previous.maskAssetId })
        : undefined;
      if (previous.hasMask && !mask) return undefined;
      const retried = await recovery.retryExplicitly(taskId);
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
        ...(previous.maskAssetId ? { maskAssetId: previous.maskAssetId } : {}),
        ...(mask ? { mask } : {}),
        ...(previous.model ? { model: previous.model } : {}),
        ...(previous.size ? { size: previous.size } : {}),
        ...(previous.tool ? { tool: previous.tool } : {}),
        ...(previous.toolParams ? { toolParams: { ...previous.toolParams } } : {}),
        ...(previous.region ? { region: { ...previous.region } } : {}),
      }, 'edit');
      return running;
    }
    if (previous.capability === 'image-generation') {
      if (previous.source.kind !== 'project' && previous.source.kind !== 'designer-draft') return undefined;
      if (previous.source.kind === 'project' && !previous.documentId) return undefined;
      const retried = await recovery.retryExplicitly(taskId);
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
    if (previous.capability === 'design-generation') {
      if (!previous.parentConversationTaskId || previous.source.kind !== 'project') return undefined;
      if (previous.generationSlots?.length) return undefined;
      const retried = await recovery.retryExplicitly(taskId);
      if (!retried) return undefined;
      const running = options.runtime.run(retried.id);
      if (!running) return undefined;
      await executeDesignGeneration(running);
      return running;
    }
    if (previous.capability !== 'conversation') return undefined;
    const retried = await recovery.retryExplicitly(taskId);
    if (!retried) return undefined;
    const running = options.runtime.run(retried.id);
    if (!running) return undefined;
    await executeTask(running, {
      libraryId: previous.designContext?.libraryId ?? '',
      source: previous.source,
      ...(previous.documentId ? { documentId: previous.documentId } : {}),
      ...(previous.baseRevisionId === undefined ? {} : { baseRevisionId: previous.baseRevisionId }),
      ...(previous.designerVersionId ? { designerVersionId: previous.designerVersionId } : {}),
      connectionId: previous.providerId,
      ...(previous.model ? { model: previous.model } : {}),
      message: previous.requestText,
      ...(previous.analysisThreadId ? { analysisThreadId: previous.analysisThreadId } : {}),
      ...(previous.conversationParentTaskId ? { conversationParentTaskId: previous.conversationParentTaskId } : {}),
    });
    return running;
  };
  const cancel = (taskIdValue: string): TaskRecord | undefined => {
    return runtimeAdapter.cancel(taskIdValue);
  };
  const flush = async (): Promise<void> => {
    await Promise.all([...pending]);
    await options.runtime.flush();
  };
  const getTask = (taskIdValue: string): TaskRecord | undefined => options.runtime.get(taskIdValue);
  const publishCompositionCandidate: AgentTaskService['publishCompositionCandidate'] = (input) => candidateService.publishCompositionCandidate(input);
  const resolveCompositionCandidate: AgentTaskService['resolveCompositionCandidate'] = (taskIdValue, resolution) => candidateService.resolveCompositionCandidate(taskIdValue, resolution);
  return { getTask, publishCompositionCandidate, resolveCompositionCandidate, submitConversation, submitDesignGeneration, retryDesignGenerationSlot, submitPortfolioAnalysis, submitImageGeneration, submitDesignerArtworkGeneration, submitImageEdit, testConversation, testImageGeneration, retry, cancel, flush };
};
