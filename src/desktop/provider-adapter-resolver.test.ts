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

const oneEvent = (label: string): AsyncIterable<{ text: string }> => ({
  [Symbol.asyncIterator]: () => {
    let done = false;
    return {
      next: async () => {
        if (done) return { done: true, value: undefined };
        done = true;
        return { done: false, value: { text: label } };
      },
    };
  },
});

const adapter = (label: string): OpenAICompatibleAdapter => ({
  capabilities: ['conversation', 'vision-analysis', 'image-generation', 'image-editing'],
  chat: vi.fn(async () => ({ text: label, cost: null })),
  streamChat: vi.fn(() => oneEvent(label)),
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

it('retries credential resolution after a transient read failure', async () => {
  const getCredential = vi.fn()
    .mockRejectedValueOnce(new Error('SYSTEM_CREDENTIAL_STORE_READ_FAILED'))
    .mockResolvedValue('recovered-key');
  const createAdapter = vi.fn(() => adapter('recovered'));
  const resolve = createProviderAdapterResolver({
    connectionId: 'openai-compatible',
    config,
    getCredential,
    createAdapter,
  });
  const combined = await resolve();

  await expect(combined.chat({ messages: [{ role: 'user', content: 'first' }] })).rejects.toThrow('SYSTEM_CREDENTIAL_STORE_READ_FAILED');
  await expect(combined.chat({ messages: [{ role: 'user', content: 'second' }] })).resolves.toMatchObject({ text: 'recovered' });

  expect(getCredential).toHaveBeenCalledTimes(2);
  expect(createAdapter).toHaveBeenCalledTimes(1);
});

it('keeps a genuinely missing credential as the provider API key error', async () => {
  const resolve = createProviderAdapterResolver({
    connectionId: 'openai-compatible',
    config,
    getCredential: async () => null,
  });
  const combined = await resolve();

  await expect(combined.chat({ messages: [{ role: 'user', content: 'hello' }] })).rejects.toThrow('PROVIDER_API_KEY_REQUIRED');
});
