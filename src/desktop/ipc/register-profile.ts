import type { BrowserWindow } from 'electron';
import { createProfileLoadHandler, createProfileSaveHandler, profileLoadChannel, profileSaveChannel } from './profile';
import type { ProfileAvatarInput } from '../profile-avatar';
import type { AppProfile, ProfilePatch } from '../../features/profile/model';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};

type ProfileStore = {
  loadProfile: () => Promise<AppProfile | null>;
  saveProfile: (patch: ProfilePatch) => Promise<AppProfile>;
};

export type RegisterProfileOptions = {
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  store: ProfileStore;
  normalizeAvatar: (input: ProfileAvatarInput) => Promise<string>;
  hasActiveProjectLibrary: () => boolean;
};

export const registerProfileHandlers = ({
  ipc,
  getWindow,
  getTrustedUrl,
  store,
  normalizeAvatar,
  hasActiveProjectLibrary,
}: RegisterProfileOptions): void => {
  const getContext = () => {
    const window = getWindow();
    const trustedUrl = getTrustedUrl();
    return window && trustedUrl ? { window, trustedUrl } : null;
  };

  ipc.handle(profileLoadChannel, (event) => {
    const context = getContext();
    return context
      ? createProfileLoadHandler(context.window, context.trustedUrl, store)(event as never)
      : null;
  });
  ipc.handle(profileSaveChannel, (event, input) => {
    const context = getContext();
    return context
      ? createProfileSaveHandler(context.window, context.trustedUrl, store, normalizeAvatar, hasActiveProjectLibrary)(event as never, input)
      : null;
  });
};
