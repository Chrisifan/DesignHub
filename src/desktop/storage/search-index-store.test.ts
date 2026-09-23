// @vitest-environment node

import { copyFile, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

import { initializeProjectLibrary, openProjectLibrary } from './project-library-store';
import { createSearchIndexStore, type SearchIndexStore } from './search-index-store';
import type { SearchRecord } from '../../features/library/indexer';

const record = (workspaceId: string, projectId: string, title: string, contributorIds: string[]): SearchRecord => ({
  workspaceId, projectId, documentId: `${projectId}-doc`, title, brief: '',
  tags: [], contributorIds,
});

const openStore = async (): Promise<{ root: string; directory: string; workspaceId: string; store: SearchIndexStore; workspace: Awaited<ReturnType<typeof initializeProjectLibrary>> }> => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-search-'));
  const workspace = await initializeProjectLibrary(root);
  const store = createSearchIndexStore(workspace);
  return { root, directory: workspace.library.directory, workspaceId: workspace.library.libraryId, store, workspace };
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
    const reopened = await openProjectLibrary(fixture.directory);
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

it('does not follow an index symlink outside the workspace', async () => {
  const fixture = await openStore();
  const externalRoot = await mkdtemp(join(tmpdir(), 'designhub-search-external-'));
  try {
    await fixture.store.replace([record(fixture.workspaceId, 'project-external', 'External', ['designer-a'])]);
    fixture.store.close();
    const indexPath = join(fixture.directory, '.designhub', 'search-index.sqlite');
    const externalPath = join(externalRoot, 'external.sqlite');
    await copyFile(indexPath, externalPath);
    const externalBefore = await readFile(externalPath);
    await rm(indexPath);
    await symlink(externalPath, indexPath);
    const recovered = createSearchIndexStore(fixture.workspace);
    try {
      await expect(recovered.search({ workspaceId: fixture.workspaceId, query: 'external' })).resolves.toEqual([]);
      await recovered.replace([record(fixture.workspaceId, 'project-local', 'Local', ['designer-a'])]);
      await expect(recovered.search({ workspaceId: fixture.workspaceId, query: 'local' })).resolves.toHaveLength(1);
    } finally {
      recovered.close();
    }
    await expect(readFile(externalPath)).resolves.toEqual(externalBefore);
  } finally {
    fixture.workspace.close();
    await rm(fixture.root, { recursive: true, force: true });
    await rm(externalRoot, { recursive: true, force: true });
  }
});

it('searches a 100-project workspace within the local performance budget', async () => {
  const fixture = await openStore();
  try {
    const records = Array.from({ length: 100 }, (_, index) => record(
      fixture.workspaceId,
      `project-${index.toString().padStart(3, '0')}`,
      index % 2 === 0 ? `Spring Market ${index}` : `Autumn Studio ${index}`,
      [`designer-${index % 5}`],
    ));
    await fixture.store.replace(records);
    const started = performance.now();
    const result = await fixture.store.search({ workspaceId: fixture.workspaceId, query: 'Spring Market', designerId: 'designer-2' });
    const elapsed = performance.now() - started;
    expect(result.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  } finally {
    fixture.store.close();
    fixture.workspace.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
});
