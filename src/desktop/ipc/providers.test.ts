import { expect, it, vi } from 'vitest';

import { createProviderConfigLoadHandler, createProviderConfigSaveHandler, providerConfigLoadChannel, providerConfigSaveChannel } from './providers';

const trustedUrl = 'http://localhost:5173/';
const window = { webContents: { mainFrame: { url: trustedUrl }, getURL: () => trustedUrl } };
const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };

it('loads and saves provider configuration only for the trusted main frame', async () => {
  const load = vi.fn(async () => ({ 'openai-compatible': {
    conversation: { baseUrl: 'https://text.example.test/v1', models: {} },
    image: { baseUrl: 'https://image.example.test/v1', imageTransport: 'images' as const, models: {} },
  } }));
  const save = vi.fn(async () => true);
  expect(providerConfigLoadChannel).toBe('provider:config-load');
  expect(providerConfigSaveChannel).toBe('provider:config-save');
  await expect(createProviderConfigLoadHandler(window, trustedUrl, load)(event)).resolves.toEqual({ 'openai-compatible': {
    conversation: { baseUrl: 'https://text.example.test/v1', models: {} },
    image: { baseUrl: 'https://image.example.test/v1', imageTransport: 'images', models: {} },
  } });
  await expect(createProviderConfigSaveHandler(window, trustedUrl, save)(event, {
    connectionId: 'openai-compatible',
    config: {
      conversation: { baseUrl: 'https://text.example.test/v1', models: { conversation: 'chat-model' } },
      image: { baseUrl: '', imageTransport: 'images', models: {} },
    },
  })).resolves.toBe(true);
  expect(save).toHaveBeenCalledWith({
    connectionId: 'openai-compatible',
    config: {
      conversation: { baseUrl: 'https://text.example.test/v1', models: { conversation: 'chat-model' } },
      image: { baseUrl: '', imageTransport: 'images', models: {} },
    },
  });
});

it('rejects untrusted frames and credential-shaped payloads before storage', async () => {
  const save = vi.fn(async () => true);
  const handler = createProviderConfigSaveHandler(window, trustedUrl, save);
  const untrusted = { sender: window.webContents, senderFrame: { url: 'http://evil.test/' } };

  await expect(handler(untrusted, { connectionId: 'openai-compatible', config: { conversation: { baseUrl: 'https://api.example.test', models: {} }, image: { baseUrl: '', imageTransport: 'images', models: {} } } })).resolves.toBe(false);
  await expect(handler(event, { connectionId: 'openai-compatible', config: { conversation: { baseUrl: 'https://api.example.test', models: {} }, image: { baseUrl: '', imageTransport: 'images', models: {} }, apiKey: 'secret' } })).resolves.toBe(false);
  expect(save).not.toHaveBeenCalled();
});
