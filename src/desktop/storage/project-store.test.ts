// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjectPackage, encodeProjectPackage } from '../../features/delivery/project-package';

import { expect, it } from 'vitest';

import { createProjectStore, importProjectPackageToWorkspace } from './project-store';
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
