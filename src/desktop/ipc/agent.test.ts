import { expect, it } from 'vitest';

import * as agentIpc from './agent';
import { createConversationHandler, cancelTaskHandler, createImageEditHandler, createImageGenerationHandler, retryTaskHandler, createPortfolioAnalysisHandler } from './agent';
import type { TaskRecord } from '../../features/tasks/state';

const makeFixture = (url: string) => {
  const mainFrame = { url };
  const webContents = { mainFrame, getURL: () => url };
  return { event: { sender: webContents, senderFrame: mainFrame }, window: { webContents } };
};

const task: TaskRecord = { id: 'task-1', requestId: 'request-1', state: 'running', cancelRequested: false, attempt: 1 };

it('accepts a conversation only from the active trusted workspace', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { workspace: { workspaceId: 'workspace-1' } };
  const submit = createConversationHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.message).toBe('hello');
    return task;
  });
  await expect(submit(fixture.event, { workspaceId: 'workspace-1', projectId: 'project-1', connectionId: 'provider-1', message: 'hello' })).resolves.toEqual(task);
  await expect(submit(fixture.event, { workspaceId: 'workspace-2', projectId: 'project-1', connectionId: 'provider-1', message: 'hello' })).resolves.toBeNull();
});

it('rejects blank conversation input and forwards explicit cancellation', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { workspace: { workspaceId: 'workspace-1' } };
  let cancelled = '';
  const submit = createConversationHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async () => task);
  await expect(submit(fixture.event, { workspaceId: 'workspace-1', projectId: 'p', connectionId: 'c', message: ' ' })).resolves.toBeNull();
  const cancel = cancelTaskHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, taskId) => { cancelled = taskId; return true; });
  await expect(cancel(fixture.event, { workspaceId: 'workspace-1', taskId: 'task-1' })).resolves.toBe(true);
  expect(cancelled).toBe('task-1');
});

it('accepts an explicit creation-draft source', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { workspace: { workspaceId: 'workspace-1' } };
  const submit = createConversationHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.source).toEqual({ kind: 'creation-draft', id: 'creation-1' });
    return task;
  });
  await expect(submit(fixture.event, { workspaceId: 'workspace-1', source: { kind: 'creation-draft', id: 'creation-1' }, connectionId: 'provider-1', message: 'brief' })).resolves.toEqual(task);
});

it('retries only through the active trusted workspace', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { workspace: { workspaceId: 'workspace-1' } };
  const retry = retryTaskHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, taskId) => ({ ...task, id: `${taskId}-retry`, state: 'running' }));
  await expect(retry(fixture.event, { workspaceId: 'workspace-1', taskId: 'task-1' })).resolves.toMatchObject({ id: 'task-1-retry' });
  await expect(retry(fixture.event, { workspaceId: 'workspace-2', taskId: 'task-1' })).resolves.toBeNull();
});

it('accepts image generation and edit only with validated project bindings', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { workspace: { workspaceId: 'workspace-1' } };
  const generated = createImageGenerationHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.prompt).toBe('poster');
    return task;
  });
  await expect(generated(fixture.event, { workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: 'poster' })).resolves.toEqual(task);
  await expect(generated(fixture.event, { workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: ' ' })).resolves.toBeNull();
  const edited = createImageEditHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.image).toBeInstanceOf(Blob);
    return task;
  });
  await expect(edited(fixture.event, { workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: 'remove', image: new Blob(['image']) })).resolves.toEqual(task);
});

it('rejects image-edit tool parameters that do not match the declared tool schema', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { workspace: { workspaceId: 'workspace-1' } };
  const submit = createImageEditHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async () => task);
  await expect(submit(fixture.event, {
    workspaceId: 'workspace-1', projectId: 'project-1', documentId: 'document-1', connectionId: 'provider-1', prompt: 'crop', image: new Blob(['image']),
    tool: 'smart-crop', toolParams: { width: -1, height: 640, focus: 'subject' },
  })).resolves.toBeNull();
});

it('accepts only explicit designer-draft portfolio vision sources from the trusted workspace', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { workspace: { workspaceId: 'workspace-1' } };
  const submit = createPortfolioAnalysisHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async (_workspace, input) => {
    expect(input.source).toEqual({ kind: 'designer-draft', id: 'draft-1' });
    expect(input.sources[0]?.image).toEqual({ url: 'https://img.test/a.png' });
    return task;
  });
  await expect(submit(fixture.event, {
    workspaceId: 'workspace-1', source: { kind: 'designer-draft', id: 'draft-1' }, connectionId: 'provider-1',
    sources: [{ id: 'source-a', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).resolves.toEqual(task);
  await expect(submit(fixture.event, {
    workspaceId: 'workspace-1', source: { kind: 'designer-draft', id: 'draft-1' }, connectionId: 'provider-1',
    sources: [{ id: 'source-a', description: 'poster', image: { url: 'file:///tmp/a.png' } }],
  })).resolves.toBeNull();
});

it('accepts designer artwork generation only for an explicit designer draft', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { workspace: { workspaceId: 'workspace-1', openMode: 'writable' } };
  const artworkIpc = agentIpc as typeof agentIpc & {
    designerArtworkGenerationSubmitChannel: string;
    createDesignerArtworkGenerationHandler: (
      window: never,
      trustedUrl: string,
      getWorkspace: () => never,
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
    workspaceId: 'workspace-1',
    source: { kind: 'designer-draft', id: 'designer-draft-1' },
    connectionId: 'provider-1',
    prompt: 'Original art director portrait',
    size: '1024x1024',
    count: 1,
  })).resolves.toEqual(task);
  await expect(submit(fixture.event as never, {
    workspaceId: 'workspace-1',
    source: { kind: 'project', id: 'project-1' },
    connectionId: 'provider-1',
    prompt: 'Original art director portrait',
  })).resolves.toBeNull();
});
