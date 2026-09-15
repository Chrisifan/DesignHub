import { describe, expect, it } from 'vitest';

import {
  buildReleaseCheckReport,
  getReleaseCommands,
  scanPackageArtifacts,
} from '../../scripts/release-check.mjs';

describe('release check orchestration', () => {
  it('keeps local gates serial and puts the diff check last', () => {
    expect(getReleaseCommands(false).map(([name]) => name)).toEqual([
      'test:unit',
      'test:integration',
      'test:e2e',
      'test:native',
      'lint',
      'typecheck',
      'build',
      'diff-check',
    ]);
  });

  it('adds packaging before the final diff check when requested', () => {
    expect(getReleaseCommands(true).map(([name]) => name)).toEqual([
      'test:unit',
      'test:integration',
      'test:e2e',
      'test:native',
      'lint',
      'typecheck',
      'build',
      'package',
      'diff-check',
    ]);
  });

  it('reports blocked external gates without turning them into local failures', () => {
    const report = buildReleaseCheckReport([], {
      platform: 'darwin',
      node: 'v22.0.0',
      env: {},
      packageScan: { name: 'package-scan', status: 'passed', filesScanned: 0 },
    });

    expect(report.status).toBe('passed-with-blockers');
    expect(report.externalGates.map((gate) => gate.name)).toEqual([
      'windows-packaged',
      'signed-artifacts',
      'notarized-artifacts',
      'live-provider',
      'packaged-native',
      'keychain-persistence',
      'installer-upgrade',
    ]);
  });

  it('fails the report when a local gate fails', () => {
    const report = buildReleaseCheckReport([{ name: 'lint', status: 'failed', exitCode: 1, elapsedMs: 4 }], {
      platform: 'darwin',
      node: 'v22.0.0',
      env: {},
    });

    expect(report.status).toBe('failed');
  });

  it('scans artifact contents for credential-shaped values', async () => {
    const result = await scanPackageArtifacts(['.vite']);
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('filesScanned');
  });
});
