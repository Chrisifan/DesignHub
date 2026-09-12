import { expect, it, vi } from 'vitest';

import { createTaskRuntime } from '../tasks/runtime';
import { createAgentTaskService } from './task-service';

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
    tool: 'remove-object', region: { x: 0, y: 0, width: 10, height: 20 },
  });
  expect(task).toMatchObject({ tool: 'remove-object', region: { x: 0, y: 0, width: 10, height: 20 } });
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
    region: { x: 1, y: 2, width: 10, height: 12 }, tool: 'remove-object',
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

it('runs a dedicated portfolio vision task for each explicit source', async () => {
  const runtime = createTaskRuntime();
  const analyzeVision = vi.fn(async (request: { prompt: string; image: { url: string } | { base64: string; mimeType?: string } }) => ({
    text: JSON.stringify({ candidates: [{ name: { zh: "url" in request.image ? request.image.url : request.image.base64, en: "url" in request.image ? request.image.url : request.image.base64 } }] }),
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
    sources: [
      { id: 'source-a', description: 'first', image: { url: 'https://img.test/a.png' } },
      { id: 'source-b', description: 'second', image: { url: 'https://img.test/b.png' } },
    ],
  });
  await service.flush();
  expect(analyzeVision).toHaveBeenCalledTimes(2);
  expect(runtime.get(task.id)).toMatchObject({
    state: 'completed',
    capability: 'vision-analysis',
    source: { kind: 'designer-draft', id: 'designer-draft-vision' },
    result: { text: expect.stringContaining('https://img.test/a.png') },
  });
});
