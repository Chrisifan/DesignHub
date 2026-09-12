export type SystemCredentialStore = {
  setCredential: (connectionId: string, secret: string) => Promise<void>;
  deleteCredential: (connectionId: string) => Promise<void>;
  getCredential?: (connectionId: string) => Promise<string | null>;
};

export type CredentialBoundary = {
  storeCredential: (connectionId: string, secret: string) => Promise<boolean>;
  deleteCredential: (connectionId: string) => Promise<boolean>;
};

const isCredentialInput = (connectionId: string, secret?: string): boolean =>
  connectionId.trim().length > 0 && (secret === undefined || secret.length > 0);

export const createCredentialBoundary = (store: SystemCredentialStore): CredentialBoundary => ({
  storeCredential: async (connectionId, secret) => {
    if (!isCredentialInput(connectionId, secret)) return false;
    try {
      await store.setCredential(connectionId, secret);
      return true;
    } catch {
      return false;
    }
  },
  deleteCredential: async (connectionId) => {
    if (!isCredentialInput(connectionId)) return false;
    try {
      await store.deleteCredential(connectionId);
      return true;
    } catch {
      return false;
    }
  },
});

export const createInMemoryCredentialStore = (): SystemCredentialStore & {
  hasCredential: (connectionId: string) => boolean;
  getCredential: (connectionId: string) => Promise<string | null>;
} => {
  const values = new Map<string, string>();
  return {
    setCredential: async (connectionId, secret) => {
      values.set(connectionId, secret);
    },
    deleteCredential: async (connectionId) => {
      values.delete(connectionId);
    },
    getCredential: async (connectionId) => values.get(connectionId) ?? null,
    hasCredential: (connectionId) => values.has(connectionId),
  };
};

export const createUnavailableCredentialStore = (): SystemCredentialStore => ({
  setCredential: async () => {
    throw new Error('SYSTEM_CREDENTIAL_STORE_UNAVAILABLE');
  },
  deleteCredential: async () => {
    throw new Error('SYSTEM_CREDENTIAL_STORE_UNAVAILABLE');
  },
});
