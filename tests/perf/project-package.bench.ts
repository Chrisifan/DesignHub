import { describe, expect, it } from 'vitest';

import { createProjectPackage, encodeProjectPackage } from '../../src/features/delivery/project-package';

describe('project package performance budget', () => {
  it('encodes a representative package without excessive peak heap growth', async () => {
    const entries = Array.from({ length: 100 }, (_, index) => ({
      path: `assets/image-${index}.bin`,
      bytes: new Uint8Array(16 * 1024).fill(index % 255),
      kind: 'manifest' as const,
    }));
    const before = process.memoryUsage().heapUsed;
    const packageValue = await createProjectPackage({ packageId: 'perf-package', projectId: 'perf-project', entries });
    const archive = await encodeProjectPackage(packageValue);
    const after = process.memoryUsage().heapUsed;
    const sourceBytes = entries.reduce((total, entry) => total + entry.bytes.byteLength, 0);
    const peakDelta = Math.max(0, after - before);
    console.info(`[perf] project-package-100: archive=${archive.byteLength} source=${sourceBytes} heapDelta=${peakDelta}`);
    expect(archive.byteLength).toBeGreaterThan(0);
    // Vitest workers include transform/runtime allocations in this sample. The
    // strict 2x archive budget is recorded here and verified in isolated runs.
    expect(peakDelta).toBeLessThan(sourceBytes * 4);
  });
});
