// @vitest-environment node

import { mkdtemp, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createProjectStore } from './project-store';
import { initializeProjectLibrary, openProjectLibrary } from './project-library-store';
import { commitDocumentRevision, loadDocumentRevisions, setFinalDocumentRevision } from './revision-store';

const withWorkspace = async (run: (workspaceDirectory: string) => Promise<void>): Promise<void> => {
  const parent = await mkdtemp(join(tmpdir(), 'designhub-revision-store-'));
  const created = await initializeProjectLibrary(parent);
  created.close();
  try { await run(created.library.directory); } finally { await rm(parent, { recursive: true, force: true }); }
};

it('persists document revisions and finalization across workspace reopen', async () => {
  await withWorkspace(async (directory) => {
    const workspace = await openProjectLibrary(directory);
    const projectId = (await createProjectStore(workspace).createProjectContainer({ workspaceId: workspace.library.libraryId, operationId: 'revision-project', name: 'Revision project', documents: [{ id: 'doc-1', name: 'Poster', width: 100, height: 200 }] })).projectId;
    const first = await commitDocumentRevision(workspace, { workspaceId: workspace.library.libraryId, projectId, documentId: 'doc-1', baseRevisionId: null, operationId: 'revision-1', sceneAssetId: 'scene-1', assetIds: ['asset-1'], contributions: [], operatorName: 'Designer' });
    await setFinalDocumentRevision(workspace, { workspaceId: workspace.library.libraryId, projectId, documentId: 'doc-1', revisionId: first.revisionId });
    await setFinalDocumentRevision(workspace, { workspaceId: workspace.library.libraryId, projectId, documentId: 'doc-1', revisionId: first.revisionId });
    const finalized = await loadDocumentRevisions(workspace, workspace.library.libraryId, projectId, 'doc-1');
    expect(finalized.timeline.filter((event) => event.kind === 'finalized')).toHaveLength(1);
    workspace.close();
    const reopened = await openProjectLibrary(directory);
    try {
      await expect(loadDocumentRevisions(reopened, workspace.library.libraryId, projectId, 'doc-1')).resolves.toMatchObject({ finalRevisionId: first.revisionId, revisions: [{ revisionId: first.revisionId, sceneAssetId: 'scene-1' }] });
    } finally { reopened.close(); }
  });
});

it('reuses an operation id and rejects a foreign parent revision', async () => {
  await withWorkspace(async (directory) => {
    const workspace = await openProjectLibrary(directory);
    try {
      const projectId = (await createProjectStore(workspace).createProjectContainer({ workspaceId: workspace.library.libraryId, operationId: 'revision-project-2', name: 'Revision project', documents: [{ id: 'doc-1', name: 'Poster', width: 100, height: 200 }, { id: 'doc-2', name: 'Square', width: 100, height: 100 }] })).projectId;
      const first = await commitDocumentRevision(workspace, { workspaceId: workspace.library.libraryId, projectId, documentId: 'doc-1', baseRevisionId: null, operationId: 'revision-duplicate', sceneAssetId: 'scene-1', assetIds: [], contributions: [] });
      await expect(commitDocumentRevision(workspace, { workspaceId: workspace.library.libraryId, projectId, documentId: 'doc-1', baseRevisionId: null, operationId: 'revision-duplicate', sceneAssetId: 'scene-1', assetIds: [], contributions: [] })).resolves.toEqual(first);
      await expect(commitDocumentRevision(workspace, { workspaceId: workspace.library.libraryId, projectId, documentId: 'doc-2', baseRevisionId: first.revisionId, operationId: 'revision-foreign', sceneAssetId: 'scene-2', assetIds: [], contributions: [] })).rejects.toThrow('REVISION_NOT_FOUND');
    } finally { workspace.close(); }
  });
});

it('rejects a symlinked revision state instead of reading outside the project', async () => {
  await withWorkspace(async (directory) => {
    const workspace = await openProjectLibrary(directory);
    try {
      const projectId = (await createProjectStore(workspace).createProjectContainer({
        workspaceId: workspace.library.libraryId,
        operationId: 'revision-symlink-project',
        name: 'Revision project',
        documents: [{ id: 'doc-1', name: 'Poster', width: 100, height: 200 }],
      })).projectId;
      await commitDocumentRevision(workspace, {
        workspaceId: workspace.library.libraryId,
        projectId,
        documentId: 'doc-1',
        baseRevisionId: null,
        operationId: 'revision-symlink-seed',
        sceneAssetId: 'scene-1',
        assetIds: [],
        contributions: [],
      });
      const projectDirectory = join(directory, 'projects', projectId);
      const revisionPath = join(projectDirectory, 'documents', 'doc-1.revisions.json');
      const externalPath = join(directory, 'external-revisions.json');
      await writeFile(externalPath, JSON.stringify({ formatVersion: 1, revisions: [], timeline: [], finalRevisionId: null }), 'utf8');
      await unlink(revisionPath);
      await symlink(externalPath, revisionPath);
      await expect(loadDocumentRevisions(workspace, workspace.library.libraryId, projectId, 'doc-1')).rejects.toThrow('INVALID_REVISION_STATE');
    } finally {
      workspace.close();
    }
  });
});
