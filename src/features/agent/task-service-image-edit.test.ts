import { expect, it, vi } from 'vitest';

import type { ImageRequest } from '../providers/adapter';
import { createTaskRuntime } from '../tasks/runtime';
import { createAgentTaskService } from './task-service';
import { createScene } from '../canvas/scene';

it('loads a managed source image before executing an image edit', async () => {
  const source = new Blob(['source'], { type: 'image/png' });
  const editImage = vi.fn(async (request: ImageRequest) => {
    void request;
    return {
      images: [{ base64: 'cmVzdWx0', mimeType: 'image/png' }],
      cost: null,
    };
  });
  const loadSourceImage = vi.fn(async () => source);
  const service = createAgentTaskService({
    runtime: createTaskRuntime(),
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage,
    }),
    loadSourceImage,
    persistGeneratedImages: async () => ['asset-result'],
  });

  await service.submitImageEdit({
    projectId: 'project-1',
    connectionId: 'provider-1',
    prompt: 'remove background',
    sourceAssetId: 'asset-source',
    tool: 'remove-background',
    toolParams: { edgeRefinement: 50 },
  } as never);
  await service.flush();

  expect(loadSourceImage).toHaveBeenCalledWith({ projectId: 'project-1', assetId: 'asset-source' });
  expect(editImage).toHaveBeenCalledWith(expect.objectContaining({ image: source }), expect.any(AbortSignal));
});

it('loads a managed replacement background as an image reference', async () => {
  const source = new Blob(['source'], { type: 'image/png' });
  const background = new Blob(['background'], { type: 'image/jpeg' });
  const editImage = vi.fn(async () => ({
    images: [{ base64: 'cmVzdWx0', mimeType: 'image/png' }],
    cost: null,
  }));
  const loadSourceImage = vi.fn(async ({ assetId }: { assetId: string }) => assetId === 'asset-background' ? background : source);
  const service = createAgentTaskService({
    runtime: createTaskRuntime(),
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage,
    }),
    loadSourceImage,
    persistGeneratedImages: async () => ['asset-result'],
  });

  await service.submitImageEdit({
    projectId: 'project-1',
    connectionId: 'provider-1',
    prompt: 'replace background',
    sourceAssetId: 'asset-source',
    tool: 'replace-background',
    toolParams: { source: 'asset', backgroundAssetId: 'asset-background', lighting: 'match-original' },
  });
  await service.flush();

  expect(loadSourceImage).toHaveBeenCalledWith({ projectId: 'project-1', assetId: 'asset-background' });
  expect(editImage).toHaveBeenCalledWith(expect.objectContaining({
    image: source,
    referenceImages: [background],
  }), expect.any(AbortSignal));
});

it('persists the selected target layer as the source design anchor', async () => {
  const service = createAgentTaskService({
    runtime: createTaskRuntime(),
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage: async () => ({ images: [{ base64: 'cmVzdWx0', mimeType: 'image/png' }], cost: null }),
    }),
    loadSourceImage: async () => new Blob(['source'], { type: 'image/png' }),
    persistGeneratedImages: async () => ['asset-result'],
  });

  const task = await service.submitImageEdit({
    projectId: 'project-1',
    connectionId: 'provider-1',
    prompt: 'remove background',
    sourceAssetId: 'asset-source',
    targetLayerId: 'design-selected',
    tool: 'remove-background',
    toolParams: { edgeRefinement: 50 },
  } as never);

  expect(task.sourceDesignId).toBe('design-selected');
});

it('rejects submission when the managed source image is unavailable', async () => {
  const service = createAgentTaskService({
    runtime: createTaskRuntime(),
    resolveAdapter: async () => ({ chat: async () => ({ text: '', cost: null }) }),
    loadSourceImage: async () => null,
  });

  await expect(service.submitImageEdit({
    projectId: 'project-1',
    connectionId: 'provider-1',
    prompt: 'remove background',
    sourceAssetId: 'asset-missing',
  } as never)).rejects.toThrow('SOURCE_ASSET_MISSING');
});

it('persists an image tool result in the same task row as its placeholder', async () => {
  const persisted: Array<{ sourceTaskId: string }> = [];
  const service = createAgentTaskService({
    runtime: createTaskRuntime(),
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage: async () => ({ images: [{ base64: 'cmVzdWx0', mimeType: 'image/png' }], cost: null }),
    }),
    loadSourceImage: async () => new Blob(['source'], { type: 'image/png' }),
    persistGeneratedImages: async () => ['asset-result'],
    persistProjectDesigns: async ({ designs }) => { persisted.push(...designs); },
  });

  const task = await service.submitImageEdit({
    projectId: 'project-1',
    connectionId: 'provider-1',
    prompt: 'remove background',
    sourceAssetId: 'asset-source',
    tool: 'remove-background',
    toolParams: { edgeRefinement: 50 },
    projectDesign: {
      sourceTaskId: 'generation-source',
      width: 800,
      height: 600,
      title: '商品图（去除背景）',
    },
  });
  await service.flush();

  expect(persisted).toHaveLength(1);
  expect(persisted[0]?.sourceTaskId).toBe(task.id);
});

it('persists the project design output after an explicit image tool retry', async () => {
  let attempt = 0;
  const background = new Blob(['background'], { type: 'image/jpeg' });
  const editImage = vi.fn(async () => {
    attempt += 1;
    if (attempt === 1) throw new Error('PROVIDER_UNAVAILABLE');
    return { images: [{ base64: 'cmVzdWx0', mimeType: 'image/png' }], cost: null };
  });
  const loadSourceImage = vi.fn(async ({ assetId }: { assetId: string }) => assetId === 'asset-background'
    ? background
    : new Blob(['source'], { type: 'image/png' }));
  const persisted: Array<{ sourceTaskId: string; sourceConversationTaskId?: string; width: number; height: number; title: string }> = [];
  const service = createAgentTaskService({
    runtime: createTaskRuntime(),
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage,
    }),
    loadSourceImage,
    persistGeneratedImages: async () => ['asset-retried'],
    persistProjectDesigns: async ({ designs }) => { persisted.push(...designs); },
  });

  const failed = await service.submitImageEdit({
    projectId: 'project-1',
    connectionId: 'provider-1',
    prompt: 'replace background',
    sourceAssetId: 'asset-source',
    sourceDesignId: 'design-source',
    tool: 'replace-background',
    toolParams: { source: 'asset', backgroundAssetId: 'asset-background', lighting: 'match-original' },
    projectDesign: {
      sourceTaskId: 'generation-source',
      sourceConversationTaskId: 'conversation-source',
      width: 800,
      height: 600,
      title: '商品图（去除背景）',
    },
  });
  await service.flush();
  expect(service.getTask(failed.id)?.state).toBe('failed');

  const retried = await service.retry(failed.id);
  await service.flush();

  expect(retried).toBeDefined();
  expect(loadSourceImage.mock.calls.filter(([input]) => input.assetId === 'asset-background')).toHaveLength(2);
  expect(editImage).toHaveBeenNthCalledWith(2, expect.objectContaining({ referenceImages: [background] }), expect.any(AbortSignal));
  expect(persisted).toEqual([expect.objectContaining({
    sourceTaskId: retried!.id,
    sourceConversationTaskId: 'conversation-source',
    width: 800,
    height: 600,
    title: '商品图（去除背景）',
  })]);
});

it('builds an expanded candidate as one full-canvas result image', async () => {
  const service = createAgentTaskService({
    runtime: createTaskRuntime(),
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage: async () => ({ images: [{ base64: 'cmVzdWx0', mimeType: 'image/png' }], cost: null, remoteRequestId: 'request-expand-1' }),
    }),
    loadSourceImage: async () => new Blob(['source'], { type: 'image/png' }),
    persistGeneratedImages: async () => ['asset-expanded'],
    persistProjectDesigns: async () => undefined,
  });
  const beforeScene = createScene({
    id: 'scene-source',
    width: 200,
    height: 100,
    layers: [{ id: 'selected-design', type: 'image', assetId: 'asset-source', x: 0, y: 0, width: 200, height: 100, rotation: 0, opacity: 1, visible: true, locked: false }],
  });

  const task = await service.submitImageEdit({
    projectId: 'project-1',
    connectionId: 'provider-1',
    prompt: 'expand',
    sourceAssetId: 'asset-source',
    targetLayerId: 'selected-design',
    beforeScene,
    tool: 'expand',
    toolParams: { mode: 'original-scene', top: 10, right: 20, bottom: 30, left: 40 },
    projectDesign: { sourceTaskId: 'source-task', width: 260, height: 140, title: 'Expanded' },
  });
  await service.flush();

  expect(service.getTask(task.id)?.result?.toolCandidate?.candidateScene).toMatchObject({
    width: 260,
    height: 140,
    layers: [{ assetId: 'asset-expanded', x: 0, y: 0, width: 260, height: 140 }],
  });
  expect(service.getTask(task.id)?.result?.toolCandidate?.remoteRequestId).toBe('request-expand-1');
});

it('normalizes provider images before validation and persistence', async () => {
  let validatedBase64: string | undefined;
  let persistedBase64: string | undefined;
  const options: Parameters<typeof createAgentTaskService>[0] = {
    runtime: createTaskRuntime(),
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      editImage: async () => ({ images: [{ base64: 'b3JpZ2luYWw=', mimeType: 'image/png' }], cost: null }),
    }),
    loadSourceImage: async () => new Blob(['source'], { type: 'image/png' }),
    normalizeImageResult: async (_input, images) => images.map(() => ({
      base64: 'bm9ybWFsaXplZA==',
      mimeType: 'image/png',
    })),
    validateImageResult: async (_input, images) => {
      validatedBase64 = images[0]?.base64;
    },
    persistGeneratedImages: async ({ images }) => {
      persistedBase64 = images[0]?.base64;
      return ['asset-result'];
    },
  };
  const service = createAgentTaskService(options);

  await service.submitImageEdit({
    projectId: 'project-1',
    connectionId: 'provider-1',
    prompt: 'expand',
    sourceAssetId: 'asset-source',
    tool: 'expand',
    toolParams: { mode: 'original-scene', top: 10, right: 10, bottom: 10, left: 10 },
  });
  await service.flush();

  expect(validatedBase64).toBe('bm9ybWFsaXplZA==');
  expect(persistedBase64).toBe('bm9ybWFsaXplZA==');
});
