import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { loadProviderConfigs, saveProviderConfigs, type ProviderConfigMap } from './provider-config';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

it('round-trips endpoint and model configuration without accepting credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-provider-config-'));
  directories.push(directory);
  const path = join(directory, 'providers.json');
  const configs: ProviderConfigMap = {
    'openai-compatible': {
      baseUrl: 'https://api.example.test/v1',
      models: { conversation: 'chat-model', 'image-editing': 'image-edit-model' },
    },
  };

  await expect(saveProviderConfigs(path, configs)).resolves.toBe(true);
  await expect(loadProviderConfigs(path)).resolves.toEqual(configs);
  expect(await readFile(path, 'utf8')).not.toContain('secret');
});

it('fails closed for malformed persisted provider configuration', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-provider-config-'));
  directories.push(directory);
  const path = join(directory, 'providers.json');
  await writeFile(path, JSON.stringify({ 'openai-compatible': { baseUrl: 'file:///tmp/provider' } }));

  await expect(loadProviderConfigs(path)).rejects.toThrow('INVALID_PROVIDER_CONFIG');
  await expect(saveProviderConfigs(path, { 'openai-compatible': { baseUrl: 'https://api.example.test', models: {} } })).resolves.toBe(true);
  await expect(loadProviderConfigs(path)).resolves.toEqual({ 'openai-compatible': { baseUrl: 'https://api.example.test', models: {} } });
});
