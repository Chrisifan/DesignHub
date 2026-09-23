import { expect, it, vi } from 'vitest';

import { normalizeProfileAvatar } from '../profile-avatar';
import { createProfileSaveHandler, profileSaveChannel } from './profile';

const trustedUrl = 'http://localhost:5173/';
const windowStub = {
  webContents: {
    mainFrame: { url: trustedUrl },
    getURL: () => trustedUrl,
  },
};

const eventFor = (url: string) => ({
  sender: windowStub.webContents,
  senderFrame: { url },
});

it('exports the profile save channel', () => {
  expect(profileSaveChannel).toBe('profile:save');
});

it('rejects an unsupported MIME type before image processing', async () => {
  await expect(normalizeProfileAvatar({ mimeType: 'text/plain', bytes: new Uint8Array([1]) }))
    .rejects.toThrow('INVALID_PROFILE_AVATAR');
});

it('rejects an avatar larger than 10MB', async () => {
  await expect(normalizeProfileAvatar({ mimeType: 'image/png', bytes: new Uint8Array(10 * 1024 * 1024 + 1) }))
    .rejects.toThrow('INVALID_PROFILE_AVATAR');
});

it('rejects an untrusted sender for profile save', async () => {
  const saveProfile = vi.fn(async () => ({
    formatVersion: 1 as const,
    displayName: 'Sifan',
    avatarDataUrl: null,
    onboarding: { profileCompleted: false, modelStepCompleted: false },
  }));
  const handler = createProfileSaveHandler(windowStub, trustedUrl, { saveProfile } as never, async () => 'avatar');

  await expect(handler(eventFor('https://evil.test/'), {
    displayName: 'Sifan',
    avatar: null,
  })).resolves.toBeNull();
  expect(saveProfile).not.toHaveBeenCalled();
});
