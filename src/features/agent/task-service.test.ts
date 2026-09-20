import { expect, it, vi } from 'vitest';

import { createTaskRuntime } from '../tasks/runtime';
import type { TaskRecord } from '../tasks/state';
import { createAgentTaskService } from './task-service';

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

  expect(chat).toHaveBeenCalledWith({ messages: [{ role: 'user', content: expect.arrayContaining([
    { type: 'text', text: '按参考图调整' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw==' } },
  ]) }] }, expect.any(AbortSignal));
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
      version: 1, workspaceId: input.workspaceId ?? 'workspace-1', projectId: input.projectId!, documentId: input.documentId!,
      brief: '固定 brief', document: { width: 100, height: 200, currentImageAssetIds: [] }, attachmentAssetIds,
      userMessage: input.message, designerSnapshot: { styleDna: { palette: ['#111'] }, negativeRules: ['avoid neon'] }, baseRevisionId: null,
    }),
    persistConversationAttachments: async ({ attachments }) => attachments.map((attachment) => attachment.name),
    loadContextImage: async ({ assetId }) => ({ name: assetId, mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }),
  });
  const first = await service.submitConversation({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: '第一轮', attachments: [{ name: 'one.png', mimeType: 'image/png', bytes: new Uint8Array([1]) }] });
  await service.flush();
  const second = await service.submitConversation({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', analysisThreadId: first.analysisThreadId, conversationParentTaskId: first.id, connectionId: 'provider-1', message: '第二轮', referencedAssetIds: ['candidate.png'] });
  await service.flush();

  expect(runtime.get(second.id)).toMatchObject({ analysisThreadId: first.analysisThreadId, conversationParentTaskId: first.id, progressText: '流式分析' });
  const secondRequest = requests[1]!;
  const messages = secondRequest.messages as Array<{ content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>;
  expect(messages.map((message) => typeof message.content === 'string' ? message.content : message.content[0]?.type === 'text' ? message.content[0].text : undefined)).toEqual(expect.arrayContaining(['第一轮', '第二轮']));
  expect(messages.at(-1)?.content).toEqual(expect.arrayContaining([{ type: 'image_url', image_url: { url: 'data:image/png;base64,AQID' } }]));
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
      workspaceId: input.workspaceId ?? 'workspace-1',
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
    workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1',
    connectionId: 'provider-1', message: 'Make a calm poster', attachments: [],
  });
  await service.flush();
  const generation = await service.submitDesignGeneration({
    workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1',
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
      workspaceId: input.workspaceId!,
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
    workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Poster',
  });
  await service.flush();
  const generation = await service.submitDesignGeneration({
    workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1',
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
      version: 1, workspaceId: input.workspaceId!, projectId: input.projectId!, documentId: input.documentId!, brief: 'Brief',
      document: { width: 100, height: 100, currentImageAssetIds: [] }, attachmentAssetIds, userMessage: input.message, baseRevisionId: null,
    }),
    persistGeneratedImages: async ({ images }) => [`asset-${'base64' in images[0]! ? images[0].base64 : 'url'}`],
  });
  const conversation = await service.submitConversation({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Poster' });
  await service.flush();
  const generation = await service.submitDesignGeneration({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
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
      version: 1, workspaceId: input.workspaceId!, projectId: input.projectId!, documentId: input.documentId!, brief: 'Brief',
      document: { width: 100, height: 100, currentImageAssetIds: [] }, attachmentAssetIds, userMessage: input.message, baseRevisionId: null,
    }),
    persistGeneratedImages: async ({ images }) => [`asset-${'base64' in images[0]! ? images[0].base64 : 'url'}`],
  });
  const conversation = await service.submitConversation({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Poster' });
  await service.flush();
  const generation = await service.submitDesignGeneration({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
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
      version: 1, workspaceId: input.workspaceId!, projectId: input.projectId!, documentId: input.documentId!, brief: 'Brief',
      document: { width: 100, height: 100, currentImageAssetIds: [] }, attachmentAssetIds, userMessage: input.message, baseRevisionId: null,
    }),
  });
  const conversation = await service.submitConversation({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Poster' });
  await service.flush();
  const generation = await service.submitDesignGeneration({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
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
      version: 1, workspaceId: input.workspaceId!, projectId: input.projectId!, documentId: input.documentId!, brief: 'Immutable brief',
      document: { width: 100, height: 100, currentImageAssetIds: [] }, attachmentAssetIds, userMessage: input.message, baseRevisionId: 'revision-1',
    }),
    persistGeneratedImages: async ({ images }) => [`asset-${'base64' in images[0]! ? images[0].base64 : 'url'}`],
  });
  const conversation = await service.submitConversation({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Poster' });
  await service.flush();
  const generation = await service.submitDesignGeneration({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
  await service.flush();

  await service.retryDesignGenerationSlot({ workspaceId: 'workspace-1', taskId: generation.id, slotId: 'composition' });
  await service.flush();

  expect(generateImage).toHaveBeenCalledTimes(4);
  expect(generateImage.mock.calls[3]?.[0].prompt).toContain('构图探索');
  expect(runtime.get(generation.id)?.generationSlots?.find((slot) => slot.id === 'primary')).toMatchObject({ state: 'completed', attempt: 1 });
  expect(runtime.get(generation.id)?.generationSlots?.find((slot) => slot.id === 'composition')).toMatchObject({ state: 'completed', attempt: 2 });
  expect(runtime.get(generation.id)?.generationSlots?.find((slot) => slot.id === 'expressive')).toMatchObject({ state: 'completed', attempt: 1 });
  await expect(service.retryDesignGenerationSlot({ workspaceId: 'workspace-2', taskId: generation.id, slotId: 'composition' })).rejects.toThrow('WORKSPACE_CONTEXT_MISMATCH');
  await expect(service.retryDesignGenerationSlot({ workspaceId: 'workspace-1', taskId: generation.id, slotId: 'primary' })).rejects.toThrow('GENERATION_SLOT_NOT_RETRYABLE');
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
      version: 1, workspaceId: input.workspaceId!, projectId: input.projectId!, documentId: input.documentId!, brief: 'Brief',
      document: { width: 100, height: 100, currentImageAssetIds: [] }, attachmentAssetIds, userMessage: input.message, baseRevisionId: null,
    }),
    persistGeneratedImages: async ({ images }) => [`asset-${'base64' in images[0]! ? images[0].base64 : 'url'}`],
  });
  const conversation = await service.submitConversation({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Poster' });
  await service.flush();
  const generation = await service.submitDesignGeneration({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
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
    resolveAdapter: async () => ({ chat: async () => ({ text: 'Use the supplied references.', cost: null }), generateImage }),
    resolveDesignContext: async ({ input, attachmentAssetIds }) => ({
      version: 1,
      workspaceId: input.workspaceId ?? 'workspace-1',
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
    workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1',
    message: 'Use both reference images',
    attachments: [
      { name: 'one.png', mimeType: 'image/png', bytes: new Uint8Array([1]) },
      { name: 'two.png', mimeType: 'image/png', bytes: new Uint8Array([2]) },
    ],
  });
  await service.flush();
  await service.submitDesignGeneration({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
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
      workspaceId: input.workspaceId ?? 'workspace-1',
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

  const conversation = await service.submitConversation({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Create a poster' });
  await service.flush();
  await service.submitDesignGeneration({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
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
      workspaceId: input.workspaceId ?? 'workspace-1',
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
  await service.submitConversation({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Make a poster' });
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
      workspaceId: input.workspaceId ?? 'workspace-1', projectId: input.projectId!, documentId: input.documentId!,
      brief: 'Existing poster', document: { width: 100, height: 200, currentImageAssetIds: ['canvas-asset'] },
      attachmentAssetIds, userMessage: input.message, baseRevisionId: null,
      designerSnapshot: { id: 'designer-v1', styleDna: { palette: ['#111'] } },
    }),
    loadSourceImage: async () => new Blob(['canvas']),
    persistGeneratedImages: async () => ['asset-edited'],
  });
  const conversation = await service.submitConversation({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Refine this poster' });
  await service.flush();
  const generation = await service.submitDesignGeneration({ workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1' });
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
      workspaceId: input.workspaceId ?? 'workspace-1',
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
    workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', message: 'Use the canvas',
  });
  await service.flush();

  await expect(service.submitDesignGeneration({
    workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', conversationTaskId: conversation.id, connectionId: 'provider-1',
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
