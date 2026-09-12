import { expect, it } from 'vitest';

import {
  createCredentialBoundary,
  createInMemoryCredentialStore,
} from '../../src/desktop/security/credentials';
import { createCredentialBridge } from '../../src/platform/credentials';

it('stores and deletes credentials without exposing a read-back operation', async () => {
  const store = createInMemoryCredentialStore();
  const boundary = createCredentialBoundary(store);
  const bridge = createCredentialBridge(boundary);

  expect(await bridge.storeCredential('provider-a', 'secret-value')).toBe(true);
  expect(store.hasCredential('provider-a')).toBe(true);
  expect('getSecret' in bridge).toBe(false);
  expect(await bridge.deleteCredential('provider-a')).toBe(true);
  expect(store.hasCredential('provider-a')).toBe(false);
});

it('keeps provider secret retrieval internal to the host', async () => {
  const store = createInMemoryCredentialStore();
  const boundary = createCredentialBoundary(store);
  expect(await boundary.storeCredential('provider-a', 'secret-value')).toBe(true);
  expect(await store.getCredential('provider-a')).toBe('secret-value');
  expect('getCredential' in boundary).toBe(false);
});

it('rejects invalid input and never falls back to plaintext storage', async () => {
  const writes: string[] = [];
  const store = {
    setCredential: async (_connectionId: string, secret: string) => {
      writes.push(secret);
    },
    deleteCredential: async () => undefined,
  };
  const boundary = createCredentialBoundary(store);
  const bridge = createCredentialBridge(boundary);

  expect(await bridge.storeCredential('', 'secret-value')).toBe(false);
  expect(await bridge.storeCredential('provider-a', '')).toBe(false);
  expect(writes).toEqual([]);
});

it('returns failure when the system store rejects without exposing the secret', async () => {
  const store = {
    setCredential: async () => {
      throw new Error('KEYCHAIN_REJECTED');
    },
    deleteCredential: async () => undefined,
  };
  const bridge = createCredentialBridge(createCredentialBoundary(store));

  await expect(bridge.storeCredential('provider-a', 'secret-value')).resolves.toBe(false);
});
