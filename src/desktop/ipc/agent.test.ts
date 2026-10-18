import { expect, it } from 'vitest';

import * as agentIpc from './agent';
import { createConversationHandler, cancelTaskHandler, createDesignGenerationHandler, createDesignGenerationSlotRetryHandler, createImageEditHandler, createImageGenerationHandler, createImageGenerationTestHandler, retryTaskHandler, createPortfolioAnalysisHandler } from './agent';
import type { TaskRecord } from '../../features/tasks/state';

const makeFixture = (url: string) => {
  const mainFrame = { url };
  const webContents = { mainFrame, getURL: () => url };
  return { event: { sender: webContents, senderFrame: mainFrame }, window: { webContents } };
};

const task: TaskRecord = { id: 'task-1', requestId: 'request-1', state: 'running', cancelRequested: false, attempt: 1 };

it('accepts a conversation only from the active trusted workspace', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1' } };
  const submit = createConversationHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.message).toBe('hello');
    return task;
  });
  await expect(submit(fixture.event, { libraryId: 'workspace-1', projectId: 'project-1', connectionId: 'provider-1', message: 'hello' })).resolves.toEqual(task);
  await expect(submit(fixture.event, { libraryId: 'workspace-2', projectId: 'project-1', connectionId: 'provider-1', message: 'hello' })).resolves.toBeNull();
});

it('accepts bounded image attachments on a conversation', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1' } };
  const attachments = [{ name: 'reference.png', mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }];
  const submit = createConversationHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.attachments).toEqual(attachments);
    return task;
  });
  await expect(submit(fixture.event, { libraryId: 'workspace-1', projectId: 'project-1', connectionId: 'provider-1', message: 'hello', attachments })).resolves.toEqual(task);
  await expect(submit(fixture.event, { libraryId: 'workspace-1', projectId: 'project-1', connectionId: 'provider-1', message: 'hello', attachments: [{ ...attachments[0], mimeType: 'text/plain' }] })).resolves.toBeNull();
});

it('accepts design generation only for a writable active workspace', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1', openMode: 'writable' } };
  const submit = createDesignGenerationHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.conversationTaskId).toBe('conversation-1');
    return task;
  });
  await expect(submit(fixture.event, { libraryId: 'workspace-1', projectId: 'project-1', conversationTaskId: 'conversation-1', connectionId: 'provider-1', baseRevisionId: null })).resolves.toEqual(task);
  await expect(submit(fixture.event, { libraryId: 'workspace-1', projectId: 'project-1', conversationTaskId: 'conversation-1', connectionId: 'provider-1', baseRevisionId: null })).resolves.toEqual(task);
  await expect(submit(fixture.event, { libraryId: 'workspace-2', projectId: 'project-1', conversationTaskId: 'conversation-1', connectionId: 'provider-1' })).resolves.toBeNull();
});

it('retries only a known generation slot in the active writable workspace', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1', openMode: 'writable' } };
  const retry = createDesignGenerationSlotRetryHandler(
    fixture.window,
    'http://localhost:5173/?preview=1',
    () => workspace as never,
    async (_workspace, input) => ({ ...task, id: input.taskId }),
  );
  await expect(retry(fixture.event, { libraryId: 'workspace-1', taskId: 'design-1', slotId: 'composition' })).resolves.toMatchObject({ id: 'design-1' });
  await expect(retry(fixture.event, { libraryId: 'workspace-1', taskId: 'design-1', slotId: 'unknown' })).resolves.toBeNull();
  await expect(retry(fixture.event, { libraryId: 'workspace-2', taskId: 'design-1', slotId: 'composition' })).resolves.toBeNull();
});

it('accepts conversation connection tests only from the active trusted workspace', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1' } };
  const conversationTestIpc = agentIpc as typeof agentIpc & {
    conversationTestChannel: string;
    createConversationTestHandler: (
      window: never,
      trustedUrl: string,
      getLibrary: () => never,
      submit: (workspace: never, input: { connectionId: string; model?: string }) => Promise<{ cost: number | null }>,
    ) => (event: never, input: unknown) => Promise<{ cost: number | null } | null>;
  };
  expect(conversationTestIpc.conversationTestChannel).toBe('agent:conversation-test');
  expect(conversationTestIpc.createConversationTestHandler).toBeTypeOf('function');
  const submit = conversationTestIpc.createConversationTestHandler(
    fixture.window as never,
    'http://localhost:5173/?preview=1',
    () => workspace as never,
    async (_workspace, input) => {
      expect(input).toEqual({ libraryId: 'workspace-1', connectionId: 'provider-1', model: 'chat-model' });
      return { cost: null };
    },
  );
  await expect(submit(fixture.event as never, { libraryId: 'workspace-1', connectionId: 'provider-1', model: 'chat-model' })).resolves.toEqual({ cost: null });
  await expect(submit(fixture.event as never, { libraryId: 'workspace-2', connectionId: 'provider-1', model: 'chat-model' })).resolves.toBeNull();
  await expect(submit(fixture.event as never, { libraryId: 'workspace-1', connectionId: ' ', model: 'chat-model' })).resolves.toBeNull();
});

it('rejects blank conversation input and forwards explicit cancellation', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1' } };
  let cancelled = '';
  const submit = createConversationHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async () => task);
  await expect(submit(fixture.event, { libraryId: 'workspace-1', projectId: 'p', connectionId: 'c', message: ' ' })).resolves.toBeNull();
  const cancel = cancelTaskHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, taskId) => { cancelled = taskId; return true; });
  await expect(cancel(fixture.event, { libraryId: 'workspace-1', taskId: 'task-1' })).resolves.toBe(true);
  expect(cancelled).toBe('task-1');
});

it('accepts an explicit creation-draft source', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1' } };
  const submit = createConversationHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.source).toEqual({ kind: 'creation-draft', id: 'creation-1' });
    return task;
  });
  await expect(submit(fixture.event, { libraryId: 'workspace-1', source: { kind: 'creation-draft', id: 'creation-1' }, connectionId: 'provider-1', message: 'brief' })).resolves.toEqual(task);
});

it('retries only through the active trusted workspace', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1' } };
  const retry = retryTaskHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, taskId) => ({ ...task, id: `${taskId}-retry`, state: 'running' }));
  await expect(retry(fixture.event, { libraryId: 'workspace-1', taskId: 'task-1' })).resolves.toMatchObject({ id: 'task-1-retry' });
  await expect(retry(fixture.event, { libraryId: 'workspace-2', taskId: 'task-1' })).resolves.toBeNull();
});

it('accepts image generation and edit only with validated project bindings', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1', openMode: 'writable' } };
  const generated = createImageGenerationHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.prompt).toBe('poster');
    return task;
  });
  await expect(generated(fixture.event, { libraryId: 'workspace-1', projectId: 'project-1', connectionId: 'provider-1', prompt: 'poster' })).resolves.toEqual(task);
  await expect(generated(fixture.event, { libraryId: 'workspace-1', projectId: 'project-1', connectionId: 'provider-1', prompt: ' ' })).resolves.toBeNull();
  const edited = createImageEditHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.sourceAssetId).toBe('asset-1');
    return task;
  });
  await expect(edited(fixture.event, { libraryId: 'workspace-1', projectId: 'project-1', connectionId: 'provider-1', prompt: 'remove', sourceAssetId: 'asset-1' })).resolves.toEqual(task);
  await expect(edited(fixture.event, { libraryId: 'workspace-1', projectId: 'project-1', connectionId: 'provider-1', prompt: 'remove background', sourceAssetId: 'asset-1', tool: 'remove-background', toolParams: { edgeRefinement: 50 } })).resolves.toEqual(task);
});

it('accepts image edits by managed source asset without renderer blobs', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1', openMode: 'writable' } };
  const submit = createImageEditHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.sourceAssetId).toBe('asset-1');
    expect(input).not.toHaveProperty('image');
    return task;
  });

  await expect(submit(fixture.event, {
    libraryId: 'workspace-1',
    projectId: 'project-1',
    connectionId: 'provider-1',
    prompt: 'remove background',
    sourceAssetId: 'asset-1',
    tool: 'remove-background',
    toolParams: { edgeRefinement: 50 },
  })).resolves.toEqual(task);
  await expect(submit(fixture.event, {
    libraryId: 'workspace-1',
    projectId: 'project-1',
    connectionId: 'provider-1',
    prompt: 'remove background',
    tool: 'remove-background',
    toolParams: { edgeRefinement: 50 },
  })).resolves.toBeNull();
});

it('accepts image generation connection tests only from the active trusted workspace', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1' } };
  const result = { image: { base64: 'preview-bytes' }, cost: null };
  const submit = createImageGenerationTestHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.connectionId).toBe('provider-1');
    return result;
  });
  await expect(submit(fixture.event, { libraryId: 'workspace-1', connectionId: 'provider-1', prompt: 'test image' })).resolves.toEqual(result);
  await expect(submit(fixture.event, { libraryId: 'workspace-2', connectionId: 'provider-1', prompt: 'test image' })).resolves.toBeNull();
  await expect(submit(fixture.event, { libraryId: 'workspace-1', connectionId: 'provider-1', prompt: ' ' })).resolves.toBeNull();
});

it('rejects image-edit tool parameters that do not match the declared tool schema', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1' } };
  const submit = createImageEditHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async () => task);
  await expect(submit(fixture.event, {
    libraryId: 'workspace-1', projectId: 'project-1', connectionId: 'provider-1', prompt: 'crop', sourceAssetId: 'asset-1',
    tool: 'smart-crop', toolParams: { width: -1, height: 640, focus: 'subject' },
  })).resolves.toBeNull();
});

it('accepts a managed mask asset id for image-edit tasks', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1', openMode: 'writable' } };
  const submit = createImageEditHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.maskAssetId).toBe('asset-mask');
    return task;
  });
  await expect(submit(fixture.event, {
    libraryId: 'workspace-1', projectId: 'project-1', connectionId: 'provider-1', prompt: 'remove object', sourceAssetId: 'asset-1',
    maskAssetId: 'asset-mask', tool: 'remove-object', toolParams: { feather: 10 }, region: { x: 1, y: 1, width: 4, height: 4 },
  })).resolves.toEqual(task);
  await expect(submit(fixture.event, {
    libraryId: 'workspace-1', projectId: 'project-1', connectionId: 'provider-1', prompt: 'remove object', sourceAssetId: 'asset-1',
    maskAssetId: ' ', tool: 'remove-object', toolParams: { feather: 10 }, region: { x: 1, y: 1, width: 4, height: 4 },
  })).resolves.toBeNull();
});

it('accepts only explicit designer-draft portfolio vision sources from the trusted workspace', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1' } };
  const submit = createPortfolioAnalysisHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.source).toEqual({ kind: 'designer-draft', id: 'draft-1' });
    expect(input.sources[0]?.image).toEqual({ url: 'https://img.test/a.png' });
    return task;
  });
  await expect(submit(fixture.event, {
    libraryId: 'workspace-1', source: { kind: 'designer-draft', id: 'draft-1' }, connectionId: 'provider-1',
    rightsConfirmed: true,
    sources: [{ id: 'source-a', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).resolves.toEqual(task);
  await expect(submit(fixture.event, {
    libraryId: 'workspace-1', source: { kind: 'designer-draft', id: 'draft-1' }, connectionId: 'provider-1',
    rightsConfirmed: false,
    sources: [{ id: 'source-a', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).resolves.toBeNull();
  await expect(submit(fixture.event, {
    libraryId: 'workspace-1', source: { kind: 'designer-draft', id: 'draft-1' }, connectionId: 'provider-1',
    sources: [{ id: 'source-a', description: 'poster', image: { url: 'file:///tmp/a.png' } }],
  })).resolves.toBeNull();
});

it('accepts designer artwork generation only for an explicit designer draft', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { library: { libraryId: 'workspace-1', openMode: 'writable' } };
  const artworkIpc = agentIpc as typeof agentIpc & {
    designerArtworkGenerationSubmitChannel: string;
    createDesignerArtworkGenerationHandler: (
      window: never,
      trustedUrl: string,
      getLibrary: () => never,
      submit: (workspace: never, input: { source: { kind: 'designer-draft'; id: string }; connectionId: string; prompt: string; size?: string; count?: number }) => Promise<TaskRecord>,
    ) => (event: never, input: unknown) => Promise<TaskRecord | null>;
  };
  expect(artworkIpc.createDesignerArtworkGenerationHandler).toBeTypeOf('function');
  expect(artworkIpc.designerArtworkGenerationSubmitChannel).toBe('agent:submit-designer-artwork');
  const submit = artworkIpc.createDesignerArtworkGenerationHandler(
    fixture.window as never,
    'http://localhost:5173/?preview=1',
    () => workspace as never,
    async (_workspace, input) => {
      expect(input.source).toEqual({ kind: 'designer-draft', id: 'designer-draft-1' });
      return task;
    },
  );
  await expect(submit(fixture.event as never, {
    libraryId: 'workspace-1',
    source: { kind: 'designer-draft', id: 'designer-draft-1' },
    connectionId: 'provider-1',
    prompt: 'Original art director portrait',
    size: '1024x1024',
    count: 1,
  })).resolves.toEqual(task);
  await expect(submit(fixture.event as never, {
    libraryId: 'workspace-1',
    source: { kind: 'project', id: 'project-1' },
    connectionId: 'provider-1',
    prompt: 'Original art director portrait',
  })).resolves.toBeNull();
});
