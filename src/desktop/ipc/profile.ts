import type { AppProfile, ProfilePatch } from '../../features/profile/model';
import type { ProfileAvatarInput } from '../profile-avatar';
import { isTrustedWorkspaceRequest } from './workspace';

export const profileLoadChannel = 'profile:get';
export const profileSaveChannel = 'profile:save';

type ProfileSender = { mainFrame: { url: string }; getURL: () => string };
type ProfileRequest = { sender: ProfileSender; senderFrame: { url: string } | null };
type ProfileWindow = { webContents: ProfileSender };
type ProfileStore = {
  loadProfile: () => Promise<AppProfile | null>;
  saveProfile: (patch: ProfilePatch) => Promise<AppProfile>;
};
type ProfileSaveInput = {
  displayName?: string;
  avatar?: ProfileAvatarInput | null;
  onboarding?: Partial<AppProfile['onboarding']>;
};
type AvatarNormalizer = (input: ProfileAvatarInput) => Promise<string>;

const isAvatarInput = (value: unknown): value is ProfileAvatarInput => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return typeof input.mimeType === 'string' && input.bytes instanceof Uint8Array;
};

const isOnboardingPatch = (value: unknown): value is Partial<AppProfile['onboarding']> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const patch = value as Record<string, unknown>;
  return (patch.profileCompleted === undefined || typeof patch.profileCompleted === 'boolean')
    && (patch.modelStepCompleted === undefined || typeof patch.modelStepCompleted === 'boolean');
};

const normalizeInput = (value: unknown): ProfileSaveInput | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.displayName !== undefined && typeof input.displayName !== 'string') return null;
  if (input.avatar !== undefined && input.avatar !== null && !isAvatarInput(input.avatar)) return null;
  if (input.onboarding !== undefined && !isOnboardingPatch(input.onboarding)) return null;
  return {
    ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
    ...(input.avatar === undefined ? {} : { avatar: input.avatar }),
    ...(input.onboarding === undefined ? {} : { onboarding: input.onboarding }),
  };
};

export const createProfileLoadHandler = (
  window: ProfileWindow,
  trustedUrl: string,
  store: ProfileStore,
) => async (event: ProfileRequest): Promise<AppProfile | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl)) return null;
  return store.loadProfile();
};

export const createProfileSaveHandler = (
  window: ProfileWindow,
  trustedUrl: string,
  store: ProfileStore,
  normalizeAvatar: AvatarNormalizer,
) => async (event: ProfileRequest, value: unknown): Promise<AppProfile | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl)) return null;
  const input = normalizeInput(value);
  if (!input) return null;
  const displayName = input.displayName?.trim();
  if (input.onboarding?.profileCompleted && !displayName) return null;
  const patch: ProfilePatch = {
    ...(displayName === undefined ? {} : { displayName }),
    ...(input.avatar === undefined ? {} : { avatarDataUrl: input.avatar === null ? null : await normalizeAvatar(input.avatar) }),
    ...(input.onboarding === undefined ? {} : { onboarding: input.onboarding }),
  };
  return store.saveProfile(patch);
};
