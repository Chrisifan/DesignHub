import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';

import type { SystemCredentialStore } from './credentials';
import {
  createEncryptedFileCredentialStore,
  migrateCredentialAccounts,
  type CredentialEncryption,
} from './durable-credentials';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const createDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-credentials-'));
  directories.push(directory);
  return directory;
};

const encryption: CredentialEncryption = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`encrypted:${value}`, 'utf8'),
  decryptString: (value) => value.toString('utf8').replace(/^encrypted:/u, ''),
};

it('reads an encrypted credential from a new store instance after restart', async () => {
  const directory = await createDirectory();
  const first = createEncryptedFileCredentialStore(directory, encryption);
  await first.setCredential('openai-compatible:conversation', 'restart-secret');

  const restarted = createEncryptedFileCredentialStore(directory, encryption);

  await expect(restarted.getCredential?.('openai-compatible:conversation')).resolves.toBe('restart-secret');
});

it('migrates an existing native credential into the durable store', async () => {
  const source: SystemCredentialStore = {
    setCredential: vi.fn(async () => undefined),
    deleteCredential: vi.fn(async () => undefined),
    getCredential: vi.fn(async () => 'native-secret'),
  };
  const destination: SystemCredentialStore = {
    setCredential: vi.fn(async () => undefined),
    deleteCredential: vi.fn(async () => undefined),
    getCredential: vi.fn(async () => null),
  };

  await expect(migrateCredentialAccounts(source, destination, ['openai-compatible:conversation'])).resolves.toBe(1);
  expect(destination.setCredential).toHaveBeenCalledWith('openai-compatible:conversation', 'native-secret');
});

it('does not overwrite a durable credential with a stale native value', async () => {
  const source: SystemCredentialStore = {
    setCredential: vi.fn(async () => undefined),
    deleteCredential: vi.fn(async () => undefined),
    getCredential: vi.fn(async () => 'stale-native-secret'),
  };
  const destination: SystemCredentialStore = {
    setCredential: vi.fn(async () => undefined),
    deleteCredential: vi.fn(async () => undefined),
    getCredential: vi.fn(async () => 'current-durable-secret'),
  };

  await expect(migrateCredentialAccounts(source, destination, ['openai-compatible:conversation'])).resolves.toBe(0);
  expect(source.getCredential).not.toHaveBeenCalled();
  expect(destination.setCredential).not.toHaveBeenCalled();
});

it('ignores a native keyring migration failure', async () => {
  const source: SystemCredentialStore = {
    setCredential: vi.fn(async () => undefined),
    deleteCredential: vi.fn(async () => undefined),
    getCredential: vi.fn(async () => { throw new Error('KEYRING_UNAVAILABLE'); }),
  };
  const destination: SystemCredentialStore = {
    setCredential: vi.fn(async () => undefined),
    deleteCredential: vi.fn(async () => undefined),
    getCredential: vi.fn(async () => null),
  };

  await expect(migrateCredentialAccounts(source, destination, ['openai-compatible:conversation'])).resolves.toBe(0);
  expect(destination.setCredential).not.toHaveBeenCalled();
});

it('fails the save when encrypted durable storage is unavailable', async () => {
  const directory = await createDirectory();
  const store = createEncryptedFileCredentialStore(directory, {
    ...encryption,
    isEncryptionAvailable: () => false,
  });

  await expect(store.setCredential('openai-compatible:image', 'image-secret')).rejects.toThrow('SYSTEM_CREDENTIAL_STORE_UNAVAILABLE');
});
