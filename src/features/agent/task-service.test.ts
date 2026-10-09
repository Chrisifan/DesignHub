import { expect, it, vi } from 'vitest';

import { createTaskRuntime, type TaskRuntime } from '../tasks/runtime';
import type { TaskRecord } from '../tasks/state';
import { createAgentTaskService } from './task-service';
import { createScene } from '../canvas/scene';
import type { ChatRequest } from '../providers/adapter';
import type { VisualContextPlan } from './visual-context';

type ImageResponse = { images: Array<{ base64: string; mimeType?: string }>; cost: number | null };

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const completedConversationWithPlan = async (
  runtime: TaskRuntime,
  visualContextPlan: VisualContextPlan,
): Promise<TaskRecord> => {
  const task = runtime.start({
    id: 'conversation-planned',
    requestId: 'request-planned',
    requestText: '保持原图细节，修改当前稿背景',
    source: { kind: 'project', id: 'project-1' },
    documentId: 'document-1',
    providerId: 'provider-1',
    capability: 'conversation',
    analysisThreadId: 'analysis-1',
    contextAssetIds: visualContextPlan.items.map((item) => item.assetId),
    visualContextPlan,
    designContext: {
      version: 1,
      libraryId: 'workspace-1',
      projectId: 'project-1',
      documentId: 'document-1',
      brief: 'Campaign poster',
      document: { width: 100, height: 100, currentImageAssetIds: [] },
      attachmentAssetIds: ['asset-original', 'asset-style'],
      userMessage: 'first',
      baseRevisionId: null,
    },
    createdAt: '2026-09-29T00:00:00.000Z',
  });
  await runtime.complete(task.id, { text: '保持原图细节，修改当前稿背景。' });
  return runtime.get(task.id)!;
};

const completePortfolioCandidate = (name: { zh: string; en: string }, overrides: Record<string, unknown> = {}) => ({
  name,
  signature: { zh: '视觉分析草稿', en: 'Visual analysis draft' },
  summary: { zh: '克制且有层次的版式', en: 'Restrained, layered layout' },
  principle: { zh: '保留清晰的信息层级', en: 'Keep a clear information hierarchy' },
  tags: [{ zh: '编辑感', en: 'Editorial' }],
  styleDna: {
    palette: ['#F5F0E6', '#242424'],
    typography: { zh: '高对比衬线体', en: 'High-contrast serif' },
    composition: { zh: '对称网格', en: 'Symmetrical grid' },
    texture: { zh: '粗粝纸张', en: 'Rough paper' },
  },
  negativeRules: [{ zh: '避免霓虹渐变', en: 'Avoid neon gradients' }],
  ...overrides,
});

it('runs a conversation task and stores the assistant result', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: '好的，已整理简报', cost: null }) }),
  });
  const task = await service.submitConversation({
    projectId: 'project-1', documentId: 'document-1', designerVersionId: 'designer-v1',
    connectionId: 'provider-1', message: '整理春季市集简报',
  });
  await service.flush();
  expect(runtime.get(task.id)).toMatchObject({ state: 'completed', result: { text: '好的，已整理简报' } });
});

it('persists and sends the selected conversation model', async () => {
  const runtime = createTaskRuntime();
  const chat = vi.fn(async () => ({ text: '好的', cost: null }));
  const service = createAgentTaskService({ runtime, resolveAdapter: async () => ({ chat }) });

  const task = await service.submitConversation({
    projectId: 'project-1',
    connectionId: 'provider-1',
    model: 'chat-model',
    message: '整理这份简报',
  });
  await service.flush();

  expect(chat).toHaveBeenCalledWith(expect.objectContaining({ model: 'chat-model' }), expect.any(AbortSignal));
  expect(runtime.get(task.id)).toMatchObject({ providerId: 'provider-1', capability: 'conversation', model: 'chat-model' });
});

it('sends conversation image attachments as multimodal chat content', async () => {
  const runtime = createTaskRuntime();
  const chat = vi.fn(async () => ({ text: '已参考图片', cost: null }));
  const service = createAgentTaskService({ runtime, resolveAdapter: async () => ({ chat }) });

  await service.submitConversation({
    projectId: 'project-1',
    connectionId: 'provider-1',
    message: '按参考图调整',
    attachments: [{ name: 'reference.png', mimeType: 'image/png', bytes: new Uint8Array([137, 80, 78, 71]) }],
  });
  await service.flush();

  expect(chat).toHaveBeenCalledWith({ messages: [
    { role: 'system', content: expect.stringContaining('Return JSON only') },
    { role: 'user', content: expect.arrayContaining([
      { type: 'text', text: '按参考图调整' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw==' } },
    ]) },
  ] }, expect.any(AbortSignal));
});

it('labels image IDs, publishes only the brief, and persists the inferred plan', async () => {
  const runtime = createTaskRuntime();
  const requests: ChatRequest[] = [];
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async (request) => {
        requests.push(request);
        return {
          text: JSON.stringify({
            brief: '修改图一并参考图二构图。',
            visualContext: {
              version: 1,
              items: [
                { assetId: 'asset-a', roles: ['edit-target', 'visual-anchor'], confidence: 0.98 },
                { assetId: 'asset-b', roles: ['visual-reference'], confidence: 0.94 },
              ],
              clarificationRequired: false,
            },
            releasedAssetIds: [],
          }),
          cost: null,
        };
      },
    }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1,
      libraryId: input.libraryId!,
      projectId: input.projectId!,
      documentId: input.documentId!,
      brief: '',
      document: { width: 100, height: 100, currentImageAssetIds: [] },
      attachmentAssetIds,
      userMessage: input.message,
      baseRevisionId: null,
    }),
    persistConversationAttachments: async () => ['asset-a', 'asset-b'],
    loadContextImage: async ({ assetId }) => ({
      name: `${assetId}.png`,
      mimeType: 'image/png',
      bytes: new Uint8Array([1]),
    }),
  });

  const task = await service.submitConversation({
    libraryId: 'workspace-1',
    projectId: 'project-1',
    documentId: 'document-1',
    connectionId: 'provider-1',
    message: '修改图一并参考图二构图',
    attachments: [
      { name: 'a.png', mimeType: 'image/png', bytes: new Uint8Array([1]) },
      { name: 'b.png', mimeType: 'image/png', bytes: new Uint8Array([2]) },
    ],
  });
  await service.flush();

  expect(JSON.stringify(requests[0]!.messages.at(-1)!.content)).toContain('assetId=asset-a');
  expect(JSON.stringify(requests[0]!.messages.at(-1)!.content)).toContain('assetId=asset-b');
  expect(runtime.get(task.id)?.result?.text).toBe('修改图一并参考图二构图。');
  expect(runtime.get(task.id)?.progressText).toBe('修改图一并参考图二构图。');
  expect(runtime.get(task.id)?.visualContextPlan?.items).toHaveLength(2);
});

it('publishes only the brief for provider field variants', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({
        text: JSON.stringify({
          brief: '抠出人物并输出透明背景。',
          visualContext: {
            version: 1,
            items: [
              { assetId: 'asset-person', role: 'edit-target', confidence: 0.99 },
              { assetId: 'asset-person', role: 'visual-reference', confidence: 0.99 },
            ],
            clarificationRequired: false,
          },
          releasedAssets: [],
        }),
        cost: null,
      }),
    }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1,
      libraryId: input.libraryId!,
      projectId: input.projectId!,
      documentId: input.documentId!,
      brief: '',
      document: { width: 100, height: 100, currentImageAssetIds: [] },
      attachmentAssetIds,
      userMessage: input.message,
      baseRevisionId: null,
    }),
    persistConversationAttachments: async () => ['asset-person'],
    loadContextImage: async () => ({
      name: 'person.png',
      mimeType: 'image/png',
      bytes: new Uint8Array([1]),
    }),
  });

  const task = await service.submitConversation({
    libraryId: 'workspace-1',
    projectId: 'project-1',
    documentId: 'document-1',
    connectionId: 'provider-1',
    message: '抠出人物',
    attachments: [{ name: 'person.png', mimeType: 'image/png', bytes: new Uint8Array([1]) }],
  });
  await service.flush();

  expect(runtime.get(task.id)?.result?.text).toBe('抠出人物并输出透明背景。');
  expect(runtime.get(task.id)?.progressText).toBe('抠出人物并输出透明背景。');
  expect(runtime.get(task.id)?.visualContextPlan).toEqual({
    version: 1,
    items: [{ assetId: 'asset-person', roles: ['edit-target', 'visual-reference'], confidence: 0.99 }],
    clarificationRequired: false,
  });
});

it('persists only the brief when the provider returns an invalid visual context plan', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({
        text: JSON.stringify({
          brief: '将人物抠图置于真实、绚丽的极光夜空前。',
          visualContext: {
            version: 1,
            items: [
              { assetId: 'asset-person', roles: ['edit-target', 'visual-anchor', 'visual-reference'], confidence: 0.92 },
              { assetId: 'asset-background', roles: ['edit-target', 'visual-reference'], confidence: 1 },
            ],
            clarificationRequired: false,
          },
          releasedAssets: [],
        }),
        cost: null,
      }),
    }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1,
      libraryId: input.libraryId!,
      projectId: input.projectId!,
      documentId: input.documentId!,
      brief: '',
      document: { width: 100, height: 100, currentImageAssetIds: [] },
      attachmentAssetIds,
      userMessage: input.message,
      baseRevisionId: null,
    }),
    persistConversationAttachments: async () => ['asset-person', 'asset-background'],
    loadContextImage: async ({ assetId }) => ({
      name: `${assetId}.png`,
      mimeType: 'image/png',
      bytes: new Uint8Array([1]),
    }),
  });

  const task = await service.submitConversation({
    libraryId: 'workspace-1',
    projectId: 'project-1',
    documentId: 'document-1',
    connectionId: 'provider-1',
    message: '替换人物背景为极光',
    attachments: [
      { name: 'person.png', mimeType: 'image/png', bytes: new Uint8Array([1]) },
      { name: 'background.png', mimeType: 'image/png', bytes: new Uint8Array([2]) },
    ],
  });
  await service.flush();

  expect(runtime.get(task.id)?.result?.text).toBe('将人物抠图置于真实、绚丽的极光夜空前。');
  expect(runtime.get(task.id)?.progressText).toBe('将人物抠图置于真实、绚丽的极光夜空前。');
  expect(runtime.get(task.id)?.visualContextPlan).toMatchObject({ clarificationRequired: true });
});

it('recovers a structured response when the provider omits confidence', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({
        text: JSON.stringify({
          brief: '以图一为编辑目标，并参考图二。',
          visualContext: {
            version: 1,
            items: [
              { assetId: 'asset-a', roles: ['edit-target', 'visual-reference'] },
              { assetId: 'asset-b', roles: ['visual-reference'] },
            ],
            clarificationRequired: false,
          },
          releasedAssetIds: [],
        }),
        cost: null,
      }),
    }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1,
      libraryId: input.libraryId!,
      projectId: input.projectId!,
      documentId: input.documentId!,
      brief: '',
      document: { width: 100, height: 100, currentImageAssetIds: [] },
      attachmentAssetIds,
      userMessage: input.message,
      baseRevisionId: null,
    }),
    persistConversationAttachments: async () => ['asset-a', 'asset-b'],
    loadContextImage: async ({ assetId }) => ({
      name: `${assetId}.png`,
      mimeType: 'image/png',
      bytes: new Uint8Array([1]),
    }),
  });

  const task = await service.submitConversation({
    libraryId: 'workspace-1',
    projectId: 'project-1',
    documentId: 'document-1',
    connectionId: 'provider-1',
    message: '以图一为编辑目标，并参考图二',
    attachments: [
      { name: 'asset-a.png', mimeType: 'image/png', bytes: new Uint8Array([1]) },
      { name: 'asset-b.png', mimeType: 'image/png', bytes: new Uint8Array([2]) },
    ],
  });
  await service.flush();

  expect(runtime.get(task.id)?.result?.text).toBe('以图一为编辑目标，并参考图二。');
  expect(runtime.get(task.id)?.progressText).toBe('以图一为编辑目标，并参考图二。');
  expect(runtime.get(task.id)?.visualContextPlan).toMatchObject({
    clarificationRequired: false,
    items: [
      { assetId: 'asset-a', roles: ['edit-target', 'visual-reference'], confidence: 0 },
      { assetId: 'asset-b', roles: ['visual-reference'], confidence: 0 },
    ],
  });
});

const createConversationPlanHarness = (responses: string[]) => {
  const runtime = createTaskRuntime();
  let responseIndex = 0;
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: responses[responseIndex++]!, cost: null }),
    }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1,
      libraryId: input.libraryId!,
      projectId: input.projectId!,
      documentId: input.documentId!,
      brief: '',
      document: { width: 100, height: 100, currentImageAssetIds: [] },
      attachmentAssetIds,
      userMessage: input.message,
      baseRevisionId: null,
    }),
    persistConversationAttachments: async ({ attachments }) =>
      attachments.map((attachment) => attachment.name.replace(/\.png$/u, '')),
    loadContextImage: async ({ assetId }) => ({
      name: `${assetId}.png`,
      mimeType: 'image/png',
      bytes: new Uint8Array([1]),
    }),
  });
  return { runtime, service };
};

it('recovers plain text without dropping initial attachments', async () => {
  const { runtime, service } = createConversationPlanHarness(['普通分析文本']);
  const task = await service.submitConversation({
    libraryId: 'workspace-1',
    projectId: 'project-1',
    documentId: 'document-1',
    connectionId: 'provider-1',
    message: '比较两张图',
    attachments: [
      { name: 'asset-a.png', mimeType: 'image/png', bytes: new Uint8Array([1]) },
      { name: 'asset-b.png', mimeType: 'image/png', bytes: new Uint8Array([2]) },
    ],
  });
  await service.flush();

  expect(runtime.get(task.id)?.result?.text).toBe('普通分析文本');
  expect(runtime.get(task.id)?.visualContextPlan?.items.map((item) => item.assetId).sort())
    .toEqual(['asset-a', 'asset-b']);
});

it('removes an anchor only when releasedAssetIds names it', async () => {
  const envelope = (releasedAssetIds: string[]) => JSON.stringify({
    brief: '继续修改当前稿。',
    visualContext: {
      version: 1,
      items: [{ assetId: 'asset-draft', roles: ['edit-target'], confidence: 1 }],
      clarificationRequired: false,
    },
    releasedAssetIds,
  });
  const firstEnvelope = JSON.stringify({
    brief: '以原图为基础。',
    visualContext: {
      version: 1,
      items: [{ assetId: 'asset-original', roles: ['edit-target', 'visual-anchor'], confidence: 1 }],
      clarificationRequired: false,
    },
    releasedAssetIds: [],
  });
  const { runtime, service } = createConversationPlanHarness([
    firstEnvelope,
    envelope([]),
    envelope(['asset-original']),
  ]);
  const first = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1',
    message: '以原图为基础', attachments: [{ name: 'asset-original.png', mimeType: 'image/png', bytes: new Uint8Array([1]) }],
  });
  await service.flush();
  const second = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1',
    analysisThreadId: first.analysisThreadId, conversationParentTaskId: first.id,
    referencedAssetIds: ['asset-draft'], message: '继续修改当前稿',
  });
  await service.flush();
  expect(runtime.get(second.id)?.visualContextPlan?.items.some((item) =>
    item.assetId === 'asset-original' && item.roles.includes('visual-anchor'))).toBe(true);

  const third = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1',
    analysisThreadId: first.analysisThreadId, conversationParentTaskId: second.id,
    referencedAssetIds: ['asset-draft'], message: '只使用当前稿，不再参考原图',
  });
  await service.flush();
  expect(runtime.get(third.id)?.visualContextPlan?.items.some((item) => item.assetId === 'asset-original')).toBe(false);
});

it('stores a clarification plan when no edit target is identifiable', async () => {
  const response = JSON.stringify({
    brief: '你希望修改图一还是图二？',
    visualContext: {
      version: 1,
      items: [
        { assetId: 'asset-a', roles: ['visual-reference'], confidence: 0.4 },
        { assetId: 'asset-b', roles: ['visual-reference'], confidence: 0.4 },
      ],
      clarificationRequired: true,
    },
    releasedAssetIds: [],
  });
  const { runtime, service } = createConversationPlanHarness([response]);
  const task = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1',
    message: '调整一下', attachments: [
      { name: 'asset-a.png', mimeType: 'image/png', bytes: new Uint8Array([1]) },
      { name: 'asset-b.png', mimeType: 'image/png', bytes: new Uint8Array([2]) },
    ],
  });
  await service.flush();

  expect(runtime.get(task.id)).toMatchObject({
    state: 'completed',
    result: { text: '你希望修改图一还是图二？' },
    visualContextPlan: { clarificationRequired: true },
  });
});

it('keeps original anchors and references when a generated draft becomes the edit target', async () => {
  const runtime = createTaskRuntime();
  const editImage = vi.fn(async (_request: { prompt: string; image: Blob; referenceImages?: Blob[] }) => {
    void _request;
    return { images: [{ base64: 'result' }], cost: null };
  });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'unused', cost: null }), editImage }),
    persistGeneratedImages: async () => ['asset-result'],
    loadContextImage: async ({ assetId }) => ({
      name: `${assetId}.png`,
      mimeType: 'image/png',
      bytes: new Uint8Array([assetId === 'asset-draft' ? 3 : assetId === 'asset-original' ? 1 : 2]),
    }),
  });
  const plan: VisualContextPlan = {
    version: 1,
    items: [
      { assetId: 'asset-draft', roles: ['edit-target'], confidence: 1 },
      { assetId: 'asset-original', roles: ['visual-anchor'], confidence: 1 },
      { assetId: 'asset-style', roles: ['visual-reference'], confidence: 1 },
    ],
    clarificationRequired: false,
  };
  const conversation = await completedConversationWithPlan(runtime, plan);

  const generation = await service.submitDesignGeneration({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1',
    conversationTaskId: conversation.id, connectionId: 'provider-1',
  });
  await service.flush();

  expect(generation.visualContextPlan).toEqual(plan);
  expect(generation.contextAssetIds).toEqual(['asset-draft', 'asset-original', 'asset-style']);
  expect(editImage).toHaveBeenCalledTimes(3);
  for (const [request] of editImage.mock.calls) {
    expect(request.referenceImages).toHaveLength(2);
    expect(request.prompt).toContain('Image 1: assetId=asset-draft; roles=edit-target');
    expect(request.prompt).toContain('Image 2: assetId=asset-original; roles=visual-anchor');
    expect(request.prompt).toContain('Image 3: assetId=asset-style; roles=visual-reference');
  }
});

it('rejects design generation while visual clarification is required', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'unused', cost: null }) }),
  });
  const conversation = await completedConversationWithPlan(runtime, {
    version: 1,
    items: [
      { assetId: 'asset-a', roles: ['visual-reference'], confidence: 0.4 },
      { assetId: 'asset-b', roles: ['visual-reference'], confidence: 0.4 },
    ],
    clarificationRequired: true,
  });

  await expect(service.submitDesignGeneration({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1',
    conversationTaskId: conversation.id, connectionId: 'provider-1',
  })).rejects.toThrow('VISUAL_CONTEXT_CLARIFICATION_REQUIRED');
  expect(runtime.list().filter((task) => task.capability === 'design-generation')).toHaveLength(0);
});

it('rejects generation before task creation when a planned asset is missing', async () => {
  const runtime = createTaskRuntime();
  const editImage = vi.fn(async (_request: { prompt: string; image: Blob; referenceImages?: Blob[] }) => {
    void _request;
    return { images: [{ base64: 'result' }], cost: null };
  });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'unused', cost: null }), editImage }),
    loadContextImage: async ({ assetId }) => assetId === 'asset-missing'
      ? null
      : { name: `${assetId}.png`, mimeType: 'image/png', bytes: new Uint8Array([1]) },
  });
  const conversation = await completedConversationWithPlan(runtime, {
    version: 1,
    items: [
      { assetId: 'asset-draft', roles: ['edit-target'], confidence: 1 },
      { assetId: 'asset-missing', roles: ['visual-anchor'], confidence: 1 },
    ],
    clarificationRequired: false,
  });

  await expect(service.submitDesignGeneration({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1',
    conversationTaskId: conversation.id, connectionId: 'provider-1',
  })).rejects.toThrow('CONTEXT_ASSET_MISSING');
  expect(editImage).not.toHaveBeenCalled();
  expect(runtime.list().filter((task) => task.capability === 'design-generation')).toHaveLength(0);
});

it('uses the copied visual plan for every slot and a later retry', async () => {
  const runtime = createTaskRuntime();
  let callCount = 0;
  const editImage = vi.fn(async (_request: { prompt: string; image: Blob; referenceImages?: Blob[] }) => {
    void _request;
    callCount += 1;
    if (callCount === 2) throw new Error('PROVIDER_REQUEST_FAILED');
    return { images: [{ base64: `result-${callCount}` }], cost: null };
  });
  let assetCount = 0;
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'unused', cost: null }), editImage }),
    loadContextImage: async ({ assetId }) => ({
      name: `${assetId}.png`, mimeType: 'image/png', bytes: new Uint8Array([assetId === 'asset-target' ? 1 : 2]),
    }),
    persistGeneratedImages: async () => [`asset-result-${assetCount += 1}`],
  });
  const plan: VisualContextPlan = {
    version: 1,
    items: [
      { assetId: 'asset-target', roles: ['edit-target'], confidence: 1 },
      { assetId: 'asset-anchor', roles: ['visual-anchor'], confidence: 1 },
    ],
    clarificationRequired: false,
  };
  const conversation = await completedConversationWithPlan(runtime, plan);
  const generation = await service.submitDesignGeneration({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1',
    conversationTaskId: conversation.id, connectionId: 'provider-1',
  });
  await service.flush();

  await service.retryDesignGenerationSlot({
    libraryId: 'workspace-1', taskId: generation.id, slotId: 'composition',
  });
  await service.flush();

  expect(editImage).toHaveBeenCalledTimes(4);
  expect(editImage.mock.calls.map(([request]) => request.prompt.split('\n\nCandidate direction')[0]!.split('\n\n').at(-1)))
    .toEqual(Array(4).fill('Visual input manifest:\nImage 1: assetId=asset-target; roles=edit-target\nImage 2: assetId=asset-anchor; roles=visual-anchor'));
  expect(runtime.get(generation.id)?.visualContextPlan).toEqual(plan);
});

it('merges a conversation thread in order and streams analysis progress', async () => {
  const runtime = createTaskRuntime();
  const requests: Array<{ messages: unknown[] }> = [];
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: 'fallback', cost: null }),
      streamChat: (request) => {
        requests.push(request);
        const events = [{ text: '流式' }, { text: '分析' }];
        let index = 0;
        return { [Symbol.asyncIterator]: () => ({ next: async () => index < events.length ? { done: false as const, value: events[index++]! } : { done: true as const, value: undefined } }) };
      },
    }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1, libraryId: input.libraryId ?? 'workspace-1', projectId: input.projectId!, documentId: input.documentId!,
      brief: '固定 brief', document: { width: 100, height: 200, currentImageAssetIds: [] }, attachmentAssetIds,
      userMessage: input.message, designerSnapshot: { styleDna: { palette: ['#111'] }, negativeRules: ['avoid neon'] }, baseRevisionId: null,
    }),
    persistConversationAttachments: async ({ attachments }) => attachments.map((attachment) => attachment.name),
    loadContextImage: async ({ assetId }) => ({ name: assetId, mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }),
  });
  const first = await service.submitConversation({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: '第一轮', attachments: [{ name: 'one.png', mimeType: 'image/png', bytes: new Uint8Array([1]) }] });
  await service.flush();
  const second = await service.submitConversation({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', analysisThreadId: first.analysisThreadId, conversationParentTaskId: first.id, connectionId: 'provider-1', message: '第二轮', referencedAssetIds: ['candidate.png'] });
  await service.flush();

  expect(runtime.get(second.id)).toMatchObject({ analysisThreadId: first.analysisThreadId, conversationParentTaskId: first.id, progressText: '流式分析' });
  const secondRequest = requests[1]!;
  const messages = secondRequest.messages as Array<{ content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>;
  expect(messages.map((message) => typeof message.content === 'string' ? message.content : message.content[0]?.type === 'text' ? message.content[0].text : undefined)).toEqual(expect.arrayContaining(['第一轮', '第二轮']));
  expect(messages.at(-1)?.content).toEqual(expect.arrayContaining([{ type: 'image_url', image_url: { url: 'data:image/png;base64,AQID' } }]));
});

it('fails an empty conversation response instead of marking it complete', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      streamChat: () => ({ [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true as const, value: undefined }) }) }),
    }),
  });

  const task = await service.submitConversation({ projectId: 'project-1', connectionId: 'provider-1', message: 'empty response' });
  await service.flush();

  expect(runtime.get(task.id)).toMatchObject({ state: 'failed', errorCode: 'EMPTY_PROVIDER_RESPONSE' });
});

it('coalesces high-frequency streamed progress updates', async () => {
  const runtime = createTaskRuntime();
  const updateProgress = vi.spyOn(runtime, 'updateProgress');
  const events = Array.from({ length: 100 }, (_, index) => ({ text: `片段${index}` }));
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: 'fallback', cost: null }),
      streamChat: () => {
        let index = 0;
        return { [Symbol.asyncIterator]: () => ({ next: async () => index < events.length ? { done: false as const, value: events[index++]! } : { done: true as const, value: undefined } }) };
      },
    }),
  });

  const task = await service.submitConversation({ projectId: 'project-1', connectionId: 'provider-1', message: 'long response' });
  await service.flush();

  expect(runtime.get(task.id)?.state).toBe('completed');
  expect(updateProgress.mock.calls.length).toBeLessThanOrEqual(3);
});

it('publishes streamed progress before the provider finishes', async () => {
  const runtime = createTaskRuntime();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let firstEventResolve!: () => void;
  const firstEvent = new Promise<void>((resolve) => { firstEventResolve = resolve; });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: 'fallback', cost: null }),
      streamChat: () => {
        let index = 0;
        return {
          [Symbol.asyncIterator]: () => ({
            next: async () => {
              if (index === 0) {
                index += 1;
                return { done: false as const, value: { text: '首段' } };
              }
              if (index === 1) {
                index += 1;
                firstEventResolve();
                await gate;
                return { done: false as const, value: { text: '尾段' } };
              }
              return { done: true as const, value: undefined };
            },
          }),
        };
      },
    }),
  });

  const task = await service.submitConversation({ projectId: 'project-1', connectionId: 'provider-1', message: 'streaming response' });
  await firstEvent;
  try {
    expect(runtime.get(task.id)).toMatchObject({ state: 'running', progressText: '首段' });
  } finally {
    release();
  }
  await service.flush();
  expect(runtime.get(task.id)).toMatchObject({ state: 'completed', progressText: '首段尾段' });
});

it('uses only explicitly selected images for the current conversation turn', async () => {
  const runtime = createTaskRuntime();
  const requests: Array<{ messages: unknown[] }> = [];
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: 'fallback', cost: null }),
      streamChat: (request) => {
        requests.push(request);
        return { [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true as const, value: undefined }) }) };
      },
    }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1, libraryId: input.libraryId ?? 'workspace-1', projectId: input.projectId!, documentId: input.documentId!,
      brief: '固定 brief', document: { width: 100, height: 200, currentImageAssetIds: ['canvas-image'] }, attachmentAssetIds,
      userMessage: input.message, baseRevisionId: null,
    }),
    persistConversationAttachments: async ({ attachments }) => attachments.map((attachment) => attachment.name),
    loadContextImage: async ({ assetId }) => ({ name: assetId, mimeType: 'image/png', bytes: new Uint8Array([assetId === 'selected-image' ? 2 : 9]) }),
  });

  const first = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: '第一轮',
  });
  await service.flush();
  await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', analysisThreadId: first.analysisThreadId,
    conversationParentTaskId: first.id, connectionId: 'provider-1', message: '第二轮', referencedAssetIds: ['selected-image'],
  });
  await service.flush();

  const secondMessages = requests[1]!.messages as Array<{ content: string | Array<{ type: string; image_url?: { url: string } }> }>;
  expect(secondMessages.at(-1)?.content).toEqual([
    { type: 'text', text: '第二轮' },
    { type: 'text', text: '[DesignHub image: assetId=selected-image; origin=current-turn; roles=visual-reference]' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,Ag==' } },
  ]);
});

it('uses the latest generated image group when a continued turn has no image selection', async () => {
  const runtime = createTaskRuntime();
  let generatedIndex = 0;
  let chatIndex = 0;
  const generationRequests: Array<{ referenceImages?: Blob[] }> = [];
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => {
        chatIndex += 1;
        return {
          text: JSON.stringify(chatIndex === 1 ? {
            brief: '第一轮简报',
            visualContext: {
              version: 1,
              items: [{ assetId: 'canvas-image', roles: ['edit-target'], confidence: 1 }],
              clarificationRequired: false,
            },
            releasedAssetIds: [],
          } : {
            brief: '第二轮简报',
            visualContext: {
              version: 1,
              items: [
                { assetId: 'generated-1', roles: ['edit-target'], confidence: 1 },
                { assetId: 'generated-2', roles: ['visual-reference'], confidence: 1 },
                { assetId: 'generated-3', roles: ['visual-reference'], confidence: 1 },
              ],
              clarificationRequired: false,
            },
            releasedAssetIds: [],
          }),
          cost: null,
        };
      },
      generateImage: async (request) => {
        generationRequests.push(request);
        return { images: [{ base64: 'latest-generated' }], cost: null };
      },
    }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1, libraryId: input.libraryId ?? 'workspace-1', projectId: input.projectId!, documentId: input.documentId!,
      brief: '固定 brief', document: { width: 100, height: 200, currentImageAssetIds: ['canvas-image'] }, attachmentAssetIds,
      userMessage: input.message, baseRevisionId: null,
    }),
    persistGeneratedImages: async () => [`generated-${generatedIndex += 1}`],
    loadContextImage: async ({ assetId }) => ({ name: assetId, mimeType: 'image/png', bytes: new Uint8Array([assetId === 'latest-generated' ? 7 : 3]) }),
  });

  const first = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: '第一轮',
  });
  await service.flush();
  const generation = await service.submitDesignGeneration({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: first.id, connectionId: 'provider-1',
  });
  await service.flush();
  const latestGeneratedIds = runtime.get(generation.id)?.result?.assetIds ?? [];

  const second = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', analysisThreadId: first.analysisThreadId,
    conversationParentTaskId: first.id, connectionId: 'provider-1', message: '第二轮不选图',
  });
  await service.flush();

  expect(latestGeneratedIds).toHaveLength(3);
  expect(second.contextAssetIds).toEqual(latestGeneratedIds);
  const secondGeneration = await service.submitDesignGeneration({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: second.id, connectionId: 'provider-1',
  });
  await service.flush();

  expect(secondGeneration.capability).toBe('design-generation');
  expect(generationRequests.slice(-3).every((request) => Boolean(request.referenceImages))).toBe(true);
  expect(generationRequests.slice(-3).map((request) => request.referenceImages?.length)).toEqual([3, 3, 3]);
});

it('uses a completed conversation context to create a design candidate', async () => {
  const runtime = createTaskRuntime();
  const chat = vi.fn(async () => ({ text: 'Use a calm editorial composition.', cost: null }));
  const generateImage = vi.fn(async (request: { prompt: string; model?: string; size?: string; count?: number }) => ({
    images: [{ base64: 'generated-bytes' }], cost: null, request,
  }));
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat, generateImage }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1,
      libraryId: input.libraryId ?? 'workspace-1',
      projectId: input.projectId!,
      documentId: input.documentId!,
      brief: 'Spring market poster',
      document: { width: 1080, height: 1440, currentImageAssetIds: [] },
      attachmentAssetIds,
      userMessage: input.message,
      designerSnapshot: { id: 'designer-v1', styleDna: { palette: ['#fff'] }, negativeRules: [{ en: 'Avoid neon' }] },
      baseRevisionId: input.baseRevisionId ?? null,
    }),
    persistConversationAttachments: async () => ['reference-asset'],
    loadContextImage: async () => null,
    persistGeneratedImages: async () => ['asset-generated'],
  });

  const conversation = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1',
    connectionId: 'provider-1', message: 'Make a calm poster', attachments: [],
  });
  await service.flush();
  const generation = await service.submitDesignGeneration({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1',
    conversationTaskId: conversation.id, connectionId: 'provider-1', baseRevisionId: null,
  });
  await service.flush();

  expect(generateImage).toHaveBeenCalledTimes(3);
  expect(generateImage).toHaveBeenCalledWith(expect.objectContaining({
    prompt: expect.stringContaining('Avoid neon'), size: '1080x1440', count: 1,
  }), expect.any(AbortSignal));
  expect(runtime.get(generation.id)).toMatchObject({
    capability: 'design-generation',
    parentConversationTaskId: conversation.id,
    result: { imageCount: 3, candidates: [{ assetIds: ['asset-generated'], baseRevisionId: null }, { assetIds: ['asset-generated'], baseRevisionId: null }, { assetIds: ['asset-generated'], baseRevisionId: null }] },
  });
});

it('persists and sends the selected design-generation model', async () => {
  const runtime = createTaskRuntime();
  const generateImage = vi.fn(async () => ({ images: [{ base64: 'generated' }], cost: null }));
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'analysis brief', cost: null }), generateImage }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1,
      libraryId: input.libraryId!,
      projectId: input.projectId!,
      documentId: input.documentId!,
      brief: 'Project brief',
      document: { width: 1080, height: 1440, currentImageAssetIds: [] },
      attachmentAssetIds,
      userMessage: input.message,
      baseRevisionId: null,
    }),
    persistGeneratedImages: async () => ['asset-generated'],
  });

  const conversation = await service.submitConversation({
    libraryId: 'workspace-1',
    projectId: 'project-1',
    documentId: 'document-1',
    connectionId: 'provider-1',
    message: '生成一张海报',
  });
  await service.flush();
  const generation = await service.submitDesignGeneration({
    libraryId: 'workspace-1',
    projectId: 'project-1',
    documentId: 'document-1',
    conversationTaskId: conversation.id,
    connectionId: 'provider-1',
    model: 'image-model',
    count: 1,
  });
  await service.flush();

  expect(generateImage).toHaveBeenCalledWith(expect.objectContaining({ model: 'image-model' }), expect.any(AbortSignal));
  expect(runtime.get(generation.id)).toMatchObject({ providerId: 'provider-1', capability: 'design-generation', model: 'image-model' });
});

it('waits for the initial design task snapshot to persist before returning it', async () => {
  let releasePersistence: (() => void) | undefined;
  const persistence = new Promise<void>((resolve) => { releasePersistence = resolve; });
  const parent: TaskRecord = {
    id: 'conversation-persisted',
    requestId: 'request-conversation-persisted',
    state: 'completed',
    cancelRequested: false,
    attempt: 1,
    capability: 'conversation',
    source: { kind: 'project', id: 'project-1' },
    documentId: 'document-1',
    analysisThreadId: 'thread-persisted',
    designContext: {
      version: 1,
      libraryId: 'workspace-1',
      projectId: 'project-1',
      documentId: 'document-1',
      brief: '',
      document: { width: 1080, height: 1440, currentImageAssetIds: [] },
      attachmentAssetIds: [],
      userMessage: 'Poster',
      baseRevisionId: null,
    },
    visualContextPlan: { version: 1, items: [], clarificationRequired: false },
    result: { text: 'Brief' },
  };
  const persist = vi.fn(async (tasks: readonly TaskRecord[]) => {
    if (tasks.some((task) => task.capability === 'design-generation')) await persistence;
  });
  const runtime = createTaskRuntime({ initialTasks: [parent], persist });
  let releaseGeneration: ((value: ImageResponse) => void) | undefined;
  const generation = new Promise<ImageResponse>((resolve) => { releaseGeneration = resolve; });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: '', cost: null }), generateImage: async () => generation }),
    persistGeneratedImages: async () => ['asset-generated'],
  });

  let returned = false;
  const submission = service.submitDesignGeneration({
    libraryId: 'workspace-1',
    projectId: 'project-1',
    documentId: 'document-1',
    conversationTaskId: parent.id,
    connectionId: 'provider-1',
    count: 1,
  }).then((task) => { returned = true; return task; });
  await vi.waitFor(() => expect(persist).toHaveBeenCalled());
  await Promise.resolve();
  expect(returned).toBe(false);

  releasePersistence?.();
  const task = await submission;
  expect(task.capability).toBe('design-generation');
  releaseGeneration?.({ images: [{ base64: 'generated' }], cost: null });
  await service.flush();
});

it('aborts an image connection test when its timeout elapses', async () => {
  vi.useFakeTimers();
  let receivedSignal: AbortSignal | undefined;
  const service = createAgentTaskService({
    runtime: createTaskRuntime(),
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      generateImage: async (_request, signal) => new Promise((resolve, reject) => {
        receivedSignal = signal;
        signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
        setTimeout(() => resolve({ images: [{ base64: 'too-late' }], cost: null }), 50);
      }),
    }),
  });

  const result = service.testImageGeneration({ connectionId: 'provider-1', prompt: 'test', timeoutMs: 10 });
  const rejection = expect(result).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(50);

  await rejection;
  expect(receivedSignal?.aborted).toBe(true);
  vi.useRealTimers();
});

it('generates one design slot when a single image is requested', async () => {
  const runtime = createTaskRuntime();
  const generateImage = vi.fn(async () => ({ images: [{ base64: 'generated' }], cost: null }));
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'analysis brief', cost: null }), generateImage }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1, libraryId: input.libraryId!, projectId: input.projectId!, documentId: input.documentId!,
      brief: 'Project brief', document: { width: 1080, height: 1440, currentImageAssetIds: [] }, attachmentAssetIds,
      userMessage: input.message, baseRevisionId: null,
    }),
    persistGeneratedImages: async () => ['asset-generated'],
    persistProjectDesigns: async () => undefined,
  });

  const conversation = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Poster',
  });
  await service.flush();
  const generation = await service.submitDesignGeneration({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1', count: 1,
  });
  await service.flush();

  expect(generation.generationSlots).toHaveLength(1);
  expect(generateImage).toHaveBeenCalledTimes(1);
  expect(runtime.get(generation.id)?.result?.imageCount).toBe(1);
});

it('persists a single background-removed image beside its source design', async () => {
  const runtime = createTaskRuntime();
  const persistProjectDesigns = vi.fn(async () => undefined);
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: '', cost: null }), editImage: async () => ({ images: [{ base64: 'removed-background' }], cost: null }) }),
    persistGeneratedImages: async () => ['asset-removed'],
    persistProjectDesigns,
  });

  const task = await service.submitImageEdit({
    projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: 'Remove background', image: new Blob(['image']),
    tool: 'remove-background', toolParams: { edgeRefinement: 50 },
    projectDesign: { sourceTaskId: 'generation-1', sourceConversationTaskId: 'conversation-1', width: 1080, height: 1440, title: '春日海报（去除背景）' },
  });
  await service.flush();

  expect(runtime.get(task.id)).toMatchObject({ state: 'completed', result: { assetIds: ['asset-removed'], imageCount: 1 } });
  expect(persistProjectDesigns).toHaveBeenCalledWith({
    projectId: 'project-1',
    designs: [expect.objectContaining({ assetId: 'asset-removed', sourceTaskId: 'generation-1', sourceConversationTaskId: 'conversation-1', width: 1080, height: 1440, title: '春日海报（去除背景）' })],
  });
});

it('starts three differentiated count-one generation requests concurrently', async () => {
  const runtime = createTaskRuntime();
  const responses = [deferred<ImageResponse>(), deferred<ImageResponse>(), deferred<ImageResponse>()];
  const generateImage = vi.fn((request: { prompt: string; count?: number }) => {
    void request;
    return responses[generateImage.mock.calls.length - 1]!.promise;
  });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'analysis brief', cost: null }), generateImage }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1,
      libraryId: input.libraryId!,
      projectId: input.projectId!,
      documentId: input.documentId!,
      brief: 'Project brief',
      document: { width: 1080, height: 1440, currentImageAssetIds: [] },
      attachmentAssetIds,
      userMessage: input.message,
      baseRevisionId: 'revision-1',
    }),
    persistGeneratedImages: async ({ images }) => [`asset-${'base64' in images[0]! ? images[0].base64 : 'url'}`],
  });
  const conversation = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Poster',
  });
  await service.flush();
  const generation = await service.submitDesignGeneration({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1',
  });

  await vi.waitFor(() => expect(generateImage).toHaveBeenCalledTimes(3));
  expect(generateImage.mock.calls.every(([request]) => request.count === 1)).toBe(true);
  expect(generateImage.mock.calls.map(([request]) => request.prompt)).toEqual([
    expect.stringContaining('主方案'),
    expect.stringContaining('构图探索'),
    expect.stringContaining('视觉突破'),
  ]);
  responses.forEach((response, index) => response.resolve({ images: [{ base64: `image-${index}` }], cost: 0.1 }));
  await service.flush();

  expect(runtime.get(generation.id)).toMatchObject({ state: 'completed', result: { imageCount: 3 } });
  expect(runtime.get(generation.id)?.result?.cost).toBeCloseTo(0.3);
  expect(runtime.get(generation.id)?.result?.candidates?.map((candidate) => candidate.id)).toEqual([
    `candidate-${generation.id}-primary`,
    `candidate-${generation.id}-composition`,
    `candidate-${generation.id}-expressive`,
  ]);
});

it('keeps successful candidates when one parallel request fails', async () => {
  const runtime = createTaskRuntime();
  let call = 0;
  const generateImage = vi.fn(async () => {
    call += 1;
    if (call === 2) throw new Error('PROVIDER_REQUEST_FAILED');
    return { images: [{ base64: call === 1 ? 'primary' : 'expressive' }], cost: null };
  });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'brief', cost: null }), generateImage }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1, libraryId: input.libraryId!, projectId: input.projectId!, documentId: input.documentId!, brief: 'Brief',
      document: { width: 100, height: 100, currentImageAssetIds: [] }, attachmentAssetIds, userMessage: input.message, baseRevisionId: null,
    }),
    persistGeneratedImages: async ({ images }) => [`asset-${'base64' in images[0]! ? images[0].base64 : 'url'}`],
  });
  const conversation = await service.submitConversation({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Poster' });
  await service.flush();
  const generation = await service.submitDesignGeneration({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
  await service.flush();

  expect(runtime.get(generation.id)).toMatchObject({ state: 'completed', result: { imageCount: 2 } });
  expect(runtime.get(generation.id)?.generationSlots?.find((slot) => slot.id === 'composition')).toMatchObject({ state: 'failed', errorCode: 'PROVIDER_REQUEST_FAILED' });
  expect(runtime.get(generation.id)?.result?.candidates?.map((candidate) => candidate.id)).toEqual([
    `candidate-${generation.id}-primary`,
    `candidate-${generation.id}-expressive`,
  ]);
});

it('retries an individual design candidate once after an HTTP 524 without serializing the batch', async () => {
  const runtime = createTaskRuntime();
  let primaryAttempts = 0;
  const generateImage = vi.fn(async (request: { prompt: string }) => {
    if (request.prompt.includes('主方案')) {
      primaryAttempts += 1;
      if (primaryAttempts === 1) throw Object.assign(new Error('gateway timeout'), { kind: 'http', status: 524 });
    }
    return { images: [{ base64: request.prompt.includes('主方案') ? 'primary' : request.prompt.includes('构图探索') ? 'composition' : 'expressive' }], cost: null };
  });
  const service = createAgentTaskService({
    runtime,
    imageRetryDelayMs: 0,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'brief', cost: null }), generateImage }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1, libraryId: input.libraryId!, projectId: input.projectId!, documentId: input.documentId!, brief: 'Brief',
      document: { width: 100, height: 100, currentImageAssetIds: [] }, attachmentAssetIds, userMessage: input.message, baseRevisionId: null,
    }),
    persistGeneratedImages: async ({ images }) => [`asset-${'base64' in images[0]! ? images[0].base64 : 'url'}`],
  });
  const conversation = await service.submitConversation({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Poster' });
  await service.flush();
  const generation = await service.submitDesignGeneration({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
  await service.flush();

  expect(generateImage).toHaveBeenCalledTimes(4);
  expect(primaryAttempts).toBe(2);
  expect(runtime.get(generation.id)).toMatchObject({ state: 'completed', result: { imageCount: 3 } });
});

it('fails the generation batch only when all three requests fail', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: 'brief', cost: null }),
      generateImage: async () => { throw new Error('PROVIDER_REQUEST_FAILED'); },
    }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1, libraryId: input.libraryId!, projectId: input.projectId!, documentId: input.documentId!, brief: 'Brief',
      document: { width: 100, height: 100, currentImageAssetIds: [] }, attachmentAssetIds, userMessage: input.message, baseRevisionId: null,
    }),
  });
  const conversation = await service.submitConversation({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Poster' });
  await service.flush();
  const generation = await service.submitDesignGeneration({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
  await service.flush();

  expect(runtime.get(generation.id)).toMatchObject({ state: 'failed', errorCode: 'DESIGN_GENERATION_ALL_FAILED', result: { imageCount: 0, candidates: [] } });
});

it('retries only one failed generation slot with the immutable batch context', async () => {
  const runtime = createTaskRuntime();
  let call = 0;
  const generateImage = vi.fn(async (request: { prompt: string; count?: number }) => {
    call += 1;
    if (call === 2) throw new Error('PROVIDER_REQUEST_FAILED');
    return { images: [{ base64: `image-${call}` }], cost: null, request };
  });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'brief', cost: null }), generateImage }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1, libraryId: input.libraryId!, projectId: input.projectId!, documentId: input.documentId!, brief: 'Immutable brief',
      document: { width: 100, height: 100, currentImageAssetIds: [] }, attachmentAssetIds, userMessage: input.message, baseRevisionId: 'revision-1',
    }),
    persistGeneratedImages: async ({ images }) => [`asset-${'base64' in images[0]! ? images[0].base64 : 'url'}`],
  });
  const conversation = await service.submitConversation({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Poster' });
  await service.flush();
  const generation = await service.submitDesignGeneration({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
  await service.flush();

  await service.retryDesignGenerationSlot({ libraryId: 'workspace-1', taskId: generation.id, slotId: 'composition' });
  await service.flush();

  expect(generateImage).toHaveBeenCalledTimes(4);
  expect(generateImage.mock.calls[3]?.[0].prompt).toContain('构图探索');
  expect(runtime.get(generation.id)?.generationSlots?.find((slot) => slot.id === 'primary')).toMatchObject({ state: 'completed', attempt: 1 });
  expect(runtime.get(generation.id)?.generationSlots?.find((slot) => slot.id === 'composition')).toMatchObject({ state: 'completed', attempt: 2 });
  expect(runtime.get(generation.id)?.generationSlots?.find((slot) => slot.id === 'expressive')).toMatchObject({ state: 'completed', attempt: 1 });
  await expect(service.retryDesignGenerationSlot({ libraryId: 'workspace-2', taskId: generation.id, slotId: 'composition' })).rejects.toThrow('WORKSPACE_CONTEXT_MISMATCH');
  await expect(service.retryDesignGenerationSlot({ libraryId: 'workspace-1', taskId: generation.id, slotId: 'primary' })).rejects.toThrow('GENERATION_SLOT_NOT_RETRYABLE');
});

it('cancels unfinished slots while retaining an already completed candidate', async () => {
  const runtime = createTaskRuntime();
  const pendingResponses = [deferred<ImageResponse>(), deferred<ImageResponse>()];
  const signals: AbortSignal[] = [];
  let call = 0;
  const generateImage = vi.fn(async (_request: { prompt: string; count?: number }, signal?: AbortSignal) => {
    signals.push(signal!);
    call += 1;
    if (call === 1) return { images: [{ base64: 'primary' }], cost: null };
    return pendingResponses[call - 2]!.promise;
  });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'brief', cost: null }), generateImage }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1, libraryId: input.libraryId!, projectId: input.projectId!, documentId: input.documentId!, brief: 'Brief',
      document: { width: 100, height: 100, currentImageAssetIds: [] }, attachmentAssetIds, userMessage: input.message, baseRevisionId: null,
    }),
    persistGeneratedImages: async ({ images }) => [`asset-${'base64' in images[0]! ? images[0].base64 : 'url'}`],
  });
  const conversation = await service.submitConversation({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Poster' });
  await service.flush();
  const generation = await service.submitDesignGeneration({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
  await vi.waitFor(() => expect(runtime.get(generation.id)?.generationSlots?.find((slot) => slot.id === 'primary')?.state).toBe('completed'));

  service.cancel(generation.id);
  const abortError = Object.assign(new Error('cancelled'), { name: 'AbortError' });
  pendingResponses.forEach((response) => response.reject(abortError));
  await service.flush();

  expect(signals.slice(1).every((signal) => signal.aborted)).toBe(true);
  expect(runtime.get(generation.id)).toMatchObject({ state: 'completed', result: { imageCount: 1 } });
  expect(runtime.get(generation.id)?.generationSlots?.slice(1).map((slot) => slot.state)).toEqual(['cancelled', 'cancelled']);
});

it('passes persisted conversation references to image generation', async () => {
  const runtime = createTaskRuntime();
  const generateImage = vi.fn(async (request: { referenceImages?: Blob[] }) => {
    expect(request.referenceImages).toHaveLength(2);
    return { images: [{ base64: 'generated-bytes' }], cost: null };
  });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({
        text: JSON.stringify({
          brief: 'Use the supplied references.',
          visualContext: {
            version: 1,
            items: [
              { assetId: 'reference-1', roles: ['visual-reference'], confidence: 1 },
              { assetId: 'reference-2', roles: ['visual-reference'], confidence: 1 },
            ],
            clarificationRequired: false,
          },
          releasedAssetIds: [],
        }),
        cost: null,
      }),
      generateImage,
    }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1,
      libraryId: input.libraryId ?? 'workspace-1',
      projectId: input.projectId!,
      documentId: input.documentId!,
      brief: 'Reference-led poster',
      document: { width: 1080, height: 1440, currentImageAssetIds: [] },
      attachmentAssetIds,
      userMessage: input.message,
      baseRevisionId: null,
    }),
    persistConversationAttachments: async ({ attachments }) => attachments.map((_attachment, index) => `reference-${index + 1}`),
    loadContextImage: async ({ assetId }) => ({ name: assetId, mimeType: 'image/png', bytes: new Uint8Array([assetId.endsWith('1') ? 1 : 2]) }),
    persistGeneratedImages: async () => ['asset-generated'],
  });

  const conversation = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1',
    message: 'Use both reference images',
    attachments: [
      { name: 'one.png', mimeType: 'image/png', bytes: new Uint8Array([1]) },
      { name: 'two.png', mimeType: 'image/png', bytes: new Uint8Array([2]) },
    ],
  });
  await service.flush();
  await service.submitDesignGeneration({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
  await service.flush();

  expect(generateImage).toHaveBeenCalledTimes(3);
  const requests = generateImage.mock.calls.map(([request]) => request);
  expect(requests[0]?.referenceImages).toEqual([expect.any(Blob), expect.any(Blob)]);
  expect(requests[1]?.referenceImages).toBe(requests[0]?.referenceImages);
  expect(requests[2]?.referenceImages).toBe(requests[0]?.referenceImages);
});

it('generates without carrying designer style when the project has no designer', async () => {
  const runtime = createTaskRuntime();
  const generateImage = vi.fn(async () => ({ images: [{ base64: 'generated-bytes' }], cost: null }));
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'Use the project brief only.', cost: null }), generateImage }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1,
      libraryId: input.libraryId ?? 'workspace-1',
      projectId: input.projectId!,
      documentId: input.documentId!,
      brief: 'Unstyled project brief',
      document: { width: 1080, height: 1440, currentImageAssetIds: [] },
      attachmentAssetIds,
      userMessage: input.message,
      baseRevisionId: null,
    }),
    persistGeneratedImages: async () => ['asset-generated'],
  });

  const conversation = await service.submitConversation({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Create a poster' });
  await service.flush();
  await service.submitDesignGeneration({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
  await service.flush();

  expect(generateImage).toHaveBeenCalledWith(expect.objectContaining({ prompt: expect.not.stringContaining('Designer profile') }), expect.any(AbortSignal));
  expect(generateImage).toHaveBeenCalledWith(expect.objectContaining({ prompt: expect.not.stringContaining('negative rules') }), expect.any(AbortSignal));
});

it('sends the immutable designer context as a system message', async () => {
  const runtime = createTaskRuntime();
  const chat = vi.fn(async () => ({ text: 'brief', cost: null }));
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1,
      libraryId: input.libraryId ?? 'workspace-1',
      projectId: input.projectId!,
      documentId: input.documentId!,
      brief: 'Project brief',
      document: { width: 100, height: 200, currentImageAssetIds: [] },
      attachmentAssetIds,
      userMessage: input.message,
      designerSnapshot: { name: { en: 'Paper & Type' }, styleDna: { palette: ['#fff'] }, negativeRules: [{ en: 'Avoid neon' }] },
      baseRevisionId: null,
    }),
  });
  await service.submitConversation({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Make a poster' });
  await service.flush();
  expect(chat).toHaveBeenCalledWith(expect.objectContaining({ messages: [
    { role: 'system', content: expect.stringContaining('Avoid neon') },
    { role: 'user', content: expect.arrayContaining([{ type: 'text', text: 'Make a poster' }]) },
  ] }), expect.any(AbortSignal));
});

it('uses the current canvas image as the edit source for a design draft', async () => {
  const runtime = createTaskRuntime();
  const editImage = vi.fn(async (request: { prompt: string; image: Blob; referenceImages?: Blob[]; size?: string }) => {
    void request;
    return { images: [{ base64: 'edited-bytes' }], cost: null };
  });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'brief', cost: null }), editImage }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1,
      libraryId: input.libraryId ?? 'workspace-1', projectId: input.projectId!, documentId: input.documentId!,
      brief: 'Existing poster', document: { width: 100, height: 200, currentImageAssetIds: ['canvas-asset'] },
      attachmentAssetIds, userMessage: input.message, baseRevisionId: null,
      designerSnapshot: { id: 'designer-v1', styleDna: { palette: ['#111'] } },
    }),
    loadSourceImage: async () => new Blob(['canvas']),
    persistGeneratedImages: async () => ['asset-edited'],
  });
  const conversation = await service.submitConversation({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Refine this poster' });
  await service.flush();
  const generation = await service.submitDesignGeneration({ libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
  await service.flush();
  expect(editImage).toHaveBeenCalledTimes(3);
  expect(editImage).toHaveBeenCalledWith(expect.objectContaining({ image: expect.any(Blob), prompt: expect.stringContaining('Existing poster') }), expect.any(AbortSignal));
  expect(editImage.mock.calls.every(([request]) => !Object.hasOwn(request, 'count'))).toBe(true);
  expect(runtime.get(generation.id)?.result?.candidates).toHaveLength(3);
});

it('rejects generation when a persisted context asset is no longer available', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'brief', cost: null }), generateImage: async () => ({ images: [{ base64: 'generated' }], cost: null }) }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1,
      libraryId: input.libraryId ?? 'workspace-1',
      projectId: input.projectId!,
      documentId: input.documentId!,
      brief: 'Brief',
      document: { width: 100, height: 200, currentImageAssetIds: ['missing-canvas'] },
      attachmentAssetIds,
      userMessage: input.message,
      baseRevisionId: null,
    }),
    loadContextImage: async () => null,
  });
  const conversation = await service.submitConversation({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Use the canvas',
  });
  await service.flush();

  await expect(service.submitDesignGeneration({
    libraryId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1',
  })).rejects.toThrow('CONTEXT_ASSET_MISSING');
});

it('tests image generation through the resolved adapter without creating a task', async () => {
  const runtime = createTaskRuntime();
  const generateImage = vi.fn(async (request: { prompt: string; model?: string; size?: string; count?: number }) => ({
    images: [{ base64: 'preview-bytes' }],
    cost: 0.01,
    request,
  }));
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: '', cost: null }), generateImage }),
  });

  const result = await service.testImageGeneration({
    connectionId: 'provider-1',
    prompt: 'A random connection test image',
    model: 'image-model',
    size: '1024x1024',
  });

  expect(result).toEqual({ image: { base64: 'preview-bytes' }, cost: 0.01 });
  expect(generateImage).toHaveBeenCalledWith({ prompt: 'A random connection test image', model: 'image-model', size: '1024x1024', count: 1 });
  expect(runtime.list()).toEqual([]);
});

it('tests conversation through the resolved adapter without creating a task', async () => {
  const runtime = createTaskRuntime();
  const chat = vi.fn(async () => ({ text: 'OK', cost: null }));
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat }),
  });

  const result = await service.testConversation({ connectionId: 'provider-1', model: 'chat-model' });

  expect(result).toEqual({ cost: null });
  expect(chat).toHaveBeenCalledWith({
    messages: [{ role: 'user', content: 'Reply with OK.' }],
    model: 'chat-model',
  });
  expect(runtime.list()).toEqual([]);
});

it('persists a conversation cost when the provider reports one', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'priced response', cost: 0.0123 }) }),
  });
  const task = await service.submitConversation({ projectId: 'project-1', connectionId: 'provider-1', message: 'priced request' });
  await service.flush();
  expect(runtime.get(task.id)).toMatchObject({ state: 'completed', result: { text: 'priced response', cost: 0.0123 } });
});

it('persists the user-visible request text for draft review without credentials', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'brief', cost: null }) }),
  });
  const task = await service.submitConversation({
    source: { kind: 'creation-draft', id: 'creation-2' },
    connectionId: 'provider-1', message: 'Use a restrained editorial layout',
  });
  expect(task.requestText).toBe('Use a restrained editorial layout');
});

it('marks provider failures and supports local cancellation', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => { throw Object.assign(new Error('offline'), { kind: 'http' }); } }),
  });
  const failed = await service.submitConversation({ projectId: 'p', message: 'x', connectionId: 'c' });
  await service.flush();
  expect(runtime.get(failed.id)?.state).toBe('failed');

  const cancellationRuntime = createTaskRuntime();
  let rejectRequest!: (error: Error) => void;
  const cancellation = createAgentTaskService({
    runtime: cancellationRuntime,
    resolveAdapter: async () => ({ chat: async (_request: unknown, signal?: AbortSignal) => new Promise<{ text: string; cost: null }>((_resolve, reject) => {
      rejectRequest = reject;
      signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }) }),
  });
  const running = await cancellation.submitConversation({ projectId: 'p', message: 'x', connectionId: 'c' });
  cancellation.cancel(running.id);
  rejectRequest(new Error('late response'));
  await cancellation.flush();
  expect(cancellationRuntime.get(running.id)?.state).toBe('cancelled');
});

it('binds a conversation to a creation draft without creating a project', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: 'brief', cost: null }) }),
  });
  const task = await service.submitConversation({
    source: { kind: 'creation-draft', id: 'creation-1' },
    connectionId: 'provider-1', message: 'create a poster',
  });
  expect(task.source).toEqual({ kind: 'creation-draft', id: 'creation-1' });
});

it('retries a failed conversation as a new attempt and executes it', async () => {
  const runtime = createTaskRuntime();
  let calls = 0;
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('offline'), { kind: 'http' });
      return { text: 'recovered', cost: null };
    } }),
  });
  const first = await service.submitConversation({ projectId: 'project-1', connectionId: 'provider-1', message: 'retry me' });
  await service.flush();
  expect(runtime.get(first.id)?.state).toBe('failed');
  const retried = await service.retry(first.id);
  expect(retried).toMatchObject({ state: 'running', attempt: 2, requestId: first.requestId });
  await service.flush();
  expect(calls).toBe(2);
  expect(retried && runtime.get(retried.id)).toMatchObject({ state: 'completed', result: { text: 'recovered' } });
  expect(runtime.get(first.id)?.state).toBe('failed');
});

it('runs image generation as a persisted project task and records asset references', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      generateImage: async () => ({ images: [{ url: 'https://cdn.test/generated.png' }], cost: 0.02 }),
    }),
    persistGeneratedImages: async () => ['asset-generated'],
  });
  const task = await service.submitImageGeneration({
    projectId: 'project-1', documentId: 'document-1', baseRevisionId: null,
    designerVersionId: 'designer-v1', connectionId: 'provider-1', prompt: 'A spring market poster', size: '1080x1440', count: 2,
  });
  await service.flush();
  expect(runtime.get(task.id)).toMatchObject({ state: 'completed', capability: 'image-generation', baseRevisionId: null, result: { assetIds: ['asset-generated'], imageCount: 1, cost: 0.02, candidate: { baseRevisionId: null, assetIds: ['asset-generated'] } } });
});

it('stores generated designer artwork without creating a document candidate', async () => {
  const runtime = createTaskRuntime();
  const persistDesignerArtwork = vi.fn(async () => ['artwork-portrait-1']);
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      generateImage: async () => ({ images: [{ base64: 'portrait-bytes' }], cost: 0.01 }),
    }),
    persistDesignerArtwork,
  });
  const artworkService = service as typeof service & {
    submitDesignerArtworkGeneration: (input: {
      source: { kind: 'designer-draft'; id: string };
      connectionId: string;
      prompt: string;
      size?: string;
      count?: number;
    }) => Promise<TaskRecord>;
  };
  expect(artworkService.submitDesignerArtworkGeneration).toBeTypeOf('function');

  const task = await artworkService.submitDesignerArtworkGeneration({
    source: { kind: 'designer-draft', id: 'designer-draft-1' },
    connectionId: 'provider-1',
    prompt: 'An original art director character portrait',
    size: '1024x1024',
    count: 1,
  });
  await service.flush();

  expect(persistDesignerArtwork).toHaveBeenCalledWith(expect.objectContaining({
    designerDraftId: 'designer-draft-1',
    images: [{ base64: 'portrait-bytes' }],
  }));
  expect(runtime.get(task.id)).toMatchObject({
    state: 'completed',
    capability: 'image-generation',
    source: { kind: 'designer-draft', id: 'designer-draft-1' },
    result: { assetIds: ['artwork-portrait-1'], imageCount: 1, cost: 0.01 },
  });
  expect(runtime.get(task.id)?.documentId).toBeUndefined();
  expect(runtime.get(task.id)?.result?.candidate).toBeUndefined();
});

it('records the submitted revision as a candidate base without changing the active document', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: '', cost: null }), generateImage: async () => ({ images: [{ url: 'https://cdn.test/generated.png' }], cost: null }) }),
    persistGeneratedImages: async () => ['asset-candidate'],
  });
  const task = await service.submitImageGeneration({ projectId: 'project-1', documentId: 'document-1', baseRevisionId: 'revision-current', connectionId: 'provider-1', prompt: 'candidate' });
  await service.flush();
  expect(runtime.get(task.id)).toMatchObject({ baseRevisionId: 'revision-current', result: { candidate: { baseRevisionId: 'revision-current', assetIds: ['asset-candidate'] } } });
});

it('runs image editing with an explicit source image and mask', async () => {
  const runtime = createTaskRuntime();
  let receivedImage: Blob | undefined;
  let receivedMask: Blob | undefined;
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage: async (request) => { receivedImage = request.image; receivedMask = request.mask; return { images: [{ base64: 'not-persisted' }], cost: null }; },
    }),
    persistGeneratedImages: async () => ['asset-edited'],
  });
  const task = await service.submitImageEdit({
    projectId: 'project-1', documentId: 'document-1', baseRevisionId: 'revision-1',
    connectionId: 'provider-1', prompt: 'Remove background', image: new Blob(['image']), mask: new Blob(['mask']),
  });
  await service.flush();
  expect(receivedImage).toBeInstanceOf(Blob);
  expect(receivedMask).toBeInstanceOf(Blob);
  expect(runtime.get(task.id)).toMatchObject({ state: 'completed', capability: 'image-editing', result: { assetIds: ['asset-edited'], imageCount: 1 } });
});

it('runs local resize through the task candidate path without a provider connection', async () => {
  const runtime = createTaskRuntime();
  const beforeScene = createScene({ id: 'before-resize', width: 100, height: 100, layers: [{ id: 'photo', type: 'image', assetId: 'asset-source', x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, visible: true, locked: false }] });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => { throw new Error('PROVIDER_MUST_NOT_BE_RESOLVED'); },
    executeLocalImageTool: async () => ({ images: [{ base64: 'resized', mimeType: 'image/png' }], cost: null }),
    persistGeneratedImages: async () => ['asset-resized'],
  });

  const task = await service.submitImageEdit({
    projectId: 'project-1', documentId: 'document-1', baseRevisionId: 'revision-1',
    connectionId: '', prompt: 'Resize locally', image: new Blob(['image']), sourceAssetId: 'asset-source',
    beforeScene, tool: 'resize', toolParams: { width: 200, height: 150, fit: 'contain', format: 'png' },
  });
  await service.flush();
  expect(runtime.get(task.id)).toMatchObject({ state: 'completed', capability: 'local-transform', result: { assetIds: ['asset-resized'] } });
  expect(runtime.get(task.id)?.result?.toolCandidate).toMatchObject({ resultAssetId: 'asset-resized', candidateScene: { width: 200, height: 150 } });
});

it('explicitly retries a failed local resize without resolving a provider', async () => {
  const runtime = createTaskRuntime();
  let calls = 0;
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => { throw new Error('PROVIDER_MUST_NOT_BE_RESOLVED'); },
    executeLocalImageTool: async () => {
      calls += 1;
      if (calls === 1) throw new Error('LOCAL_CODEC_FAILED');
      return { images: [{ base64: 'resized-again', mimeType: 'image/png' }], cost: null };
    },
    loadSourceImage: async () => new Blob(['managed image'], { type: 'image/png' }),
    persistGeneratedImages: async () => ['asset-resized-again'],
  });
  const first = await service.submitImageEdit({
    projectId: 'project-1', documentId: 'document-1', connectionId: '', prompt: 'Resize locally', image: new Blob(['image']), sourceAssetId: 'asset-source',
    tool: 'resize', toolParams: { width: 200, height: 150, format: 'png' },
  });
  await service.flush();
  expect(runtime.get(first.id)?.state).toBe('failed');
  const retried = await service.retry(first.id);
  await service.flush();
  expect(retried).toMatchObject({ capability: 'local-transform', state: 'running', attempt: 2 });
  expect(runtime.get(retried!.id)).toMatchObject({ state: 'completed', result: { assetIds: ['asset-resized-again'] } });
  expect(calls).toBe(2);
});

it('retains the selected image tool and region in the task record', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage: async () => ({ images: [], cost: null }),
    }),
  });
  const task = await service.submitImageEdit({
    projectId: 'project-1', documentId: 'doc-1', connectionId: 'provider-1', prompt: 'Remove object', image: new Blob(['image']),
    tool: 'remove-object', toolParams: { feather: 10 }, region: { x: 0, y: 0, width: 10, height: 20 },
  });
  expect(task).toMatchObject({ tool: 'remove-object', region: { x: 0, y: 0, width: 10, height: 20 } });
});

it('persists and forwards image-tool parameters with an edit task', async () => {
  const runtime = createTaskRuntime();
  const editImage = vi.fn(async () => ({ images: [{ base64: 'cropped' }], cost: null }));
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: '', cost: null }), editImage }),
  });
  const task = await service.submitImageEdit({
    projectId: 'project-1', documentId: 'doc-1', connectionId: 'provider-1', prompt: 'Crop for a square post', image: new Blob(['image']),
    tool: 'smart-crop', toolParams: { width: 1080, height: 1080, focus: 'subject' },
  });
  await service.flush();
  expect(task).toMatchObject({ tool: 'smart-crop', toolParams: { width: 1080, height: 1080, focus: 'subject' } });
  expect(editImage).toHaveBeenCalledWith(expect.objectContaining({
    tool: 'smart-crop', toolParams: { width: 1080, height: 1080, focus: 'subject' },
  }), expect.any(AbortSignal));
});

it('persists provider request metadata on a completed image task', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage: async () => ({ images: [{ base64: 'result' }], cost: 0.02, remoteRequestId: 'req-remote-1', supportsRemoteCancellation: true, supportsStatusQuery: true }),
    }),
    persistGeneratedImages: async () => ['asset-result'],
  });
  const task = await service.submitImageEdit({ projectId: 'project-1', documentId: 'doc-1', connectionId: 'provider-1', prompt: 'edit', image: new Blob(['image']) });
  await service.flush();
  expect(runtime.get(task.id)).toMatchObject({ remoteRequestId: 'req-remote-1', remoteSupportsCancellation: true, remoteSupportsStatusQuery: true });
});

it('rejects unsupported regional provider edits before sending the request', async () => {
  const runtime = createTaskRuntime();
  const editImage = vi.fn(async () => ({ images: [{ base64: 'result' }], cost: null }));
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      toolCapabilities: [{ tool: 'remove-object', supportsMask: false, supportsTransparency: false, supportsRemoteCancellation: false, supportsStatusQuery: false }],
      editImage,
    }),
  });
  const task = await service.submitImageEdit({
    projectId: 'project-1', documentId: 'doc-1', connectionId: 'provider-1', prompt: 'remove object', image: new Blob(['image']), mask: new Blob(['mask']),
    tool: 'remove-object', toolParams: { feather: 10 }, region: { x: 1, y: 1, width: 4, height: 4 },
  });
  await service.flush();
  expect(runtime.get(task.id)).toMatchObject({ state: 'failed', errorCode: 'PROVIDER_MASK_UNSUPPORTED' });
  expect(editImage).not.toHaveBeenCalled();
});

it('marks a remote task unknown when the provider cannot cancel it', async () => {
  const runtime = createTaskRuntime();
  let release: (() => void) | undefined;
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage: async (_request, signal) => await new Promise((resolve, reject) => {
        const complete = () => resolve({ images: [{ base64: 'late' }], cost: null, remoteRequestId: 'remote-running', supportsRemoteCancellation: false });
        const abort = () => reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
        release = complete;
        signal?.addEventListener('abort', abort, { once: true });
      }),
    }),
    persistGeneratedImages: async () => ['asset-late'],
  });
  const task = await service.submitImageEdit({ projectId: 'project-1', documentId: 'doc-1', connectionId: 'provider-1', prompt: 'edit', image: new Blob(['image']) });
  await new Promise((resolve) => setTimeout(resolve, 0));
  runtime.updateRemoteMetadata(task.id, { remoteRequestId: 'remote-running', remoteSupportsCancellation: false, remoteSupportsStatusQuery: false });
  const cancelled = service.cancel(task.id);
  expect(cancelled).toMatchObject({ state: 'unknown', errorCode: 'REMOTE_CANCEL_UNSUPPORTED' });
  release?.();
  await service.flush();
});

it('retries a failed image generation with the image adapter and preserves its capability', async () => {
  const runtime = createTaskRuntime();
  let generationCalls = 0;
  let chatCalls = 0;
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => { chatCalls += 1; throw Object.assign(new Error('wrong adapter'), { kind: 'http' }); },
      generateImage: async () => {
        generationCalls += 1;
        if (generationCalls === 1) throw Object.assign(new Error('offline'), { kind: 'http' });
        return { images: [{ base64: 'generated' }], cost: null };
      },
    }),
    persistGeneratedImages: async () => ['asset-retried'],
  });
  const first = await service.submitImageGeneration({ projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: 'retry image' });
  await service.flush();
  expect(runtime.get(first.id)?.state).toBe('failed');
  const retried = await service.retry(first.id);
  await service.flush();
  expect(retried).toMatchObject({ capability: 'image-generation', state: 'running', attempt: 2 });
  expect(runtime.get(retried!.id)).toMatchObject({ state: 'completed', capability: 'image-generation', result: { assetIds: ['asset-retried'] } });
  expect(generationCalls).toBe(2);
  expect(chatCalls).toBe(0);
});

it('preserves image generation model, size and count across retries', async () => {
  const runtime = createTaskRuntime();
  const requests: Array<{ model?: string; size?: string; count?: number }> = [];
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      generateImage: async (request) => {
        requests.push(request);
        if (requests.length === 1) throw Object.assign(new Error('offline'), { kind: 'http' });
        return { images: [{ base64: 'generated' }], cost: null };
      },
    }),
    persistGeneratedImages: async () => ['asset-retried-params'],
  });
  const first = await service.submitImageGeneration({ projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: 'retry params', model: 'image-model', size: '1024x1024', count: 2 });
  await service.flush();
  await service.retry(first.id);
  await service.flush();
  expect(requests).toEqual([
    { prompt: 'retry params', model: 'image-model', size: '1024x1024', count: 2 },
    { prompt: 'retry params', model: 'image-model', size: '1024x1024', count: 2 },
  ]);
});

it('does not retry image editing without a recoverable source image', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => { throw Object.assign(new Error('wrong adapter'), { kind: 'http' }); },
      editImage: async () => { throw Object.assign(new Error('offline'), { kind: 'http' }); },
    }),
  });
  const first = await service.submitImageEdit({ projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: 'retry edit', image: new Blob(['image']) });
  await service.flush();
  expect(runtime.get(first.id)?.state).toBe('failed');
  await expect(service.retry(first.id)).resolves.toBeUndefined();
  expect(runtime.list()).toHaveLength(1);
  expect(runtime.get(first.id)?.state).toBe('failed');
});

it('retries image editing when its managed source asset can be reloaded', async () => {
  const runtime = createTaskRuntime();
  let calls = 0;
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage: async (request) => {
        calls += 1;
        expect(request.image).toBeInstanceOf(Blob);
        if (calls === 1) throw Object.assign(new Error('offline'), { kind: 'http' });
        return { images: [{ base64: 'retried' }], cost: null };
      },
    }),
    loadSourceImage: async () => new Blob(['managed image'], { type: 'image/png' }),
    persistGeneratedImages: async () => ['asset-retried'],
  });
  const first = await service.submitImageEdit({ projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: 'retry edit', image: new Blob(['image']), sourceAssetId: 'asset-source' });
  await service.flush();
  expect(runtime.get(first.id)?.state).toBe('failed');
  const retried = await service.retry(first.id);
  await service.flush();
  expect(retried).toMatchObject({ capability: 'image-editing', state: 'running', attempt: 2 });
  expect(runtime.get(retried!.id)).toMatchObject({ state: 'completed', result: { assetIds: ['asset-retried'] } });
  expect(calls).toBe(2);
});

it('retries a managed image edit with the original tool parameters', async () => {
  const runtime = createTaskRuntime();
  const requests: Array<{ tool?: string; toolParams?: Record<string, string | number> }> = [];
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage: async (request) => {
        requests.push({ tool: request.tool, toolParams: request.toolParams });
        if (requests.length === 1) throw Object.assign(new Error('offline'), { kind: 'http' });
        return { images: [{ base64: 'retried' }], cost: null };
      },
    }),
    loadSourceImage: async () => new Blob(['managed image'], { type: 'image/png' }),
  });
  const first = await service.submitImageEdit({
    projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: 'crop again',
    image: new Blob(['image']), sourceAssetId: 'asset-source', tool: 'smart-crop',
    toolParams: { width: 1080, height: 1080, focus: 'subject' },
  });
  await service.flush();
  await service.retry(first.id);
  await service.flush();
  expect(requests).toEqual([
    { tool: 'smart-crop', toolParams: { width: 1080, height: 1080, focus: 'subject' } },
    { tool: 'smart-crop', toolParams: { width: 1080, height: 1080, focus: 'subject' } },
  ]);
});

it('persists the before and candidate scenes for a completed image edit', async () => {
  const runtime = createTaskRuntime();
  const beforeScene = createScene({ id: 'before', width: 100, height: 100, layers: [{ id: 'photo', type: 'image', assetId: 'asset-source', x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, visible: true, locked: false }] });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage: async () => ({ images: [{ base64: 'result' }], cost: null }),
    }),
    persistGeneratedImages: async () => ['asset-result'],
  });
  const task = await service.submitImageEdit({
    projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: 'remove background',
    image: new Blob(['image']), sourceAssetId: 'asset-source', tool: 'remove-background', toolParams: { edgeRefinement: 50 },
    beforeScene,
  });
  await service.flush();
  expect(runtime.get(task.id)).toMatchObject({ result: { toolCandidate: { taskId: task.id, tool: 'remove-background', sourceAssetId: 'asset-source', resultAssetId: 'asset-result', beforeScene } } });
  expect(runtime.get(task.id)?.result?.toolCandidate?.candidateScene.layers[0]).toMatchObject({ type: 'image', assetId: 'asset-result' });
});

it('does not retry regional image editing without a persisted mask', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage: async () => { throw Object.assign(new Error('offline'), { kind: 'http' }); },
    }),
    loadSourceImage: async () => new Blob(['managed image'], { type: 'image/png' }),
  });
  const first = await service.submitImageEdit({
    projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: 'regional edit',
    image: new Blob(['image']), sourceAssetId: 'asset-source', mask: new Blob(['mask']),
    region: { x: 1, y: 2, width: 10, height: 12 }, tool: 'remove-object', toolParams: { feather: 10 },
  });
  await service.flush();
  expect(runtime.get(first.id)).toMatchObject({ hasMask: true });
  expect(runtime.get(first.id)?.state).toBe('failed');
  await expect(service.retry(first.id)).resolves.toBeUndefined();
  expect(runtime.list()).toHaveLength(1);
});

it('does not retry image editing when an unpersisted mask was submitted', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage: async () => { throw Object.assign(new Error('offline'), { kind: 'http' }); },
    }),
    loadSourceImage: async () => new Blob(['managed image'], { type: 'image/png' }),
  });
  const first = await service.submitImageEdit({
    projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: 'masked edit',
    image: new Blob(['image']), sourceAssetId: 'asset-source', mask: new Blob(['mask']),
  });
  await service.flush();
  expect(runtime.get(first.id)).toMatchObject({ hasMask: true });
  expect(runtime.get(first.id)?.state).toBe('failed');
  await expect(service.retry(first.id)).resolves.toBeUndefined();
  expect(runtime.list()).toHaveLength(1);
});

it('retries regional image editing only when its managed mask can be reloaded', async () => {
  const runtime = createTaskRuntime();
  let calls = 0;
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage: async (request) => {
        calls += 1;
        expect(request.mask).toBeInstanceOf(Blob);
        if (calls === 1) throw Object.assign(new Error('offline'), { kind: 'http' });
        return { images: [{ base64: 'retried-regional' }], cost: null };
      },
    }),
    loadSourceImage: async () => new Blob(['managed image'], { type: 'image/png' }),
    loadMaskImage: async () => new Blob(['managed mask'], { type: 'image/png' }),
    persistGeneratedImages: async () => ['asset-regional-retry'],
  });
  const first = await service.submitImageEdit({
    projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: 'regional edit',
    image: new Blob(['image']), sourceAssetId: 'asset-source', maskAssetId: 'asset-mask',
    region: { x: 1, y: 2, width: 10, height: 12 }, tool: 'remove-object', toolParams: { feather: 10 },
  });
  await service.flush();
  expect(runtime.get(first.id)).toMatchObject({ hasMask: true, maskAssetId: 'asset-mask', state: 'failed' });
  const retried = await service.retry(first.id);
  await service.flush();
  expect(retried).toMatchObject({ state: 'running', attempt: 2 });
  expect(runtime.get(retried!.id)).toMatchObject({ state: 'completed', result: { assetIds: ['asset-regional-retry'] } });
  expect(calls).toBe(2);
});

it('rejects a missing managed mask before creating an image task', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: '', cost: null }), editImage: async () => ({ images: [], cost: null }) }),
    loadMaskImage: async () => null,
  });
  await expect(service.submitImageEdit({
    projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: 'regional edit',
    image: new Blob(['image']), maskAssetId: 'asset-missing', tool: 'remove-object', toolParams: { feather: 10 },
    region: { x: 1, y: 1, width: 10, height: 10 },
  })).rejects.toThrow('MASK_ASSET_MISSING');
  expect(runtime.list()).toHaveLength(0);
});

it('does not retry a historical masked task without a persisted mask asset id', async () => {
  const runtime = createTaskRuntime({ initialTasks: [{
    id: 'task-masked-legacy', requestId: 'request-masked-legacy', requestText: 'regional edit', state: 'failed',
    cancelRequested: false, attempt: 1, source: { kind: 'project', id: 'project-1' }, documentId: 'document-1',
    sourceAssetId: 'asset-source', hasMask: true, providerId: 'provider-1', capability: 'image-editing',
  }] });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({ chat: async () => ({ text: '', cost: null }), editImage: async () => ({ images: [], cost: null }) }),
    loadSourceImage: async () => new Blob(['managed image'], { type: 'image/png' }),
    loadMaskImage: async () => new Blob(['managed mask'], { type: 'image/png' }),
  });
  await expect(service.retry('task-masked-legacy')).resolves.toBeUndefined();
  expect(runtime.list()).toHaveLength(1);
});

it('fails image tasks that return no generated images', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      generateImage: async () => ({ images: [], cost: null }),
    }),
  });
  const task = await service.submitImageGeneration({ projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: 'empty result' });
  await service.flush();
  expect(runtime.get(task.id)).toMatchObject({ state: 'failed', errorCode: 'IMAGE_RESULT_EMPTY' });
});

it('runs one portfolio vision task that synthesizes every explicit source', async () => {
  const runtime = createTaskRuntime();
  const analyzeVision = vi.fn(async () => ({
    text: JSON.stringify({ candidates: [completePortfolioCandidate({ zh: 'Synthesized candidate', en: 'Synthesized candidate' })] }),
    cost: null,
  }));
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      analyzeVision,
    }),
  });
  const task = await service.submitPortfolioAnalysis({
    source: { kind: 'designer-draft', id: 'designer-draft-vision' },
    connectionId: 'provider-1',
    rightsConfirmed: true,
    sources: [
      { id: 'source-a', description: 'first', image: { url: 'https://img.test/a.png' } },
      { id: 'source-b', description: 'second', image: { url: 'https://img.test/b.png' } },
    ],
  });
  await service.flush();
  expect(analyzeVision).toHaveBeenCalledTimes(1);
  expect(analyzeVision).toHaveBeenCalledWith(expect.objectContaining({
    prompt: expect.stringContaining('1. first'),
    images: [{ url: 'https://img.test/a.png' }, { url: 'https://img.test/b.png' }],
  }), expect.any(AbortSignal));
  expect(runtime.get(task.id)).toMatchObject({
    state: 'completed',
    capability: 'vision-analysis',
    source: { kind: 'designer-draft', id: 'designer-draft-vision' },
    result: { text: expect.stringContaining('Synthesized candidate') },
  });
});

it('persists safe provider diagnostics for failed portfolio analysis without retaining portfolio data', async () => {
  const sourceData = 'cHJpdmF0ZS1wb3J0Zm9saW8taW1hZ2U=';
  const providerMessage = 'The supplied image cannot be processed: private portfolio image';
  const persisted: TaskRecord[][] = [];
  const runtime = createTaskRuntime({ persist: async (tasks) => { persisted.push([...tasks]); } });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      analyzeVision: async () => {
        throw Object.assign(new Error(providerMessage), {
          kind: 'http', status: 400, providerCode: 'invalid_image_format', retryAfterSeconds: 12,
        });
      },
    }),
  });

  const task = await service.submitPortfolioAnalysis({
    source: { kind: 'designer-draft', id: 'designer-draft-diagnostics' }, connectionId: 'provider-1', rightsConfirmed: true,
    sources: [{ id: 'source-a', description: 'Private portfolio cover', image: { base64: sourceData, mimeType: 'image/png' } }],
  });
  await service.flush();

  const serialized = JSON.stringify(persisted.at(-1));
  expect(runtime.get(task.id)).toMatchObject({
    state: 'failed', errorCode: 'http',
    providerFailure: { kind: 'http', status: 400, providerCode: 'invalid_image_format', retryAfterSeconds: 12 },
  });
  expect(serialized).not.toContain(providerMessage);
  expect(serialized).not.toContain(sourceData);
  expect(serialized).not.toContain('Private portfolio cover');
});

it('persists a safe portfolio response diagnostic without retaining rejected response or source data', async () => {
  const sourceData = 'cHJpdmF0ZS1wb3J0Zm9saW8taW1hZ2U=';
  const rejectedResponse = '{bad json';
  const persisted: TaskRecord[][] = [];
  const runtime = createTaskRuntime({ persist: async (tasks) => { persisted.push([...tasks]); } });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      analyzeVision: async () => ({ text: rejectedResponse, cost: null }),
    }),
  });

  const task = await service.submitPortfolioAnalysis({
    source: { kind: 'designer-draft', id: 'designer-draft-invalid-response' }, connectionId: 'provider-1', rightsConfirmed: true,
    sources: [{ id: 'source-a', description: 'Private portfolio cover', image: { base64: sourceData, mimeType: 'image/png' } }],
  });
  await service.flush();

  expect(runtime.get(task.id)).toMatchObject({
    state: 'failed',
    errorCode: 'VISION_ANALYSIS_INVALID_RESPONSE',
    analysisDiagnostic: 'payload.invalid_json',
  });
  const serialized = JSON.stringify(persisted.at(-1));
  expect(serialized).not.toContain(rejectedResponse);
  expect(serialized).not.toContain(sourceData);
  expect(serialized).not.toContain('Private portfolio cover');
});

it('does not persist provider codes that resemble credentials', async () => {
  const runtime = createTaskRuntime();
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      analyzeVision: async () => {
        throw Object.assign(new Error('request failed'), { kind: 'http', status: 400, providerCode: 'sk-private_provider_code_1234567890' });
      },
    }),
  });

  const task = await service.submitPortfolioAnalysis({
    source: { kind: 'designer-draft', id: 'designer-draft-sensitive-code' }, connectionId: 'provider-1', rightsConfirmed: true,
    sources: [{ id: 'source-a', description: 'Portfolio cover', image: { url: 'https://img.test/a.png' } }],
  });
  await service.flush();

  expect(runtime.get(task.id)?.providerFailure).toEqual({ kind: 'http', status: 400 });
});

it('fails closed when a provider candidate echoes portfolio source data', async () => {
  const sourceDescription = 'Private portfolio cover composition';
  const sourceBytes = 'cHJpdmF0ZS1yYXctcG9ydGZvbGlvLWltYWdlLWJ5dGVz';
  const sourceUrl = 'https://private.test/portfolio.png';
  const persisted: TaskRecord[][] = [];
  const runtime = createTaskRuntime({ persist: async (tasks) => { persisted.push([...tasks]); } });
  const service = createAgentTaskService({
    runtime,
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      analyzeVision: async () => ({ text: JSON.stringify({
        candidates: [completePortfolioCandidate(
          { zh: sourceDescription, en: sourceDescription },
          { summary: { zh: sourceBytes, en: sourceBytes }, artworkUrl: sourceUrl },
        )],
      }), cost: null }),
    }),
  });
  const task = await service.submitPortfolioAnalysis({
    source: { kind: 'designer-draft', id: 'designer-draft-metadata' }, connectionId: 'provider-1', rightsConfirmed: true,
    sources: [
      { id: 'selected-source', description: sourceDescription, image: { base64: sourceBytes, mimeType: 'image/png' } },
      { id: 'selected-remote-source', description: 'Private remote portfolio image', image: { url: sourceUrl } },
    ],
  });
  await service.flush();

  const serialized = JSON.stringify(persisted.at(-1));
  expect(persisted.at(-1)?.[0]).toMatchObject({ portfolio: { sourceIds: ['selected-source', 'selected-remote-source'], rightsConfirmed: true } });
  expect(runtime.get(task.id)).toMatchObject({ state: 'failed', errorCode: 'PORTFOLIO_RESPONSE_SOURCE_DATA' });
  expect(serialized).not.toContain(sourceBytes);
  expect(serialized).not.toContain(sourceDescription);
  expect(serialized).not.toContain(sourceUrl);
});
