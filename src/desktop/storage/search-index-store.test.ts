// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

import { createWorkspace, openWorkspace } from './workspace-store';
import { createSearchIndexStore, type SearchIndexStore } from './search-index-store';
import type { SearchRecord } from '../../features/library/indexer';

const record = (workspaceId: string, projectId: string, title: string, contributorIds: string[]): SearchRecord => ({
  workspaceId, projectId, documentId: `${projectId}-doc`, title, brief: '',
  tags: [], contributorIds,
});

const openStore = async (): Promise<{ root: string; directory: string; workspaceId: string; store: SearchIndexStore; workspace: Awaited<ReturnType<typeof createWorkspace>> }> => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-search-'));
  const workspace = await createWorkspace({ parentDirectory: root, name: 'Studio' });
  const store = createSearchIndexStore(workspace);
  return { root, directory: workspace.workspace.directory, workspaceId: workspace.workspace.workspaceId, store, workspace };
};

it('persists a rebuildable index and supports Chinese, English and contributor queries', async () => {
  const fixture = await openStore();
  try {
    const workspaceId = fixture.workspaceId;
    await fixture.store.replace([
      record(workspaceId, 'project-1', '春间市集', ['designer-a']),
      record(workspaceId, 'project-2', 'Spring Market', ['designer-b']),
    ]);
    await expect(fixture.store.search({ workspaceId, query: '市集' })).resolves.toHaveLength(1);
    await expect(fixture.store.search({ workspaceId, query: 'spring' })).resolves.toHaveLength(1);
    await expect(fixture.store.search({ workspaceId, designerId: 'designer-a' })).resolves.toHaveLength(1);

    fixture.store.close();
    const reopened = await openWorkspace(fixture.directory);
    try {
      const persisted = createSearchIndexStore(reopened);
      await expect(persisted.search({ workspaceId, query: '春间' })).resolves.toHaveLength(1);
      persisted.close();
    } finally {
      reopened.close();
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

it('rebuild replaces stale entries, deduplicates documents and keeps workspace scope', async () => {
  const fixture = await openStore();
  try {
    const workspaceId = fixture.workspaceId;
    await fixture.store.replace([record(workspaceId, 'project-1', 'Old', ['designer-a']), record(workspaceId, 'project-1', 'Duplicate', ['designer-a'])]);
    await fixture.store.replace([record(workspaceId, 'project-2', 'New', ['designer-b'])]);
    await expect(fixture.store.search({ workspaceId, query: 'old' })).resolves.toEqual([]);
    await expect(fixture.store.search({ workspaceId, query: 'new' })).resolves.toHaveLength(1);
    await expect(fixture.store.search({ workspaceId: 'other-workspace', query: 'new' })).resolves.toEqual([]);
    fixture.store.close();
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

it('recreates a corrupt writable index before rebuilding', async () => {
  const fixture = await openStore();
  try {
    fixture.store.close();
    await writeFile(join(fixture.directory, '.designhub', 'search-index.sqlite'), 'not a sqlite database');
    const recovered = createSearchIndexStore(fixture.workspace);
    try {
      await recovered.replace([record(fixture.workspaceId, 'project-recovered', 'Recovered', ['designer-a'])]);
      await expect(recovered.search({ workspaceId: fixture.workspaceId, query: 'recovered' })).resolves.toHaveLength(1);
    } finally {
      recovered.close();
    }
  } finally {
    fixture.workspace.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
});
