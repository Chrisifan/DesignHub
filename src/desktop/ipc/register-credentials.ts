import type { BrowserWindow } from 'electron';
import {
  createCredentialDeleteHandler,
  createCredentialStatusHandler,
  createCredentialStoreHandler,
  credentialDeleteChannel,
  credentialStatusChannel,
  credentialStoreChannel,
} from './credentials';
import type { CredentialBoundary } from '../security/credentials';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};

export type RegisterCredentialOptions = {
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  boundary: CredentialBoundary;
};

export const registerCredentialHandlers = ({
  ipc,
  getWindow,
  getTrustedUrl,
  boundary,
}: RegisterCredentialOptions): void => {
  const getContext = () => {
    const window = getWindow();
    const trustedUrl = getTrustedUrl();
    return window && trustedUrl ? { window, trustedUrl } : null;
  };

  ipc.handle(credentialStoreChannel, (event, connectionId, secret) => {
    const context = getContext();
    return context
      ? createCredentialStoreHandler(context.window, context.trustedUrl, boundary)(event as never, connectionId, secret)
      : false;
  });
  ipc.handle(credentialDeleteChannel, (event, connectionId) => {
    const context = getContext();
    return context
      ? createCredentialDeleteHandler(context.window, context.trustedUrl, boundary)(event as never, connectionId)
      : false;
  });
  ipc.handle(credentialStatusChannel, (event, connectionId) => {
    const context = getContext();
    return context
      ? createCredentialStatusHandler(context.window, context.trustedUrl, boundary)(event as never, connectionId)
      : false;
  });
};
