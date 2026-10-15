// @vitest-environment node

import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { expect, it } from 'vitest';

import { importProjectPackageArchive } from '../../src/desktop/storage/project-package-import';
import { openProjectLibrary } from '../../src/desktop/storage/project-library-store';
import { createProjectStore, resolveProjectDirectory } from '../../src/desktop/storage/project-store';
import type { ProjectCanvasLayout, ProjectDesign, ProjectMetadataInput } from '../../src/features/projects/metadata';
import { createTemporaryProjectLibrary } from '../fixtures/project-library';

const sourceProjectId = '11111111-1111-4111-8111-111111111111';

const createArchive = ({
  entries = {},
  assets = [],
  metadata,
}: {
  entries?: Record<string, Uint8Array>;
  assets?: unknown[];
  metadata?: ProjectMetadataInput;
} = {}): Uint8Array => {
  const projectManifest = {
    kind: 'designhub-project',
    projectId: sourceProjectId,
    operationId: 'source-operation',
    name: 'Imported project',
    formatVersion: 1,
    createdAt: '2026-10-14T00:00:00.000Z',
    ...(metadata ? { metadata } : {}),
  };
  const contentManifest = { formatVersion: 1, projectId: sourceProjectId, assets };
  const payload = {
    'designhub.project.json': new TextEncoder().encode(JSON.stringify(projectManifest)),
    'content-manifest.json': new TextEncoder().encode(JSON.stringify(contentManifest)),
    ...entries,
  };
  return zipSync({
    'designhub.package.json': new TextEncoder().encode(JSON.stringify({
      packageId: 'package-1',
      projectId: sourceProjectId,
      readOnly: false,
      entries: Object.keys(payload),
    })),
    ...payload,
  });
};

const packagedDesign: ProjectDesign = {
  id: 'packaged-design',
  projectId: sourceProjectId,
  assetId: 'asset-1',
  sourceTaskId: 'source-image-task',
  sourceConversationTaskId: 'source-conversation-task',
  width: 1,
  height: 1,
  title: 'Packaged design',
  createdAt: '2026-10-13T12:00:00.000Z',
};

const packagedLayout: ProjectCanvasLayout = {
  viewport: { zoom: 1.5, offsetX: -120, offsetY: 80 },
  nodes: { 'packaged-design': { x: 48, y: -32 } },
  selectedDesignIds: ['packaged-design'],
};

const packagedMetadata: ProjectMetadataInput = {
  projectId: sourceProjectId,
  workspaceId: 'source-workspace',
  name: 'Imported project',
  brief: 'Preserve the editable canvas',
  generationRatio: '16:9',
  activeDesignerVersionId: 'designer-v1',
  contributorDesignerVersionIds: ['designer-v1', 'designer-v2'],
  designerSnapshot: { name: 'Packaged designer', versionId: 'designer-v1' },
  coverAssetId: 'asset-1',
  designs: [packagedDesign],
  canvasLayout: packagedLayout,
};

const managedAssetFixture = () => {
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=', 'base64');
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  const storagePath = `assets/${contentHash}`;
  return {
    bytes,
    storagePath,
    entries: { [storagePath]: bytes },
    assets: [{ assetId: 'asset-1', managed: true, contentHash, storagePath }],
  };
};

for (const mode of ['streamed', 'in-memory'] as const) {
  it(`restores editable designs and layout from a ${mode} package and persists edits after library reopen`, async () => {
    const fixture = await createTemporaryProjectLibrary('designhub-package-editable-');
    let reopened: Awaited<ReturnType<typeof openProjectLibrary>> | undefined;
    try {
      const asset = managedAssetFixture();
      const archive = createArchive({ ...asset, metadata: packagedMetadata });
      const libraryId = fixture.workspace.library.libraryId;
      const store = createProjectStore(fixture.workspace);
      const archivePath = join(fixture.directory, 'editable.designhub.zip');
      await writeFile(archivePath, archive);
      const imported = mode === 'streamed'
        ? await importProjectPackageArchive(fixture.workspace, { libraryId, operationId: 'import-editable', archivePath })
        : await store.importProjectPackage({ libraryId, operationId: 'import-editable', archive });
      const identity = { libraryId, projectId: imported.projectId };
      const importedDesign = { ...packagedDesign, projectId: imported.projectId };

      expect(imported.projectId).not.toBe(sourceProjectId);
      await expect(store.listProjectDesigns(identity)).resolves.toEqual([importedDesign]);
      await expect(store.loadProjectCanvasLayout(identity)).resolves.toEqual(packagedLayout);
      await expect(store.getProjectMetadata(imported.projectId)).resolves.toMatchObject({
        projectId: imported.projectId,
        workspaceId: libraryId,
        name: 'Imported project',
        brief: 'Preserve the editable canvas',
        generationRatio: '16:9',
        activeDesignerVersionId: 'designer-v1',
        contributorDesignerVersionIds: ['designer-v1', 'designer-v2'],
        designerSnapshot: { name: 'Packaged designer', versionId: 'designer-v1' },
        coverAssetId: 'asset-1',
      });

      await store.updateProjectMetadata({ ...identity, patch: { name: 'Edited imported project', brief: 'Edited brief' } });
      const appendedDesign: ProjectDesign = {
        id: 'appended-design', projectId: imported.projectId, assetId: 'asset-1',
        sourceTaskId: 'local-image-task', width: 1, height: 1, title: 'Appended design',
        createdAt: '2026-10-15T00:00:00.000Z',
      };
      await store.addProjectDesigns({ ...identity, designs: [appendedDesign] });
      const editedLayout: ProjectCanvasLayout = {
        viewport: { zoom: 0.75, offsetX: 200, offsetY: -100 },
        nodes: { 'packaged-design': { x: 64, y: 96 }, 'appended-design': { x: 320, y: 96 } },
        selectedDesignIds: ['appended-design'],
      };
      await store.saveProjectCanvasLayout({ ...identity, layout: editedLayout });
      fixture.workspace.close();
      reopened = await openProjectLibrary(fixture.workspace.library.directory);
      const reopenedStore = createProjectStore(reopened);

      await expect(reopenedStore.listActiveProjects()).resolves.toEqual([
        expect.objectContaining({ projectId: imported.projectId, name: 'Edited imported project', brief: 'Edited brief' }),
      ]);
      await expect(reopenedStore.listProjectDesigns(identity)).resolves.toEqual([importedDesign, appendedDesign]);
      await expect(reopenedStore.loadProjectCanvasLayout(identity)).resolves.toEqual(editedLayout);
      const projectDirectory = resolveProjectDirectory(reopened, imported.projectId);
      expect(projectDirectory).not.toBeNull();
      await expect(readFile(join(projectDirectory as string, asset.storagePath))).resolves.toEqual(asset.bytes);
    } finally {
      reopened?.close();
      await fixture.cleanup();
    }
  });

  it.each([
    { reference: 'design', managed: undefined },
    { reference: 'design', managed: false },
    { reference: 'cover', managed: undefined },
    { reference: 'cover', managed: false },
  ] as const)(`rejects a ${mode} package with a $reference asset outside the managed manifest (managed=$managed) without publication`, async ({ reference, managed }) => {
    const fixture = await createTemporaryProjectLibrary('designhub-package-broken-reference-');
    try {
      const asset = managedAssetFixture();
      const metadata: ProjectMetadataInput = reference === 'design'
        ? { ...packagedMetadata, designs: [{ ...packagedDesign, assetId: 'undeclared-asset' }] }
        : { ...packagedMetadata, coverAssetId: 'undeclared-asset' };
      const archive = createArchive({
        ...asset,
        assets: [...asset.assets, ...(managed === undefined ? [] : [{ assetId: 'undeclared-asset', managed }])],
        metadata,
      });
      const archivePath = join(fixture.directory, 'broken.designhub.zip');
      await writeFile(archivePath, archive);
      const libraryId = fixture.workspace.library.libraryId;
      const store = createProjectStore(fixture.workspace);
      const importing = mode === 'streamed'
        ? importProjectPackageArchive(fixture.workspace, { libraryId, operationId: 'import-broken', archivePath })
        : store.importProjectPackage({ libraryId, operationId: 'import-broken', archive });

      await expect(importing).rejects.toThrow('INVALID_PACKAGE');
      await expect(store.listActiveProjects()).resolves.toEqual([]);
      await expect(readdir(join(fixture.workspace.library.directory, 'projects'))).resolves.toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });
}

it('imports a validated project package from its archive path', async () => {
  const fixture = await createTemporaryProjectLibrary('designhub-package-import-');
  try {
    const archivePath = join(fixture.directory, 'project.designhub.zip');
    await writeFile(archivePath, createArchive());

    const imported = await importProjectPackageArchive(fixture.workspace, {
      libraryId: fixture.workspace.library.libraryId,
      operationId: 'import-operation',
      archivePath,
    });

    expect(imported.projectId).not.toBe(sourceProjectId);
    await expect(createProjectStore(fixture.workspace).listActiveProjects()).resolves.toEqual([
      expect.objectContaining({ projectId: imported.projectId, name: 'Imported project' }),
    ]);
  } finally {
    await fixture.cleanup();
  }
});

it('rejects declared files outside the project content closure without publishing a project', async () => {
  const fixture = await createTemporaryProjectLibrary('designhub-package-private-entry-');
  try {
    const archivePath = join(fixture.directory, 'project.designhub.zip');
    await writeFile(archivePath, createArchive({ entries: { 'credentials.txt': new TextEncoder().encode('secret') } }));

    await expect(importProjectPackageArchive(fixture.workspace, {
      libraryId: fixture.workspace.library.libraryId,
      operationId: 'import-private-entry',
      archivePath,
    })).rejects.toThrow('INVALID_PACKAGE');
    await expect(createProjectStore(fixture.workspace).listActiveProjects()).resolves.toEqual([]);
  } finally {
    await fixture.cleanup();
  }
});

it('validates and copies managed asset bytes without materializing the archive in the service', async () => {
  const fixture = await createTemporaryProjectLibrary('designhub-package-asset-');
  try {
    const assetBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const contentHash = createHash('sha256').update(assetBytes).digest('hex');
    const storagePath = `assets/${contentHash}`;
    const archivePath = join(fixture.directory, 'project.designhub.zip');
    await writeFile(archivePath, createArchive({
      entries: { [storagePath]: assetBytes },
      assets: [{ assetId: 'asset-1', managed: true, contentHash, storagePath }],
    }));

    const imported = await importProjectPackageArchive(fixture.workspace, {
      libraryId: fixture.workspace.library.libraryId,
      operationId: 'import-managed-asset',
      archivePath,
    });

    const projectDirectory = resolveProjectDirectory(fixture.workspace, imported.projectId);
    expect(projectDirectory).not.toBeNull();
    await expect(readFile(join(projectDirectory as string, storagePath))).resolves.toEqual(Buffer.from(assetBytes));
  } finally {
    await fixture.cleanup();
  }
});

it('rejects an archive that exceeds the expanded-size limit without publishing a project', async () => {
  const fixture = await createTemporaryProjectLibrary('designhub-package-limit-');
  try {
    const archivePath = join(fixture.directory, 'project.designhub.zip');
    await writeFile(archivePath, createArchive());

    await expect(importProjectPackageArchive(fixture.workspace, {
      libraryId: fixture.workspace.library.libraryId,
      operationId: 'import-over-limit',
      archivePath,
    }, { maxExpandedBytes: 64 })).rejects.toThrow('PROJECT_PACKAGE_LIMIT');
    await expect(createProjectStore(fixture.workspace).listActiveProjects()).resolves.toEqual([]);
  } finally {
    await fixture.cleanup();
  }
});
