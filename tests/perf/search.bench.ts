// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

import { initializeProjectLibrary } from '../../src/desktop/storage/project-library-store';
import { createSearchIndexStore } from '../../src/desktop/storage/search-index-store';
import type { SearchRecord } from '../../src/features/library/indexer';

it('searches a 100-project persisted index within the local performance budget', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-search-perf-'));
  try {
    const workspace = await initializeProjectLibrary(root);
    try {
      const store = createSearchIndexStore(workspace);
      try {
        const libraryId = workspace.library.libraryId;
        const records: SearchRecord[] = Array.from({ length: 100 }, (_, index) => ({
          libraryId,
          projectId: `project-${index.toString().padStart(3, '0')}`,
          title: index % 2 === 0 ? `Spring Market ${index}` : `Autumn Studio ${index}`,
          brief: '',
          tags: [],
          contributorIds: [`designer-${index % 5}`],
        }));
        await store.replace(records);

        const started = performance.now();
        const result = await store.search({ libraryId, query: 'Spring Market', designerId: 'designer-2' });
        const elapsed = performance.now() - started;
        console.info(`[perf] project-search-100: ${elapsed.toFixed(2)}ms`);
        expect(result).toHaveLength(10);
        expect(elapsed).toBeLessThan(500);
      } finally {
        store.close();
      }
    } finally {
      workspace.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
