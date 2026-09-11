import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';

import { CompareRevisions } from '../../src/features/revisions/CompareRevisions';
import { Timeline } from '../../src/features/revisions/Timeline';
import { createRevisionStore } from '../../src/features/revisions/commit-revision';

it('renders revision timeline entries and comparison metadata', () => {
  render(createElement(Timeline, { events: [{ id: 'event-1', kind: 'revision', label: 'Initial layout', revisionId: 'r1' }] }));
  expect(screen.getByText('Initial layout')).toBeInTheDocument();

  render(createElement(CompareRevisions, { left: { revisionId: 'r1', sceneAssetId: 'scene-a' }, right: { revisionId: 'r2', sceneAssetId: 'scene-b' } }));
  expect(screen.getAllByText('r1').length).toBeGreaterThan(0);
  expect(screen.getByText('r2')).toBeInTheDocument();
});

it('keeps finalization and operation idempotency within an isolated revision store', async () => {
  const store = createRevisionStore();
  const input = {
    projectId: 'project-1',
    documentId: 'document-1',
    baseRevisionId: null,
    operationId: 'operation-1',
    sceneAssetId: 'scene-1',
    assetIds: ['asset-1'],
    contributions: [],
  };

  const first = await store.commitRevision(input);
  const retry = await store.commitRevision(input);
  await store.setFinalRevision(input.documentId, first.revisionId);

  expect(retry).toEqual(first);
  expect(store.getFinalRevision(input.documentId)).toBe(first.revisionId);
});
