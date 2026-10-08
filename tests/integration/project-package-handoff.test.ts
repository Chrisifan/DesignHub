// @vitest-environment node

import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { createProjectPackageArchive, writeProjectPackageArchive } from '../../src/desktop/storage/project-package-store';
import { createProjectStore } from '../../src/desktop/storage/project-store';
import { initializeProjectLibrary, openProjectLibrary } from '../../src/desktop/storage/project-library-store';
import { commitDocumentRevision, loadDocumentRevisions } from '../../src/desktop/storage/revision-store';
import { loadDocumentScene, saveDocumentScene } from '../../src/desktop/storage/scene-store';
import { decodeProjectPackage } from '../../src/features/delivery/project-package';
import { createScene } from '../../src/features/canvas/scene';

const cleanupDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

it('exports a real project, restores it without the source library, continues editing, and exports it again', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-package-handoff-'));
  cleanupDirectories.push(root);
  const sourceDirectory = join(root, 'source-library');
  const targetDirectory = join(root, 'target-library');
  await mkdir(sourceDirectory);
  await mkdir(targetDirectory);

  const sourceInitialized = await initializeProjectLibrary(sourceDirectory);
  sourceInitialized.close();
  const targetInitialized = await initializeProjectLibrary(targetDirectory);
  targetInitialized.close();

  const source = await openProjectLibrary(sourceDirectory);
  const sourceStore = createProjectStore(source);
  const created = await sourceStore.createProjectContainer({
    libraryId: source.library.libraryId,
    operationId: 'handoff-create',
    name: 'Portable campaign',
    brief: 'Continue this work in another library',
    documents: [{ id: 'doc-main', name: 'Main', width: 1080, height: 1440 }],
  });
  const sourceScene = createScene({ id: 'doc-main', width: 1080, height: 1440, layers: [] });
  await saveDocumentScene(source, source.library.libraryId, created.projectId, 'doc-main', sourceScene);
  const firstRevision = await commitDocumentRevision(source, {
    workspaceId: source.library.libraryId,
    projectId: created.projectId,
    documentId: 'doc-main',
    baseRevisionId: null,
    operationId: 'handoff-revision-1',
    sceneAssetId: 'scene-source',
    assetIds: [],
    contributions: [],
    scene: sourceScene,
  });
  const firstExport = await createProjectPackageArchive(source, created.projectId, { packageId: 'package-handoff-1' });
  source.close();

  await rm(sourceDirectory, { recursive: true, force: true });

  const target = await openProjectLibrary(targetDirectory);
  const imported = await createProjectStore(target).importProjectPackage({
    libraryId: target.library.libraryId,
    operationId: 'handoff-import',
    archive: firstExport.archive,
  });
  target.close();

  const reopened = await openProjectLibrary(targetDirectory);
  const importedStore = createProjectStore(reopened);
  await expect(importedStore.getProjectMetadata(imported.projectId)).resolves.toMatchObject({
    projectId: imported.projectId,
    name: 'Portable campaign',
    brief: 'Continue this work in another library',
  });
  await expect(loadDocumentScene(reopened, reopened.library.libraryId, imported.projectId, 'doc-main')).resolves.toEqual(sourceScene);
  await expect(loadDocumentRevisions(reopened, reopened.library.libraryId, imported.projectId, 'doc-main')).resolves.toMatchObject({
    revisions: [{ revisionId: firstRevision.revisionId, projectId: imported.projectId }],
  });

  const editedScene = createScene({ id: 'doc-main', width: 1200, height: 1440, layers: [] });
  await saveDocumentScene(reopened, reopened.library.libraryId, imported.projectId, 'doc-main', editedScene);
  await commitDocumentRevision(reopened, {
    workspaceId: reopened.library.libraryId,
    projectId: imported.projectId,
    documentId: 'doc-main',
    baseRevisionId: firstRevision.revisionId,
    operationId: 'handoff-revision-2',
    sceneAssetId: 'scene-target',
    assetIds: [],
    contributions: [],
    scene: editedScene,
  });
  const secondExport = await createProjectPackageArchive(reopened, imported.projectId, { packageId: 'package-handoff-2' });
  reopened.close();

  expect(secondExport.sha256).toMatch(/^[0-9a-f]{64}$/u);
  const decoded = await decodeProjectPackage(secondExport.archive);
  expect(decoded.manifest).toMatchObject({ packageId: 'package-handoff-2', projectId: imported.projectId });
  expect(JSON.parse(new TextDecoder().decode(decoded.files['documents/doc-main.scene.json']))).toMatchObject({ width: 1200 });
  expect(JSON.parse(new TextDecoder().decode(decoded.files['documents/doc-main.revisions.json']))).toMatchObject({
    revisions: [
      { revisionId: firstRevision.revisionId, projectId: imported.projectId },
      { projectId: imported.projectId, parentRevisionId: firstRevision.revisionId },
    ],
  });

  await expect(readFile(join(targetDirectory, 'projects', imported.projectId, 'designhub.project.json'), 'utf8')).resolves.toContain('package-handoff-1');
});

it('publishes package archives atomically without overwriting an existing export', async () => {
  const root = await mkdtemp(join(tmpdir(), 'designhub-package-publish-'));
  cleanupDirectories.push(root);
  const target = join(root, 'campaign.designhub.zip');
  const archive = new Uint8Array([80, 75, 3, 4, 1, 2, 3]);
  await writeFile(target, new Uint8Array([9, 9, 9]));

  await expect(writeProjectPackageArchive(target, archive)).rejects.toThrow('TARGET_EXISTS');
  await expect(readFile(target)).resolves.toEqual(Buffer.from([9, 9, 9]));
  expect((await readdir(root)).filter((name) => name.includes('.tmp-'))).toEqual([]);

  await rm(target);
  await expect(writeProjectPackageArchive(target, archive)).resolves.toBeUndefined();
  await expect(readFile(target)).resolves.toEqual(Buffer.from(archive));
  expect((await readdir(root)).filter((name) => name.includes('.tmp-'))).toEqual([]);
});
