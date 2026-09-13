import { expect, it, vi } from 'vitest';

import type { OpenAICompatibleAdapter } from '../features/providers/adapter';
import type { ProviderConfig } from '../features/providers/config';
import { createProviderAdapterResolver } from './provider-adapter-resolver';

const config: ProviderConfig = {
  conversation: {
    baseUrl: 'https://text.example/v1',
    models: { conversation: 'chat-model', 'vision-analysis': 'vision-model' },
  },
  image: {
    baseUrl: 'https://image.example/v1',
    imageTransport: 'responses',
    models: { 'image-generation': 'image-model', 'image-editing': 'edit-model' },
  },
};

const adapter = (label: string): OpenAICompatibleAdapter => ({
  capabilities: ['conversation', 'vision-analysis', 'image-generation', 'image-editing'],
  chat: vi.fn(async () => ({ text: label, cost: null })),
  streamChat: vi.fn(() => (async function* () { yield { text: label }; })()),
  analyzeVision: vi.fn(async () => ({ text: label, cost: null })),
  generateImage: vi.fn(async () => ({ images: [{ url: `${label}.png` }], cost: null })),
  editImage: vi.fn(async () => ({ images: [{ url: `${label}.png` }], cost: null })),
});

it('routes conversation and image methods to independent profile adapters', async () => {
  const createAdapter = vi.fn((options: { baseUrl: string; apiKey: string; imageTransport?: string; models?: Record<string, string> }) => adapter(options.baseUrl));
  const resolve = createProviderAdapterResolver({
    connectionId: 'openai-compatible',
    config,
    getCredential: async (account) => account.endsWith(':image') ? 'image-key' : 'conversation-key',
    createAdapter,
  });

  const combined = await resolve();
  await expect(combined.chat({ messages: [{ role: 'user', content: 'hello' }] })).resolves.toMatchObject({ text: 'https://text.example/v1' });
  await expect(combined.generateImage({ prompt: 'a chair' })).resolves.toMatchObject({ images: [{ url: 'https://image.example/v1.png' }] });

  expect(createAdapter).toHaveBeenCalledTimes(2);
  expect(createAdapter).toHaveBeenCalledWith(expect.objectContaining({
    baseUrl: 'https://text.example/v1',
    apiKey: 'conversation-key',
    models: config.conversation.models,
  }));
  expect(createAdapter).toHaveBeenCalledWith(expect.objectContaining({
    baseUrl: 'https://image.example/v1',
    apiKey: 'image-key',
    imageTransport: 'responses',
    models: config.image.models,
  }));
});

it('allows one profile to be used when the other profile is not configured', async () => {
  const createAdapter = vi.fn((options: { baseUrl: string; apiKey: string }) => adapter(options.baseUrl));
  const resolve = createProviderAdapterResolver({
    connectionId: 'openai-compatible',
    config: {
      conversation: { baseUrl: 'https://text.example/v1', models: {} },
      image: { baseUrl: '', imageTransport: 'images', models: {} },
    },
    getCredential: async () => 'conversation-key',
    createAdapter,
  });

  const combined = await resolve();
  await expect(combined.chat({ messages: [{ role: 'user', content: 'hello' }] })).resolves.toMatchObject({ text: 'https://text.example/v1' });
  expect(createAdapter).toHaveBeenCalledTimes(1);
});

it('uses environment fallback when no saved config exists', async () => {
  const createAdapter = vi.fn((options: { baseUrl: string; apiKey: string; imageTransport?: string }) => adapter(options.baseUrl));
  const resolve = createProviderAdapterResolver({
    connectionId: 'openai-compatible',
    config: undefined,
    environment: { baseUrl: 'https://env.example/v1', apiKey: 'env-key' },
    getCredential: async () => null,
    createAdapter,
  });

  const combined = await resolve();
  await expect(combined.generateImage({ prompt: 'a chair' })).resolves.toMatchObject({ images: [{ url: 'https://env.example/v1.png' }] });
  expect(createAdapter).toHaveBeenCalledWith(expect.objectContaining({ baseUrl: 'https://env.example/v1', apiKey: 'env-key', imageTransport: 'images' }));
});

