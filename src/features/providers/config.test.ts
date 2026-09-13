import { expect, it } from 'vitest';

import { normalizeProviderConfig, type ProviderConfig } from './config';

it('accepts an https endpoint and per-capability model names', () => {
  expect(normalizeProviderConfig({
    baseUrl: ' https://api.example.test/v1/ ',
    models: {
      conversation: ' chat-model ',
      'image-generation': 'image-model',
    },
  })).toEqual({
    baseUrl: 'https://api.example.test/v1',
    models: {
      conversation: 'chat-model',
      'image-generation': 'image-model',
    },
  } satisfies ProviderConfig);
});

it('rejects malformed endpoints, credentials, and unsupported model settings', () => {
  expect(normalizeProviderConfig(null)).toBeNull();
  expect(normalizeProviderConfig({ baseUrl: '' })).toBeNull();
  expect(normalizeProviderConfig({ baseUrl: 'file:///tmp/provider' })).toBeNull();
  expect(normalizeProviderConfig({ baseUrl: 'https://user:pass@example.test/v1' })).toBeNull();
  expect(normalizeProviderConfig({ baseUrl: 'https://example.test', apiKey: 'secret' })).toBeNull();
  expect(normalizeProviderConfig({ baseUrl: 'https://example.test', models: { custom: 'x' } })).toBeNull();
  expect(normalizeProviderConfig({ baseUrl: 'https://example.test', models: { conversation: 'x'.repeat(129) } })).toBeNull();
});
