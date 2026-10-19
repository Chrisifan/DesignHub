export type SystemCredentialStore = {
  setCredential: (connectionId: string, secret: string) => Promise<void>;
  deleteCredential: (connectionId: string) => Promise<void>;
  getCredential?: (connectionId: string) => Promise<string | null>;
};

export type CredentialStoreErrorCode =
  | 'SYSTEM_CREDENTIAL_STORE_UNAVAILABLE'
  | 'SYSTEM_CREDENTIAL_STORE_READ_FAILED'
  | 'SYSTEM_CREDENTIAL_STORE_WRITE_FAILED';

export type CredentialStoreError = Error & { code: CredentialStoreErrorCode };

export const createCredentialStoreError = (code: CredentialStoreErrorCode): CredentialStoreError => Object.assign(
  new Error(code),
  { name: 'CredentialStoreError', code },
);

export const isCredentialStoreError = (error: unknown): error is CredentialStoreError =>
  error instanceof Error && 'code' in error && [
    'SYSTEM_CREDENTIAL_STORE_UNAVAILABLE',
    'SYSTEM_CREDENTIAL_STORE_READ_FAILED',
    'SYSTEM_CREDENTIAL_STORE_WRITE_FAILED',
  ].includes(String(error.code));

export type CredentialBoundary = {
  storeCredential: (connectionId: string, secret: string) => Promise<boolean>;
  deleteCredential: (connectionId: string) => Promise<boolean>;
  hasCredential: (connectionId: string) => Promise<boolean>;
};

const isCredentialInput = (connectionId: string, secret?: string): boolean =>
  connectionId.trim().length > 0 && (secret === undefined || secret.length > 0);

export const createCredentialBoundary = (
  store: SystemCredentialStore,
  onCredentialChanged: (connectionId: string) => void = () => undefined,
): CredentialBoundary => ({
  storeCredential: async (connectionId, secret) => {
    if (!isCredentialInput(connectionId, secret)) return false;
    try {
      await store.setCredential(connectionId, secret);
      onCredentialChanged(connectionId);
      return true;
    } catch {
      return false;
    }
  },
  deleteCredential: async (connectionId) => {
    if (!isCredentialInput(connectionId)) return false;
    try {
      await store.deleteCredential(connectionId);
      onCredentialChanged(connectionId);
      return true;
    } catch {
      return false;
    }
  },
  hasCredential: async (connectionId) => {
    if (!isCredentialInput(connectionId)) return false;
    try {
      return Boolean(await store.getCredential?.(connectionId));
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
  getCredential: async () => {
    throw createCredentialStoreError('SYSTEM_CREDENTIAL_STORE_UNAVAILABLE');
  },
});
