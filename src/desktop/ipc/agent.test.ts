import { expect, it } from 'vitest';

import { createConversationHandler, cancelTaskHandler, retryTaskHandler } from './agent';
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
