import { expect, it } from 'vitest';

import { normalizeProviderConfig, providerCredentialAccount, type ProviderConfig } from './config';

it('accepts canonical conversation and image profiles with independent model maps', () => {
  expect(normalizeProviderConfig({
    conversation: {
      baseUrl: ' https://text.example.test/v1/ ',
      models: { conversation: ' chat-model ', 'vision-analysis': 'vision-model' },
    },
    image: {
      baseUrl: 'https://image.example.test/openai/v1/',
      imageTransport: 'responses',
      models: { 'image-generation': 'image-model', 'image-editing': 'edit-model' },
    },
  })).toEqual({
    conversation: {
      baseUrl: 'https://text.example.test/v1',
      models: { conversation: 'chat-model', 'vision-analysis': 'vision-model' },
    },
    image: {
      baseUrl: 'https://image.example.test/openai/v1',
      imageTransport: 'responses',
      models: { 'image-generation': 'image-model', 'image-editing': 'edit-model' },
    },
  } satisfies ProviderConfig);
});

it('migrates flat historical configuration into two profiles', () => {
  expect(normalizeProviderConfig({
    baseUrl: 'https://gateway.example.test/openai/v1/',
    imageTransport: 'responses',
    models: {
      conversation: 'chat-model',
      'vision-analysis': 'vision-model',
      'image-generation': 'image-model',
      'image-editing': 'edit-model',
    },
  })).toEqual({
    conversation: {
      baseUrl: 'https://gateway.example.test/openai/v1',
      models: { conversation: 'chat-model', 'vision-analysis': 'vision-model' },
    },
    image: {
      baseUrl: 'https://gateway.example.test/openai/v1',
      imageTransport: 'responses',
      models: { 'image-generation': 'image-model', 'image-editing': 'edit-model' },
    },
  } satisfies ProviderConfig);
});

it('derives profile-specific credential accounts', () => {
  expect(providerCredentialAccount('openai-compatible', 'conversation')).toBe('openai-compatible:conversation');
  expect(providerCredentialAccount('openai-compatible', 'image')).toBe('openai-compatible:image');
});

it('allows an unconfigured canonical profile for independent saving', () => {
  expect(normalizeProviderConfig({
    conversation: { baseUrl: 'https://text.example', models: {} },
    image: { baseUrl: '', imageTransport: 'images', models: {} },
  })).toEqual({
    conversation: { baseUrl: 'https://text.example', models: {} },
    image: { baseUrl: '', imageTransport: 'images', models: {} },
  });
});

it('rejects malformed profiles, unsupported fields, and cross-profile model settings', () => {
  expect(normalizeProviderConfig(null)).toBeNull();
  expect(normalizeProviderConfig({ baseUrl: '', models: {} })).toBeNull();
  expect(normalizeProviderConfig({
    conversation: { baseUrl: 'https://text.example', models: { 'image-generation': 'wrong-profile' } },
    image: { baseUrl: 'https://image.example', imageTransport: 'images', models: {} },
  })).toBeNull();
  expect(normalizeProviderConfig({
    conversation: { baseUrl: 'file:///tmp/provider', models: {} },
    image: { baseUrl: 'https://image.example', imageTransport: 'images', models: {} },
  })).toBeNull();
  expect(normalizeProviderConfig({
    conversation: { baseUrl: 'https://text.example', models: {} },
    image: { baseUrl: 'https://image.example', imageTransport: 'unknown', models: {} },
  })).toBeNull();
  expect(normalizeProviderConfig({
    conversation: { baseUrl: 'https://text.example', models: {}, extra: true },
    image: { baseUrl: 'https://image.example', imageTransport: 'images', models: {} },
  })).toBeNull();
});
