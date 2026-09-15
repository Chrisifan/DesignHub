import { expect, it } from 'vitest';

import { listTasksHandler, saveTasksHandler } from './tasks';
import type { TaskRecord } from '../../features/tasks/state';

const makeFixture = (url: string) => {
  const mainFrame = { url };
  const webContents = { mainFrame, getURL: () => url };
  return { event: { sender: webContents, senderFrame: mainFrame }, window: { webContents } };
};

const task: TaskRecord = {
  id: 'task-1', requestId: 'request-1', state: 'queued', cancelRequested: false, attempt: 1,
};

it('lists tasks only for the active trusted workspace', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { workspace: { workspaceId: 'workspace-1' } };
  const list = listTasksHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async () => [task]);
  await expect(list(fixture.event, 'workspace-1')).resolves.toEqual([task]);
  await expect(list(fixture.event, 'workspace-2')).resolves.toBeNull();
  const altered = makeFixture('http://localhost:5173/?preview=2');
  await expect(list(altered.event, 'workspace-1')).resolves.toBeNull();
});

it('rejects malformed task writes before storage is called', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const workspace = { workspace: { workspaceId: 'workspace-1' } };
  let writes = 0;
  const save = saveTasksHandler(fixture.window, 'http://localhost:5173/?preview=1', () => workspace as never, async () => { writes += 1; return true; });
  await expect(save(fixture.event, { workspaceId: 'workspace-1', tasks: [{ ...task, attempt: 0 }] })).resolves.toBe(false);
  await expect(save(fixture.event, { workspaceId: 'workspace-1', tasks: [{
    ...task,
    providerFailure: { kind: 'http', status: 400, message: 'private provider error' },
  }] })).resolves.toBe(false);
  await expect(save(fixture.event, { workspaceId: 'workspace-1', tasks: [{
    ...task,
    providerMessage: 'private provider error',
  }] })).resolves.toBe(false);
  expect(writes).toBe(0);
  await expect(save(fixture.event, { workspaceId: 'workspace-1', tasks: [task] })).resolves.toBe(true);
  expect(writes).toBe(1);
});
