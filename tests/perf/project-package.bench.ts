// @vitest-environment node

import { createHash, randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { importProjectPackageArchive } from '../../src/desktop/storage/project-package-import';
import { createTemporaryProjectLibrary } from '../fixtures/project-library';

const sourceProjectId = '22222222-2222-4222-8222-222222222222';

describe('project package performance budget', () => {
  it('imports a representative package with less than twice the archive size in extra memory', async () => {
    const fixture = await createTemporaryProjectLibrary('designhub-package-perf-');
    try {
      const payload: Record<string, Uint8Array> = {};
      const assets = Array.from({ length: 64 }, (_, index) => {
        const bytes = randomBytes(256 * 1024);
        const contentHash = createHash('sha256').update(bytes).digest('hex');
        const storagePath = `assets/${contentHash}`;
        payload[storagePath] = bytes;
        return { assetId: `asset-${index}`, managed: true, contentHash, storagePath };
      });
      payload['designhub.project.json'] = new TextEncoder().encode(JSON.stringify({
        kind: 'designhub-project',
        projectId: sourceProjectId,
        operationId: 'perf-source',
        name: 'Performance package',
        formatVersion: 1,
        createdAt: '2026-10-14T00:00:00.000Z',
      }));
      payload['content-manifest.json'] = new TextEncoder().encode(JSON.stringify({ formatVersion: 1, projectId: sourceProjectId, assets }));
      const archive = zipSync({
        'designhub.package.json': new TextEncoder().encode(JSON.stringify({
          packageId: 'perf-package',
          projectId: sourceProjectId,
          readOnly: false,
          entries: Object.keys(payload),
        })),
        ...payload,
      }, { level: 0 });
      const archivePath = join(fixture.directory, 'perf.designhub.zip');
      await writeFile(archivePath, archive);

      const memory = (): number => {
        const usage = process.memoryUsage();
        return usage.heapUsed + usage.arrayBuffers;
      };
      const before = memory();
      let peak = before;
      const sampler = setInterval(() => { peak = Math.max(peak, memory()); }, 1);
      try {
        await importProjectPackageArchive(fixture.workspace, {
          libraryId: fixture.workspace.library.libraryId,
          operationId: 'perf-import',
          archivePath,
        });
      } finally {
        clearInterval(sampler);
      }
      peak = Math.max(peak, memory());
      const peakDelta = Math.max(0, peak - before);
      console.info(`[perf] project-package-import: archive=${archive.byteLength} peakDelta=${peakDelta}`);
      expect(peakDelta).toBeLessThan(archive.byteLength * 2);
    } finally {
      await fixture.cleanup();
    }
  });
});
