import { createCredentialStoreError, type SystemCredentialStore } from './credentials';
import { providerCredentialAccount, providerProfiles, type ProviderProfile } from '../../features/providers/config';

export const designHubKeyringService = 'DesignHub';

export type KeyringEntry = {
  setPassword: (secret: string) => void | Promise<void>;
  getPassword: () => string | null | undefined | Promise<string | null | undefined>;
  deletePassword: () => boolean | void | Promise<boolean | void>;
};

export type KeyringEntryFactory = (service: string, account: string) => KeyringEntry;

export type LegacyCredentialMigration = {
  read: () => Promise<Record<string, string> | null>;
  remove: () => Promise<void>;
  decrypt: (value: string) => string;
  store: Pick<SystemCredentialStore, 'setCredential' | 'deleteCredential'>;
};

export const createKeyringCredentialStore = (createEntry: KeyringEntryFactory): SystemCredentialStore => ({
  setCredential: async (connectionId, secret) => {
    await createEntry(designHubKeyringService, connectionId).setPassword(secret);
  },
  deleteCredential: async (connectionId) => {
    await createEntry(designHubKeyringService, connectionId).deletePassword();
  },
  getCredential: async (connectionId) => {
    try {
      const secret = await createEntry(designHubKeyringService, connectionId).getPassword();
      return typeof secret === 'string' && secret.length > 0 ? secret : null;
    } catch {
      throw createCredentialStoreError('SYSTEM_CREDENTIAL_STORE_READ_FAILED');
    }
  },
});

type CredentialReader = Pick<SystemCredentialStore, 'setCredential' | 'getCredential'>;

export const resolveProviderCredential = async (
  store: Pick<SystemCredentialStore, 'getCredential'>,
  connectionId: string,
  profile: ProviderProfile,
): Promise<string | null> => {
  const scoped = await store.getCredential?.(providerCredentialAccount(connectionId, profile));
  if (scoped) return scoped;
  return await store.getCredential?.(connectionId) ?? null;
};

export const migrateLegacyProviderCredential = async (
  store: CredentialReader,
  connectionId: string,
): Promise<boolean> => {
  try {
    const legacy = await store.getCredential?.(connectionId);
    if (!legacy) return false;
    for (const profile of providerProfiles) {
      const account = providerCredentialAccount(connectionId, profile);
      const existing = await store.getCredential?.(account);
      if (!existing) await store.setCredential(account, legacy);
    }
    return true;
  } catch {
    return false;
  }
};

export const migrateLegacyCredentials = async (input: LegacyCredentialMigration): Promise<boolean> => {
  try {
    const values = await input.read();
    if (!values) return false;
    const entries = Object.entries(values);
    if (entries.length === 0 || entries.some(([connectionId, value]) => !connectionId.trim() || !value)) return false;
    for (const [connectionId, encrypted] of entries) {
      const secret = input.decrypt(encrypted);
      if (!secret) return false;
      await input.store.setCredential(connectionId, secret);
    }
    await input.remove();
    return true;
  } catch {
    return false;
  }
};
