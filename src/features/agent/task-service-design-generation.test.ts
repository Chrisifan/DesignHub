import { expect, it, vi } from 'vitest';

import type { ImageRequest } from '../providers/adapter';
import { createTaskRuntime } from '../tasks/runtime';
import type { TaskRecord } from '../tasks/state';
import type { ProjectGenerationRatio } from '../projects/size';
import { createAgentTaskService } from './task-service';

const parentConversation = (): TaskRecord => ({
  id: 'conversation-1',
  requestId: 'request-1',
  requestText: 'Create a poster',
  state: 'completed',
  cancelRequested: false,
  attempt: 1,
  source: { kind: 'project', id: 'project-1' },
  capability: 'conversation',
  analysisThreadId: 'thread-1',
  visualContextPlan: { version: 1, items: [], clarificationRequired: false },
  designContext: {
    version: 1,
    libraryId: 'library-1',
    projectId: 'project-1',
    brief: '',
    canvas: { width: 1350, height: 1800, currentImageAssetIds: [] },
    attachmentAssetIds: [],
    userMessage: 'Create a poster',
    baseRevisionId: null,
  },
  result: { text: 'Use a strong headline.' },
});

const generatedSize = async (generationRatio: ProjectGenerationRatio): Promise<string | undefined> => {
  const generateImage = vi.fn(async (request: ImageRequest) => {
    void request;
    return { images: [{ base64: 'aW1hZ2U=', mimeType: 'image/png' }], cost: null };
  });
  const service = createAgentTaskService({
    runtime: createTaskRuntime({ initialTasks: [parentConversation()] }),
    resolveAdapter: async () => ({
      chat: async () => ({ text: '', cost: null }),
      generateImage,
    }),
    persistGeneratedImages: async () => ['asset-1'],
  });

  await service.submitDesignGeneration({
    libraryId: 'library-1',
    projectId: 'project-1',
    conversationTaskId: 'conversation-1',
    connectionId: 'openai-compatible',
    generationRatio,
    count: 1,
  });
  await service.flush();

  return generateImage.mock.calls[0]?.[0].size;
};

it('keeps the source canvas dimensions for original-image generation', async () => {
  expect(await generatedSize('original')).toBe('1350x1800');
});

it('uses the selected fixed ratio dimensions for design generation', async () => {
  expect(await generatedSize('1:1')).toBe('1080x1080');
});
