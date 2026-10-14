// @vitest-environment node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { expect, it } from 'vitest';

import { importProjectPackageArchive } from '../../src/desktop/storage/project-package-import';
import { createProjectStore, resolveProjectDirectory } from '../../src/desktop/storage/project-store';
import { createTemporaryProjectLibrary } from '../fixtures/project-library';

const sourceProjectId = '11111111-1111-4111-8111-111111111111';

const createArchive = ({
  entries = {},
  assets = [],
}: {
  entries?: Record<string, Uint8Array>;
  assets?: unknown[];
} = {}): Uint8Array => {
  const projectManifest = {
    kind: 'designhub-project',
    projectId: sourceProjectId,
    operationId: 'source-operation',
    name: 'Imported project',
    formatVersion: 1,
    createdAt: '2026-10-14T00:00:00.000Z',
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
