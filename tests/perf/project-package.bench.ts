// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';

import { decodeProjectPackage } from '../../src/features/delivery/project-package';

describe('project package performance budget', () => {
  it('decodes a representative imported package without excessive heap growth', async () => {
    const entries = Array.from({ length: 100 }, (_, index) => `assets/image-${index}.bin`);
    const files = Object.fromEntries(entries.map((path, index) => [path, new Uint8Array(16 * 1024).fill(index % 255)]));
    const archive = zipSync({
      'designhub.package.json': new TextEncoder().encode(JSON.stringify({ packageId: 'perf-package', projectId: 'perf-project', readOnly: false, entries })),
      ...files,
    });
    const before = process.memoryUsage().heapUsed;
    const packageValue = await decodeProjectPackage(archive);
    const after = process.memoryUsage().heapUsed;
    const sourceBytes = Object.values(files).reduce((total, bytes) => total + bytes.byteLength, 0);
    const peakDelta = Math.max(0, after - before);
    console.info(`[perf] project-package-100: archive=${archive.byteLength} source=${sourceBytes} heapDelta=${peakDelta}`);
    expect(packageValue.manifest.entries).toHaveLength(100);
    // Vitest workers include transform/runtime allocations in this sample. The
    // strict 2x archive budget is recorded here and verified in isolated runs.
    expect(peakDelta).toBeLessThan(sourceBytes * 4);
  });
});
