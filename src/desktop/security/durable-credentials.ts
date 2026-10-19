import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createCredentialStoreError, isCredentialStoreError, type SystemCredentialStore } from './credentials';

export type CredentialEncryption = {
  isEncryptionAvailable: () => boolean;
  encryptString: (value: string) => Buffer;
  decryptString: (value: Buffer) => string;
};

type PersistedCredentials = {
  formatVersion: 1;
  credentials: Record<string, string>;
};

const credentialFileName = 'credentials.v2.json';

const asCredentialMap = (value: unknown): Record<string, string> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const document = value as Partial<PersistedCredentials>;
  if (document.formatVersion !== 1 || !document.credentials || typeof document.credentials !== 'object' || Array.isArray(document.credentials)) return null;
  const entries = Object.entries(document.credentials);
  if (!entries.every(([account, secret]) => account.trim().length > 0 && typeof secret === 'string' && secret.length > 0)) return null;
  return Object.fromEntries(entries);
};

export const createEncryptedFileCredentialStore = (
  directory: string,
  encryption: CredentialEncryption,
): SystemCredentialStore => {
  const path = join(directory, credentialFileName);
  let mutation = Promise.resolve();

  const requireEncryption = (): void => {
    if (!encryption.isEncryptionAvailable()) throw createCredentialStoreError('SYSTEM_CREDENTIAL_STORE_UNAVAILABLE');
  };

  const readCredentials = async (): Promise<Record<string, string>> => {
    requireEncryption();
    try {
      const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
      const credentials = asCredentialMap(parsed);
      if (!credentials) throw new Error('INVALID_CREDENTIAL_FILE');
      return credentials;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
      if (isCredentialStoreError(error)) throw error;
      throw createCredentialStoreError('SYSTEM_CREDENTIAL_STORE_READ_FAILED');
    }
  };

  const writeCredentials = async (credentials: Record<string, string>): Promise<void> => {
    requireEncryption();
    await mkdir(directory, { recursive: true });
    const temporary = join(directory, `.${credentialFileName}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, `${JSON.stringify({ formatVersion: 1, credentials } satisfies PersistedCredentials, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
      await rename(temporary, path);
    } catch {
      await rm(temporary, { force: true });
      throw createCredentialStoreError('SYSTEM_CREDENTIAL_STORE_WRITE_FAILED');
    }
  };

  const update = (change: (credentials: Record<string, string>) => void): Promise<void> => {
    const operation = mutation.catch(() => undefined).then(async () => {
      const credentials = await readCredentials();
      change(credentials);
      await writeCredentials(credentials);
    });
    mutation = operation;
    return operation;
  };

  return {
    setCredential: (connectionId, secret) => update((credentials) => {
      credentials[connectionId] = encryption.encryptString(secret).toString('base64');
    }),
    deleteCredential: (connectionId) => update((credentials) => {
      delete credentials[connectionId];
    }),
    getCredential: async (connectionId) => {
      await mutation.catch(() => undefined);
      const encrypted = (await readCredentials())[connectionId];
      if (!encrypted) return null;
      try {
        const secret = encryption.decryptString(Buffer.from(encrypted, 'base64'));
        return secret.length > 0 ? secret : null;
      } catch {
        throw createCredentialStoreError('SYSTEM_CREDENTIAL_STORE_READ_FAILED');
      }
    },
  };
};

export const migrateCredentialAccounts = async (
  source: Pick<SystemCredentialStore, 'getCredential'>,
  destination: SystemCredentialStore,
  accounts: readonly string[],
): Promise<number> => {
  let migrated = 0;
  for (const account of accounts) {
    try {
      if (await destination.getCredential?.(account)) continue;
      const secret = await source.getCredential?.(account);
      if (!secret) continue;
      await destination.setCredential(account, secret);
      migrated += 1;
    } catch {
      // Migration is best-effort; runtime reads remain isolated from the native keyring.
    }
  }
  return migrated;
};
