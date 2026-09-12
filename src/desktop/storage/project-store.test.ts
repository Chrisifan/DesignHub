// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjectPackage, encodeProjectPackage } from '../../features/delivery/project-package';

import { expect, it } from 'vitest';

import { createProjectStore, importProjectPackageToWorkspace, projectManifestName } from './project-store';
import { loadDocumentRevisions } from './revision-store';
import { createWorkspace, openWorkspace } from './workspace-store';

const withWorkspace = async (run: (parentDirectory: string, workspaceDirectory: string) => Promise<void>): Promise<void> => {
  const parentDirectory = await mkdtemp(join(tmpdir(), 'designhub-project-store-'));
  const workspace = await createWorkspace({ parentDirectory, name: 'workspace' });
  const workspaceDirectory = workspace.workspace.directory;
  workspace.close();
  try {
    await run(parentDirectory, workspaceDirectory);
  } finally {
    await rm(parentDirectory, { recursive: true, force: true });
  }
};

it('lists active project metadata after creating a project', async () => {
  await withWorkspace(async (_parentDirectory, workspaceDirectory) => {
    const workspace = await openWorkspace(workspaceDirectory);
    try {
      const store = createProjectStore(workspace);
      expect(await store.listActiveProjects()).toEqual([]);
      const created = await store.createProjectContainer({
        workspaceId: workspace.workspace.workspaceId,
        operationId: 'manual-create-1',
        name: 'Persisted project',
      });
      await expect(store.listActiveProjects()).resolves.toEqual([
        { projectId: created.projectId, name: 'Persisted project' },
      ]);
    } finally {
      workspace.close();
    }
  });
});

it('lists projects again after reopening the workspace', async () => {
  await withWorkspace(async (_parentDirectory, workspaceDirectory) => {
    const first = await openWorkspace(workspaceDirectory);
    const projectId = (await createProjectStore(first).createProjectContainer({
      workspaceId: first.workspace.workspaceId,
      operationId: 'manual-create-reload',
      name: 'Reload me',
    })).projectId;
    first.close();

    const reopened = await openWorkspace(workspaceDirectory);
    try {
      await expect(createProjectStore(reopened).listActiveProjects()).resolves.toEqual([
        { projectId, name: 'Reload me' },
      ]);
    } finally {
      reopened.close();
    }
  });
});

it('persists project brief, designer and document metadata across reopen', async () => {
  await withWorkspace(async (_parentDirectory, workspaceDirectory) => {
    const first = await openWorkspace(workspaceDirectory);
    const created = await createProjectStore(first).createProjectContainer({
      workspaceId: first.workspace.workspaceId,
      operationId: 'metadata-create',
      name: 'Metadata project',
      brief: 'A local campaign',
      activeDesignerVersionId: 'paper-type-v1',
      designerSnapshot: { versionId: 'paper-type-v1', name: 'Paper & type' },
      brandSnapshot: { version: 'brand-v2', colors: ['#fff'] },
      documents: [{ id: 'doc-1', name: 'Poster', width: 1080, height: 1440 }],
    });
    await expect(createProjectStore(first).getProjectMetadata(created.projectId)).resolves.toMatchObject({
      projectId: created.projectId,
      brief: 'A local campaign',
      activeDesignerVersionId: 'paper-type-v1',
      documents: [{ id: 'doc-1', width: 1080, height: 1440 }],
    });
    first.close();

    const reopened = await openWorkspace(workspaceDirectory);
    try {
      await expect(createProjectStore(reopened).getProjectMetadata(created.projectId)).resolves.toMatchObject({
        name: 'Metadata project',
        designerSnapshot: { versionId: 'paper-type-v1' },
        brandSnapshot: { version: 'brand-v2' },
      });
      await expect(createProjectStore(reopened).updateProjectMetadata({
        workspaceId: reopened.workspace.workspaceId,
        projectId: created.projectId,
        patch: { name: 'Renamed project', archived: true },
      })).resolves.toMatchObject({ name: 'Renamed project', archived: true });
      await expect(createProjectStore(reopened).listActiveProjects()).resolves.toEqual([
        expect.objectContaining({ projectId: created.projectId, name: 'Renamed project', archived: true }),
      ]);
    } finally {
      reopened.close();
    }
  });
});

it('imports a validated project package into the workspace and rewrites project identity', async () => {
  await withWorkspace(async (_parentDirectory, workspaceDirectory) => {
    const workspace = await openWorkspace(workspaceDirectory);
    try {
      const sourceProjectId = '8f6f1f22-8f68-4db5-8ca6-0c15f9f43631';
      const pack = await createProjectPackage({
        packageId: 'pkg-import-1',
        projectId: sourceProjectId,
        entries: [
          { path: 'designhub.project.json', kind: 'manifest', bytes: new TextEncoder().encode(JSON.stringify({
            kind: 'designhub-project', projectId: sourceProjectId, operationId: 'source-op', name: 'Imported project', formatVersion: 1, createdAt: new Date().toISOString(),
            metadata: { projectId: sourceProjectId, workspaceId: 'source-workspace', name: 'Imported project', brief: 'Imported brief', documents: [{ id: 'doc-1', name: 'Poster', width: 100, height: 200, updatedAt: new Date().toISOString() }], archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          })) },
          { path: 'content-manifest.json', kind: 'manifest', bytes: new TextEncoder().encode(JSON.stringify({ formatVersion: 1, projectId: sourceProjectId, assets: [] })) },
          { path: 'documents/doc-1.scene.json', kind: 'manifest', bytes: new TextEncoder().encode('{"id":"doc-1","width":100,"height":200,"layers":[]}' ) },
        ],
      });
      const archive = await encodeProjectPackage(pack);
      const result = await importProjectPackageToWorkspace(workspace, { workspaceId: workspace.workspace.workspaceId, operationId: 'import-op-1', archive });
      expect(result.projectId).not.toBe(sourceProjectId);
      await expect(createProjectStore(workspace).getProjectMetadata(result.projectId)).resolves.toMatchObject({ name: 'Imported project', brief: 'Imported brief', documents: [{ id: 'doc-1', width: 100, height: 200 }] });
    } finally { workspace.close(); }
  });
});

it('rejects importing the same package identity twice', async () => {
  await withWorkspace(async (_parentDirectory, workspaceDirectory) => {
    const workspace = await openWorkspace(workspaceDirectory);
    try {
      const sourceProjectId = '8f6f1f22-8f68-4db5-8ca6-0c15f9f43631';
      const now = new Date().toISOString();
      const pack = await createProjectPackage({ packageId: 'pkg-import-duplicate', projectId: sourceProjectId, entries: [
        { path: 'designhub.project.json', kind: 'manifest', bytes: new TextEncoder().encode(JSON.stringify({ kind: 'designhub-project', projectId: sourceProjectId, operationId: 'source-op', name: 'Imported', formatVersion: 1, createdAt: now, metadata: { projectId: sourceProjectId, workspaceId: 'source', name: 'Imported', documents: [], archived: false, createdAt: now, updatedAt: now } })) },
        { path: 'content-manifest.json', kind: 'manifest', bytes: new TextEncoder().encode(JSON.stringify({ formatVersion: 1, projectId: sourceProjectId, assets: [] })) },
      ] });
      const archive = await encodeProjectPackage(pack);
      await importProjectPackageToWorkspace(workspace, { workspaceId: workspace.workspace.workspaceId, operationId: 'import-op-a', archive });
      await expect(importProjectPackageToWorkspace(workspace, { workspaceId: workspace.workspace.workspaceId, operationId: 'import-op-b', archive })).rejects.toThrow('PACKAGE_ALREADY_IMPORTED');
    } finally { workspace.close(); }
  });
});

it('rejects an imported package whose content manifest omits managed asset bytes before creating a project', async () => {
  await withWorkspace(async (_parentDirectory, workspaceDirectory) => {
    const workspace = await openWorkspace(workspaceDirectory);
    try {
      const sourceProjectId = '8f6f1f22-8f68-4db5-8ca6-0c15f9f43631';
      const now = new Date().toISOString();
      const contentHash = 'a'.repeat(64);
      const pack = await createProjectPackage({
        packageId: 'pkg-missing-asset',
        projectId: sourceProjectId,
        entries: [
          { path: 'designhub.project.json', kind: 'manifest', bytes: new TextEncoder().encode(JSON.stringify({ kind: 'designhub-project', projectId: sourceProjectId, operationId: 'source-op', name: 'Missing asset', formatVersion: 1, createdAt: now, metadata: { projectId: sourceProjectId, workspaceId: 'source', name: 'Missing asset', documents: [], archived: false, createdAt: now, updatedAt: now } })) },
          { path: 'content-manifest.json', kind: 'manifest', bytes: new TextEncoder().encode(JSON.stringify({ formatVersion: 1, projectId: sourceProjectId, assets: [{ id: `asset-${contentHash.slice(0, 16)}`, name: 'poster.png', format: 'PNG', mimeType: 'image/png', contentHash, managed: true, storagePath: `assets/${contentHash}` }] })) },
        ],
      });
      const archive = await encodeProjectPackage(pack);
      await expect(importProjectPackageToWorkspace(workspace, { workspaceId: workspace.workspace.workspaceId, operationId: 'import-missing-asset', archive })).rejects.toThrow('INVALID_PACKAGE');
      await expect(createProjectStore(workspace).listActiveProjects()).resolves.toEqual([]);
    } finally {
      workspace.close();
    }
  });
});

it('preserves related document lineage when duplicating a project', async () => {
  await withWorkspace(async (_parentDirectory, workspaceDirectory) => {
    const workspace = await openWorkspace(workspaceDirectory);
    try {
      const store = createProjectStore(workspace);
      const source = await store.createProjectContainer({
        workspaceId: workspace.workspace.workspaceId,
        operationId: 'duplicate-lineage-source',
        name: 'Lineage source',
        documents: [
          { id: 'doc-main', name: 'Main', width: 1080, height: 1440, finalizedRevisionId: 'rev-main' },
          { id: 'doc-square', name: 'Square', width: 1080, height: 1080, sourceDocumentId: 'doc-main', sourceRevisionId: 'rev-main', finalizedRevisionId: null },
        ],
      });
      const duplicate = await store.duplicateProject({
        workspaceId: workspace.workspace.workspaceId,
        sourceProjectId: source.projectId,
        operationId: 'duplicate-lineage-copy',
      });
      await expect(store.getProjectMetadata(duplicate.projectId)).resolves.toMatchObject({
        documents: [
          { id: 'doc-main', finalizedRevisionId: 'rev-main' },
          { id: 'doc-square', sourceDocumentId: 'doc-main', sourceRevisionId: 'rev-main', finalizedRevisionId: null },
        ],
      });
    } finally {
      workspace.close();
    }
  });
});

it('rewrites imported revision project identities while preserving revision content', async () => {
  await withWorkspace(async (_parentDirectory, workspaceDirectory) => {
    const workspace = await openWorkspace(workspaceDirectory);
    try {
      const sourceProjectId = '8f6f1f22-8f68-4db5-8ca6-0c15f9f43631';
      const revisionId = 'revision-source-1';
      const now = new Date().toISOString();
      const pack = await createProjectPackage({
        packageId: 'pkg-revision-identity',
        projectId: sourceProjectId,
        entries: [
          { path: projectManifestName, kind: 'manifest', bytes: new TextEncoder().encode(JSON.stringify({ kind: 'designhub-project', projectId: sourceProjectId, operationId: 'source-op', name: 'Revision import', formatVersion: 1, createdAt: now, metadata: { projectId: sourceProjectId, workspaceId: 'source', name: 'Revision import', documents: [{ id: 'doc-1', name: 'Poster', width: 100, height: 100, finalizedRevisionId: revisionId }], archived: false, createdAt: now, updatedAt: now } })) },
          { path: 'content-manifest.json', kind: 'manifest', bytes: new TextEncoder().encode(JSON.stringify({ formatVersion: 1, projectId: sourceProjectId, assets: [] })) },
          { path: 'documents/doc-1.revisions.json', kind: 'manifest', bytes: new TextEncoder().encode(JSON.stringify({ formatVersion: 1, revisions: [{ revisionId, projectId: sourceProjectId, documentId: 'doc-1', parentRevisionId: null, operationId: 'revision-op', sceneAssetId: 'scene-1', assetIds: [], contributions: [], createdAt: now }], timeline: [{ id: `event-${revisionId}`, kind: 'revision', label: 'Revision', documentId: 'doc-1', revisionId, timestamp: now }], finalRevisionId: revisionId })) },
        ],
      });
      const archive = await encodeProjectPackage(pack);
      const result = await importProjectPackageToWorkspace(workspace, { workspaceId: workspace.workspace.workspaceId, operationId: 'import-revision-identity', archive });
      const state = await loadDocumentRevisions(workspace, workspace.workspace.workspaceId, result.projectId, 'doc-1');
      expect(state.revisions[0]?.projectId).toBe(result.projectId);
      expect(state.revisions[0]?.revisionId).toBe(revisionId);
    } finally {
      workspace.close();
    }
  });
});
