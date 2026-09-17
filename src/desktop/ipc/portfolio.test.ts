import { expect, it, vi } from 'vitest';

import { createPortfolioInspectionHandler, createPortfolioSelectionHandler } from './portfolio';

const makeFixture = (url: string) => {
  const mainFrame = { url };
  const webContents = { mainFrame, getURL: () => url };
  return { event: { sender: webContents, senderFrame: mainFrame }, window: { webContents } };
};

it('inspects local images and rejects unsupported portfolio request shapes', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const chooseFiles = vi.fn(async () => ['/tmp/cover.png']);
  const inspectLocalImages = vi.fn(async () => ({ id: 'inspection-1', candidates: [] }));
  const inspect = createPortfolioInspectionHandler(
    fixture.window,
    'http://localhost:5173/?preview=1',
    () => ({ workspace: { workspaceId: 'workspace-1' } }) as never,
    chooseFiles,
    { inspectLocalImages, inspectZip: vi.fn(), selectedSources: vi.fn(), discard: vi.fn(), discardAll: vi.fn() },
  );

  await expect(inspect(fixture.event, { workspaceId: 'workspace-1', request: { kind: 'local-images' } })).resolves.toMatchObject({ id: 'inspection-1' });
  expect(chooseFiles).toHaveBeenCalledWith('local-images');
  expect(inspectLocalImages).toHaveBeenCalledWith(['/tmp/cover.png']);

  chooseFiles.mockClear();
  await expect(inspect(fixture.event, { workspaceId: 'workspace-1', request: { kind: 'remote-page', url: 'https://public.test/work' } })).resolves.toBeNull();
  await expect(inspect(fixture.event, { workspaceId: 'workspace-1', request: { kind: 'remote-image', url: 'https://public.test/cover.png' } })).resolves.toBeNull();
  await expect(inspect(fixture.event, { workspaceId: 'workspace-1', request: { kind: 'local-images', url: 'https://public.test/cover.png' } })).resolves.toBeNull();
  expect(chooseFiles).not.toHaveBeenCalled();
});

it('submits selected sources from retained inspection batches with an explicit rights declaration', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const selectedSources = vi.fn(async (inspectionId: string) => inspectionId === 'inspection-1'
    ? [{ id: 'candidate-b', description: 'Cover', image: { base64: 'Y292ZXI=', mimeType: 'image/png' } }]
    : [{ id: 'candidate-c', description: 'Detail', image: { base64: 'ZGV0YWls', mimeType: 'image/png' } }]);
  const discard = vi.fn();
  const submit = vi.fn(async () => ({ id: 'task-1', requestId: 'request-1', state: 'running' as const, cancelRequested: false, attempt: 1 }));
  const selection = createPortfolioSelectionHandler(
    fixture.window,
    'http://localhost:5173/?preview=1',
    () => ({ workspace: { workspaceId: 'workspace-1' } }) as never,
    { inspectLocalImages: vi.fn(), inspectZip: vi.fn(), selectedSources, discard, discardAll: vi.fn() },
    submit,
  );
  const input = {
    workspaceId: 'workspace-1', source: { kind: 'designer-draft' as const, id: 'draft-1' }, connectionId: 'provider-1',
    selections: [
      { inspectionId: 'inspection-1', sourceIds: ['candidate-b'] },
      { inspectionId: 'inspection-2', sourceIds: ['candidate-c'] },
    ], rightsConfirmed: true,
  };

  await expect(selection(fixture.event, input)).resolves.toMatchObject({ id: 'task-1' });
  expect(selectedSources).toHaveBeenCalledWith('inspection-1', ['candidate-b']);
  expect(selectedSources).toHaveBeenCalledWith('inspection-2', ['candidate-c']);
  expect(submit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    sources: [
      { id: 'candidate-b', description: 'Cover', image: { base64: 'Y292ZXI=', mimeType: 'image/png' } },
      { id: 'candidate-c', description: 'Detail', image: { base64: 'ZGV0YWls', mimeType: 'image/png' } },
    ],
    rightsConfirmed: true,
  }));
  expect(discard).not.toHaveBeenCalled();
  await expect(selection(fixture.event, { ...input, rightsConfirmed: false })).resolves.toBeNull();
});

it('rejects duplicated inspection batches and more than eight aggregate sources', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const selectedSources = vi.fn();
  const selection = createPortfolioSelectionHandler(
    fixture.window,
    'http://localhost:5173/?preview=1',
    () => ({ workspace: { workspaceId: 'workspace-1' } }) as never,
    { inspectLocalImages: vi.fn(), inspectZip: vi.fn(), selectedSources, discard: vi.fn(), discardAll: vi.fn() },
    vi.fn(),
  );
  const base = { workspaceId: 'workspace-1', source: { kind: 'designer-draft', id: 'draft-1' }, connectionId: 'provider-1', rightsConfirmed: true };

  await expect(selection(fixture.event, { ...base, selections: [
    { inspectionId: 'inspection-1', sourceIds: ['candidate-a'] },
    { inspectionId: 'inspection-1', sourceIds: ['candidate-b'] },
  ] })).resolves.toBeNull();
  await expect(selection(fixture.event, { ...base, selections: [{
    inspectionId: 'inspection-1', sourceIds: Array.from({ length: 9 }, (_, index) => `candidate-${index}`),
  }] })).resolves.toBeNull();
  expect(selectedSources).not.toHaveBeenCalled();
});

it('retains an inspected source session when task acceptance fails', async () => {
  const fixture = makeFixture('http://localhost:5173/?preview=1');
  const selectedSources = vi.fn(async () => [{ id: 'candidate-a', description: 'Cover', image: { base64: 'cG5n', mimeType: 'image/png' } }]);
  const discard = vi.fn();
  const selection = createPortfolioSelectionHandler(
    fixture.window,
    'http://localhost:5173/?preview=1',
    () => ({ workspace: { workspaceId: 'workspace-1' } }) as never,
    { inspectLocalImages: vi.fn(), inspectZip: vi.fn(), selectedSources, discard, discardAll: vi.fn() },
    async () => { throw new Error('TASK_ACCEPTANCE_FAILED'); },
  );

  await expect(selection(fixture.event, {
    workspaceId: 'workspace-1', source: { kind: 'designer-draft', id: 'draft-1' }, connectionId: 'provider-1', selections: [{ inspectionId: 'inspection-1', sourceIds: ['candidate-a'] }], rightsConfirmed: true,
  })).rejects.toThrow('TASK_ACCEPTANCE_FAILED');
  expect(discard).not.toHaveBeenCalled();
});
