import { expect, it } from 'vitest';

import {
  getProviderProfileStatus,
  isProviderProfileStatusCacheValid,
  providerConfigFingerprint,
  type ProviderConnectionStatusMap,
  type ProviderProfileStatus,
} from './status';

const config = {
  conversation: { baseUrl: 'https://text.example.test/v1', models: { conversation: 'chat-model' } },
  image: { baseUrl: 'https://image.example.test/v1', imageTransport: 'images' as const, models: { 'image-generation': 'image-model' } },
};

it('returns a saved test result only when it matches the current profile configuration', () => {
  const statuses: ProviderConnectionStatusMap = {
    'openai-compatible': {
      conversation: { status: 'connected', testedAt: '2026-10-08T00:00:00.000Z', configFingerprint: providerConfigFingerprint(config, 'conversation') },
    },
  };

  expect(getProviderProfileStatus(statuses, 'openai-compatible', 'conversation', config)).toBe('connected');
  expect(getProviderProfileStatus(statuses, 'openai-compatible', 'image', config)).toBe('unknown');
  expect(getProviderProfileStatus(statuses, 'openai-compatible', 'conversation', { ...config, conversation: { ...config.conversation, baseUrl: 'https://other.example.test/v1' } })).toBe('unknown');
});

it('does not include credentials or unrelated configuration in the fingerprint', () => {
  expect(providerConfigFingerprint(config, 'conversation')).toBe(providerConfigFingerprint({
    ...config,
    image: { ...config.image, models: { 'image-generation': 'different-image-model' } },
  }, 'conversation'));
});

it('uses a matching successful provider test through the 30 minute cache boundary', () => {
  const statuses: ProviderConnectionStatusMap = {
    'openai-compatible': {
      conversation: {
        status: 'connected',
        testedAt: '2026-10-08T11:30:00.000Z',
        configFingerprint: providerConfigFingerprint(config, 'conversation'),
      },
    },
  };

  expect(isProviderProfileStatusCacheValid(
    statuses,
    'openai-compatible',
    'conversation',
    config,
    new Date('2026-10-08T12:00:00.000Z').getTime(),
  )).toBe(true);
  expect(isProviderProfileStatusCacheValid(
    statuses,
    'openai-compatible',
    'conversation',
    config,
    new Date('2026-10-08T12:00:00.001Z').getTime(),
  )).toBe(false);
});

it('rejects failed, malformed, future, and configuration-mismatched provider test results', () => {
  const testedAt = '2026-10-08T11:45:00.000Z';
  const fingerprint = providerConfigFingerprint(config, 'conversation');
  const status = (overrides: Partial<ProviderProfileStatus> = {}): ProviderConnectionStatusMap => ({
    'openai-compatible': {
      conversation: { status: 'connected', testedAt, configFingerprint: fingerprint, ...overrides },
    },
  });
  const now = new Date('2026-10-08T12:00:00.000Z').getTime();

  expect(isProviderProfileStatusCacheValid(status({ status: 'error' }), 'openai-compatible', 'conversation', config, now)).toBe(false);
  expect(isProviderProfileStatusCacheValid(status({ testedAt: 'not-a-date' }), 'openai-compatible', 'conversation', config, now)).toBe(false);
  expect(isProviderProfileStatusCacheValid(status({ testedAt: '2026-10-08T12:00:00.001Z' }), 'openai-compatible', 'conversation', config, now)).toBe(false);
  expect(isProviderProfileStatusCacheValid(status({ configFingerprint: 'stale' }), 'openai-compatible', 'conversation', config, now)).toBe(false);
});
