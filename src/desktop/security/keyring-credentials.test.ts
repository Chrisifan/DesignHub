import { expect, it } from 'vitest';

import {
  createKeyringCredentialStore,
  migrateLegacyCredentials,
  type KeyringEntry,
} from './keyring-credentials';

it('stores each connection in the fixed DesignHub keyring service', async () => {
  const calls: Array<{ service: string; account: string; secret?: string }> = [];
  const entry = (service: string, account: string): KeyringEntry => ({
    setPassword: async (secret) => { calls.push({ service, account, secret }); },
    getPassword: async () => 'stored-secret',
    deletePassword: async () => { calls.push({ service, account }); },
  });
  const store = createKeyringCredentialStore(entry);

  await store.setCredential('openai-compatible', 'stored-secret');
  await store.deleteCredential('openai-compatible');

  expect(calls).toEqual([
    { service: 'DesignHub', account: 'openai-compatible', secret: 'stored-secret' },
    { service: 'DesignHub', account: 'openai-compatible' },
  ]);
  await expect(store.getCredential?.('openai-compatible')).resolves.toBe('stored-secret');
});

it('fails closed when the keyring cannot read an entry', async () => {
  const store = createKeyringCredentialStore(() => ({
    setPassword: async () => undefined,
    getPassword: async () => { throw new Error('KEYRING_UNAVAILABLE'); },
    deletePassword: async () => undefined,
  }));

  await expect(store.getCredential?.('openai-compatible')).resolves.toBeNull();
});

it('keeps the legacy encrypted file when any keyring migration write fails', async () => {
  const deleted: string[] = [];
  const migrated = await migrateLegacyCredentials({
    read: async () => ({ first: 'cipher-first', second: 'cipher-second' }),
    remove: async () => { deleted.push('legacy'); },
    decrypt: (value) => value.replace('cipher-', 'plain-'),
    store: {
      setCredential: async (connectionId) => {
        if (connectionId === 'second') throw new Error('KEYRING_UNAVAILABLE');
      },
      deleteCredential: async () => undefined,
    },
  });

  expect(migrated).toBe(false);
  expect(deleted).toEqual([]);
});

it('removes the legacy encrypted file only after every credential is written', async () => {
  const written: Array<{ id: string; secret: string }> = [];
  const deleted: string[] = [];
  const migrated = await migrateLegacyCredentials({
    read: async () => ({ first: 'cipher-first', second: 'cipher-second' }),
    remove: async () => { deleted.push('legacy'); },
    decrypt: (value) => value.replace('cipher-', 'plain-'),
    store: {
      setCredential: async (id, secret) => { written.push({ id, secret }); },
      deleteCredential: async () => undefined,
    },
  });

  expect(migrated).toBe(true);
  expect(written).toEqual([{ id: 'first', secret: 'plain-first' }, { id: 'second', secret: 'plain-second' }]);
  expect(deleted).toEqual(['legacy']);
});
