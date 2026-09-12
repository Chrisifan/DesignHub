export type CredentialStoreHost = {
  storeCredential: (connectionId: string, secret: string) => Promise<boolean>;
  deleteCredential: (connectionId: string) => Promise<boolean>;
};

export type CredentialBridge = CredentialStoreHost;

export const createCredentialBridge = (host: CredentialStoreHost): CredentialBridge => ({
  storeCredential: async (connectionId, secret) => host.storeCredential(connectionId, secret),
  deleteCredential: async (connectionId) => host.deleteCredential(connectionId),
});

export const storeCredential = async (connectionId: string, secret: string): Promise<boolean> => {
  if (typeof window === 'undefined' || !window.designhub?.storeCredential) return false;
  return window.designhub.storeCredential(connectionId, secret);
};

export const deleteCredential = async (connectionId: string): Promise<boolean> => {
  if (typeof window === 'undefined' || !window.designhub?.deleteCredential) return false;
  return window.designhub.deleteCredential(connectionId);
};
