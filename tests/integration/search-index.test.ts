import { expect, it } from 'vitest';

import { buildSearchIndex, searchIndex } from '../../src/features/library/indexer';

const records = [
  {
    workspaceId: 'workspace-a', projectId: 'project-a', documentId: 'doc-a',
    title: '春间市集', brief: 'Spring Market campaign', brand: '春间市集',
    size: '1080 x 1440', finalized: true, tags: ['春间', 'market'], updatedAt: '2026-09-01',
    contributorIds: ['designer-archived'], credentials: { apiKey: 'must-not-index' }, hiddenPrompt: 'secret',
  },
  {
    workspaceId: 'workspace-b', projectId: 'project-b', documentId: 'doc-b',
    title: 'Other project', brief: 'Unrelated', brand: 'Other', size: '1080 x 1080', finalized: false,
    tags: ['other'], updatedAt: '2026-09-02', contributorIds: ['designer-current'],
  },
];

it('builds a rebuildable workspace-scoped index and excludes credentials and hidden prompts', () => {
  const index = buildSearchIndex(records);
  expect(index).toHaveLength(2);
  expect(index[0]).not.toHaveProperty('credentials');
  expect(index[0]).not.toHaveProperty('hiddenPrompt');
  expect(searchIndex(index, { workspaceId: 'workspace-a', query: 'Spring Market', designerId: 'designer-archived' })).toHaveLength(1);
  expect(searchIndex(index, { workspaceId: 'workspace-b', query: '春间' })).toHaveLength(0);
  expect(searchIndex(index, { workspaceId: 'workspace-a', query: 'none' })).toHaveLength(0);
});
