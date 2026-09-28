import { expect, it } from 'vitest';

import { connectionSummary, selectConfiguredConnection } from './connection';
import { providerCapabilities } from './adapter';
import type { ProviderConfigMap } from './config';

it('keeps connection summaries on the public whitelist and excludes secrets', () => {
  const summary = connectionSummary({
    id: 'p1',
    label: 'Work connection',
    apiKey: 'test-secret',
  });

  expect(summary).toEqual({ id: 'p1', label: 'Work connection' });
  expect(JSON.stringify(summary)).not.toContain('test-secret');
  expect(Object.keys(summary)).toEqual(['id', 'label']);
});

it('keeps vision analysis in the provider capability contract', () => {
  expect(providerCapabilities).toContain('vision-analysis');
});

it('selects only a configured connection with a credential for the requested capability', () => {
  const configs: ProviderConfigMap = {
    'openai-compatible': {
      conversation: { baseUrl: 'https://text.example.test/v1', models: { conversation: 'chat-model' } },
      image: { baseUrl: 'https://image.example.test/v1', imageTransport: 'images', models: { 'image-editing': 'edit-model' } },
    },
  };

  expect(selectConfiguredConnection('conversation', configs, ['openai-compatible:conversation'])).toBe('openai-compatible');
  expect(selectConfiguredConnection('image-editing', configs, ['openai-compatible:conversation'])).toBeNull();
  expect(selectConfiguredConnection('image-editing', configs, ['openai-compatible:image'])).toBe('openai-compatible');
});
