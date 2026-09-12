import type { BrowserWindow } from 'electron';

import type { CredentialBoundary } from '../security/credentials';

export const credentialStoreChannel = 'credential:store';
export const credentialDeleteChannel = 'credential:delete';

type CredentialSender = {
  mainFrame: { url: string };
  getURL: () => string;
};
type CredentialRequest = {
  sender: CredentialSender;
  senderFrame: { url: string } | null;
};
type CredentialWindow = { webContents: CredentialSender };

const isTrustedCredentialRequest = (event: CredentialRequest, window: CredentialWindow, trustedUrl: string): boolean => {
  const frame = event.senderFrame;
  if (event.sender !== window.webContents || frame !== window.webContents.mainFrame || frame === null) return false;
  return frame.url === trustedUrl;
};

const validConnectionId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const validSecret = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

export const createCredentialStoreHandler = (window: CredentialWindow, trustedUrl: string, boundary: CredentialBoundary) => async (event: CredentialRequest, connectionId: unknown, secret: unknown): Promise<boolean> => {
  if (!isTrustedCredentialRequest(event, window, trustedUrl) || !validConnectionId(connectionId) || !validSecret(secret)) return false;
  return boundary.storeCredential(connectionId, secret);
};

export const createCredentialDeleteHandler = (window: CredentialWindow, trustedUrl: string, boundary: CredentialBoundary) => async (event: CredentialRequest, connectionId: unknown): Promise<boolean> => {
  if (!isTrustedCredentialRequest(event, window, trustedUrl) || !validConnectionId(connectionId)) return false;
  return boundary.deleteCredential(connectionId);
};

export type CredentialWindowLike = BrowserWindow;
