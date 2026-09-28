import { expect, it } from 'vitest';

import { normalizeProviderConfig, normalizeProviderToolCapabilities, providerCredentialAccount, validateProviderToolCapability, type ProviderConfig } from './config';

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

it('normalizes concrete tool capabilities and rejects invalid ranges or duplicates', () => {
  const capabilities = normalizeProviderToolCapabilities([{
    tool: 'remove-object',
    supportsMask: true,
    supportsTransparency: true,
    maxWidth: 4096,
    maxBytes: 4_000_000,
    supportsRemoteCancellation: false,
    supportsStatusQuery: true,
    parameterRanges: { feather: { min: 0, max: 100 } },
  }]);
  expect(capabilities).toEqual([{
    tool: 'remove-object',
    supportsMask: true,
    supportsTransparency: true,
    maxWidth: 4096,
    maxBytes: 4_000_000,
    supportsRemoteCancellation: false,
    supportsStatusQuery: true,
    parameterRanges: { feather: { min: 0, max: 100 } },
  }]);
  expect(normalizeProviderToolCapabilities([capabilities?.[0], capabilities?.[0]])).toBeNull();
  expect(normalizeProviderToolCapabilities([{
    tool: 'remove-object', supportsMask: true, supportsTransparency: true,
    maxWidth: 0, supportsRemoteCancellation: false, supportsStatusQuery: false,
  }])).toBeNull();
});

it('validates tool, mask, dimensions, transparency and parameter range requirements', () => {
  const capabilities = [{
    tool: 'remove-object' as const,
    supportsMask: false,
    supportsTransparency: false,
    maxWidth: 1024,
    supportsRemoteCancellation: false,
    supportsStatusQuery: false,
    parameterRanges: { feather: { min: 0, max: 20 } },
  }];
  expect(validateProviderToolCapability({ tool: 'remove-object', hasMask: true }, capabilities)).toMatchObject({ ok: false, reason: 'MASK_UNSUPPORTED' });
  expect(validateProviderToolCapability({ tool: 'remove-object', requiresTransparency: true }, capabilities)).toMatchObject({ ok: false, reason: 'TRANSPARENCY_UNSUPPORTED' });
  expect(validateProviderToolCapability({ tool: 'remove-object', width: 2048 }, capabilities)).toMatchObject({ ok: false, reason: 'SIZE_UNSUPPORTED' });
  expect(validateProviderToolCapability({ tool: 'remove-object', params: { feather: 21 } }, capabilities)).toMatchObject({ ok: false, reason: 'PARAMETER_OUT_OF_RANGE' });
  expect(validateProviderToolCapability({ tool: 'inpaint' }, capabilities)).toMatchObject({ ok: false, reason: 'TOOL_UNSUPPORTED' });
});
