import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

import { loadProviderConnectionStatuses, saveProviderConnectionStatuses } from './provider-status';
import type { ProviderConnectionStatusMap } from '../../features/providers/status';

it('round-trips provider connection test statuses without accepting arbitrary data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-provider-status-'));
  const path = join(directory, 'provider-status.json');
  const statuses: ProviderConnectionStatusMap = {
    'openai-compatible': {
      conversation: { status: 'connected', testedAt: '2026-10-08T00:00:00.000Z', configFingerprint: 'conversation-fingerprint' },
      image: { status: 'error', testedAt: '2026-10-08T00:00:01.000Z', configFingerprint: 'image-fingerprint' },
    },
  };

  await expect(saveProviderConnectionStatuses(path, statuses)).resolves.toBe(true);
  await expect(loadProviderConnectionStatuses(path)).resolves.toEqual(statuses);
  expect(await readFile(path, 'utf8')).not.toContain('apiKey');
});

it('returns an empty status map for a missing file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-provider-status-'));
  await expect(loadProviderConnectionStatuses(join(directory, 'missing.json'))).resolves.toEqual({});
});
