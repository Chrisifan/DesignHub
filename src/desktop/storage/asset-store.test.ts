import { access, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createProjectStore } from './project-store';
import { initializeProjectLibrary, openProjectLibrary } from './project-library-store';
import { createAssetStore } from './asset-store';

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

const withProject = async (run: (workspaceDirectory: string, projectId: string) => Promise<void>): Promise<void> => {
  const parentDirectory = await mkdtemp(join(tmpdir(), 'designhub-asset-store-'));
  const workspace = await initializeProjectLibrary(parentDirectory);
  const project = await createProjectStore(workspace).createProjectContainer({
    libraryId: workspace.library.libraryId,
    operationId: 'asset-project-create',
    name: 'Asset project',
  });
  const workspaceDirectory = workspace.library.directory;
  workspace.close();
  try {
    await run(workspaceDirectory, project.projectId);
  } finally {
    await rm(parentDirectory, { recursive: true, force: true });
  }
};

it('persists managed bytes and metadata, and deduplicates content across imports', async () => {
  await withProject(async (workspaceDirectory, projectId) => {
    const workspace = await openProjectLibrary(workspaceDirectory);
    try {
      const store = createAssetStore(workspace);
      const first = await store.importAssets({
        libraryId: workspace.library.libraryId,
        projectId,
        items: [{ name: 'poster.png', mimeType: 'image/png', data: bytes('same') }],
      });
      expect(first).toHaveLength(1);
      expect(first[0].status).toBe('success');
      if (first[0].status !== 'success') throw new Error('expected success');
      expect(first[0].asset.originalBytes).toEqual(bytes('same'));

      const second = await store.importAssets({
        libraryId: workspace.library.libraryId,
        projectId,
        items: [{ name: 'renamed.png', mimeType: 'image/png', data: bytes('same') }],
      });
      expect(second[0].status).toBe('success');
      if (second[0].status !== 'success') throw new Error('expected success');
      expect(second[0].asset.id).toBe(first[0].asset.id);

      await expect(store.listAssets({ libraryId: workspace.library.libraryId, projectId })).resolves.toHaveLength(1);
      const assetsDirectory = join(workspaceDirectory, 'projects', projectId, 'assets');
      await expect(readdir(assetsDirectory)).resolves.toHaveLength(1);
      await expect(access(join(assetsDirectory, first[0].asset.contentHash), constants.R_OK)).resolves.toBeUndefined();
    } finally {
      workspace.close();
    }
  });
});

it('loads persisted metadata and bytes after reopening a workspace', async () => {
  await withProject(async (workspaceDirectory, projectId) => {
    const firstWorkspace = await openProjectLibrary(workspaceDirectory);
    const first = await createAssetStore(firstWorkspace).importAssets({
      libraryId: firstWorkspace.library.libraryId,
      projectId,
      items: [{ name: 'mark.svg', mimeType: 'image/svg+xml', data: bytes('<svg />'), metadata: { role: 'logo' } }],
    });
    if (first[0].status !== 'success') throw new Error('expected success');
    firstWorkspace.close();

    const reopened = await openProjectLibrary(workspaceDirectory);
    try {
      const store = createAssetStore(reopened);
      await expect(store.listAssets({ libraryId: reopened.library.libraryId, projectId })).resolves.toEqual([
        expect.objectContaining({ id: first[0].asset.id, name: 'mark.svg', managed: true, metadata: { role: 'logo' } }),
      ]);
      const listed = await store.listAssets({ libraryId: reopened.library.libraryId, projectId });
      expect(listed[0].originalBytes).toBeUndefined();
      await expect(store.readAsset({ libraryId: reopened.library.libraryId, projectId, assetId: first[0].asset.id })).resolves.toSatisfy((value) => value ? Array.from(value).join(',') === Array.from(bytes('<svg />')).join(',') : false);
    } finally {
      reopened.close();
    }
  });
});

it('persists external references without pretending they are managed bytes', async () => {
  await withProject(async (workspaceDirectory, projectId) => {
    const workspace = await openProjectLibrary(workspaceDirectory);
    try {
      const store = createAssetStore(workspace);
      const [result] = await store.importAssets({
        libraryId: workspace.library.libraryId,
        projectId,
        items: [{ name: 'remote.png', mimeType: 'image/png', externalReference: 'https://example.com/remote.png' }],
      });
      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('expected success');
      await expect(store.listAssets({ libraryId: workspace.library.libraryId, projectId })).resolves.toEqual([
        expect.objectContaining({ id: result.asset.id, managed: false, externalReference: 'https://example.com/remote.png' }),
      ]);
      await expect(store.readAsset({ libraryId: workspace.library.libraryId, projectId, assetId: result.asset.id })).resolves.toBeNull();
    } finally {
      workspace.close();
    }
  });
});

it('rejects writes in a read-only workspace while allowing metadata reads', async () => {
  await withProject(async (workspaceDirectory, projectId) => {
    const workspace = await openProjectLibrary(workspaceDirectory);
    const readOnly = await openProjectLibrary(workspaceDirectory);
    try {
      const store = createAssetStore(readOnly);
      await expect(store.importAssets({ libraryId: readOnly.library.libraryId, projectId, items: [{ name: 'x.png', data: bytes('x') }] })).rejects.toThrow('WORKSPACE_NOT_WRITABLE');
      await expect(store.listAssets({ libraryId: readOnly.library.libraryId, projectId })).resolves.toEqual([]);
    } finally {
      readOnly.close();
      workspace.close();
    }
  });
});

it('rejects project path traversal before touching the workspace', async () => {
  await withProject(async (workspaceDirectory) => {
    const workspace = await openProjectLibrary(workspaceDirectory);
    try {
      const store = createAssetStore(workspace);
      await expect(store.listAssets({ libraryId: workspace.library.libraryId, projectId: '../outside' })).rejects.toThrow('INVALID_PROJECT_ID');
    } finally {
      workspace.close();
    }
  });
});

it('does not follow managed asset symlinks outside the project', async () => {
  await withProject(async (workspaceDirectory, projectId) => {
    const workspace = await openProjectLibrary(workspaceDirectory);
    const externalRoot = await mkdtemp(join(tmpdir(), 'designhub-asset-external-'));
    try {
      const store = createAssetStore(workspace);
      const [result] = await store.importAssets({
        libraryId: workspace.library.libraryId,
        projectId,
        items: [{ name: 'managed.png', mimeType: 'image/png', data: bytes('managed') }],
      });
      if (result.status !== 'success') throw new Error('expected success');
      const assetPath = join(workspaceDirectory, 'projects', projectId, 'assets', result.asset.contentHash);
      const externalPath = join(externalRoot, 'external.png');
      await writeFile(externalPath, 'external');
      await rm(assetPath);
      await symlink(externalPath, assetPath);
      await expect(store.readAsset({ libraryId: workspace.library.libraryId, projectId, assetId: result.asset.id })).resolves.toBeNull();
      await expect(readFile(externalPath, 'utf8')).resolves.toBe('external');
    } finally {
      workspace.close();
      await rm(externalRoot, { recursive: true, force: true });
    }
  });
});
