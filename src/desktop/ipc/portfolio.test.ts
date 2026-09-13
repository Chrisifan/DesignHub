import { expect, it, vi } from 'vitest';

import { createPortfolioInspectionHandler, createPortfolioSelectionHandler } from './portfolio';

const makeFixture = (url: string) => {
  const mainFrame = { url };
  const webContents = { mainFrame, getURL: () => url };
  return { event: { sender: webContents, senderFrame: mainFrame }, window: { webContents } };
};

it('inspects an explicitly requested public page only from the trusted active workspace', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const inspectRemotePage = vi.fn(async () => ({ id: 'inspection-1', candidates: [] }));
  const inspect = createPortfolioInspectionHandler(
    fixture.window,
    'http://localhost:5173/?preview=1',
    () => ({ workspace: { workspaceId: 'workspace-1' } }) as never,
    async () => null,
    { inspectLocalImages: vi.fn(), inspectZip: vi.fn(), inspectRemoteImage: vi.fn(), inspectRemotePage, selectedSources: vi.fn(), discard: vi.fn(), discardAll: vi.fn() },
  );

  await expect(inspect(fixture.event, { workspaceId: 'workspace-1', request: { kind: 'remote-page', url: 'https://public.test/work' } })).resolves.toMatchObject({ id: 'inspection-1' });
  await expect(inspect(fixture.event, { workspaceId: 'workspace-2', request: { kind: 'remote-page', url: 'https://public.test/work' } })).resolves.toBeNull();
  expect(inspectRemotePage).toHaveBeenCalledWith('https://public.test/work');
});

it('submits only selected transient sources with an explicit rights declaration and clears them afterwards', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const selectedSources = vi.fn(async () => [{ id: 'candidate-b', description: 'Detail', image: { base64: 'cG5n', mimeType: 'image/png' } }]);
  const discard = vi.fn();
  const submit = vi.fn(async () => ({ id: 'task-1', requestId: 'request-1', state: 'running' as const, cancelRequested: false, attempt: 1 }));
  const selection = createPortfolioSelectionHandler(
    fixture.window,
    'http://localhost:5173/?preview=1',
    () => ({ workspace: { workspaceId: 'workspace-1' } }) as never,
    { inspectLocalImages: vi.fn(), inspectZip: vi.fn(), inspectRemoteImage: vi.fn(), inspectRemotePage: vi.fn(), selectedSources, discard, discardAll: vi.fn() },
    submit,
  );
  const input = {
    workspaceId: 'workspace-1', source: { kind: 'designer-draft' as const, id: 'draft-1' }, connectionId: 'provider-1',
    inspectionId: 'inspection-1', sourceIds: ['candidate-b'], rightsConfirmed: true,
  };

  await expect(selection(fixture.event, input)).resolves.toMatchObject({ id: 'task-1' });
  expect(selectedSources).toHaveBeenCalledWith('inspection-1', ['candidate-b']);
  expect(submit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    sources: [{ id: 'candidate-b', description: 'Detail', image: { base64: 'cG5n', mimeType: 'image/png' } }],
    rightsConfirmed: true,
  }));
  expect(discard).toHaveBeenCalledWith('inspection-1');
  await expect(selection(fixture.event, { ...input, rightsConfirmed: false })).resolves.toBeNull();
});

it('retains an inspected source session when task acceptance fails', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const selectedSources = vi.fn(async () => [{ id: 'candidate-a', description: 'Cover', image: { base64: 'cG5n', mimeType: 'image/png' } }]);
  const discard = vi.fn();
  const selection = createPortfolioSelectionHandler(
    fixture.window,
    'http://localhost:5173/?preview=1',
    () => ({ workspace: { workspaceId: 'workspace-1' } }) as never,
    { inspectLocalImages: vi.fn(), inspectZip: vi.fn(), inspectRemoteImage: vi.fn(), inspectRemotePage: vi.fn(), selectedSources, discard, discardAll: vi.fn() },
    async () => { throw new Error('TASK_ACCEPTANCE_FAILED'); },
  );

  await expect(selection(fixture.event, {
    workspaceId: 'workspace-1', source: { kind: 'designer-draft', id: 'draft-1' }, connectionId: 'provider-1', inspectionId: 'inspection-1', sourceIds: ['candidate-a'], rightsConfirmed: true,
  })).rejects.toThrow('TASK_ACCEPTANCE_FAILED');
  expect(discard).not.toHaveBeenCalled();
});
