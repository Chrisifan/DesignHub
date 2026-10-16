import { expect, it, vi } from 'vitest';
import sharp from 'sharp';

import { normalizeProfileAvatar } from '../profile-avatar';
import { createProfileSaveHandler, profileSaveChannel } from './profile';

const trustedUrl = 'http://localhost:5173/';
const windowStub = {
  webContents: {
    mainFrame: { url: trustedUrl },
    getURL: () => trustedUrl,
  },
};

const eventFor = (url: string) => {
  windowStub.webContents.mainFrame.url = url;
  return {
    sender: windowStub.webContents,
    senderFrame: windowStub.webContents.mainFrame,
  };
};

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

it('normalizes a valid PNG into a WebP data URL', async () => {
  const bytes = new Uint8Array(await sharp({
    create: { width: 2, height: 2, channels: 4, background: { r: 60, g: 180, b: 220, alpha: 1 } },
  }).png().toBuffer());

  await expect(normalizeProfileAvatar({ mimeType: 'image/png', bytes })).resolves.toMatch(/^data:image\/webp;base64,/u);
});

it('rejects an untrusted sender for profile save', async () => {
  const saveProfile = vi.fn(async () => ({
    formatVersion: 1 as const,
    displayName: 'Sifan',
    avatarDataUrl: null,
    onboarding: { profileCompleted: false, modelStepCompleted: false },
  }));
  const handler = createProfileSaveHandler(windowStub, trustedUrl, { saveProfile } as never, async () => 'avatar', () => false);

  await expect(handler(eventFor('https://evil.test/'), {
    displayName: 'Sifan',
    avatar: null,
  })).resolves.toBeNull();
  expect(saveProfile).not.toHaveBeenCalled();
});

it('rejects the first profile completion when no project library is active', async () => {
  const loadProfile = vi.fn(async () => ({
    formatVersion: 1 as const,
    displayName: '',
    avatarDataUrl: null,
    onboarding: { profileCompleted: false, modelStepCompleted: false },
  }));
  const saveProfile = vi.fn();
  const handler = createProfileSaveHandler(
    windowStub,
    trustedUrl,
    { loadProfile, saveProfile } as never,
    async () => 'avatar',
    () => false,
  );

  await expect(handler(eventFor(trustedUrl), {
    displayName: 'Sifan',
    onboarding: { profileCompleted: true },
  })).resolves.toBeNull();
  expect(loadProfile).toHaveBeenCalledOnce();
  expect(saveProfile).not.toHaveBeenCalled();
});

it('allows the first profile completion when a project library is active', async () => {
  const current = {
    formatVersion: 1 as const,
    displayName: '',
    avatarDataUrl: null,
    onboarding: { profileCompleted: false, modelStepCompleted: false },
  };
  const completed = {
    ...current,
    displayName: 'Sifan',
    onboarding: { ...current.onboarding, profileCompleted: true },
  };
  const saveProfile = vi.fn(async () => completed);
  const handler = createProfileSaveHandler(
    windowStub,
    trustedUrl,
    { loadProfile: vi.fn(async () => current), saveProfile },
    async () => 'avatar',
    () => true,
  );

  await expect(handler(eventFor(trustedUrl), {
    displayName: 'Sifan',
    onboarding: { profileCompleted: true },
  })).resolves.toEqual(completed);
  expect(saveProfile).toHaveBeenCalledWith({
    displayName: 'Sifan',
    onboarding: { profileCompleted: true },
  });
});

it('does not require an active library for unrelated changes to a completed profile', async () => {
  const current = {
    formatVersion: 1 as const,
    displayName: 'Sifan',
    avatarDataUrl: null,
    onboarding: { profileCompleted: true, modelStepCompleted: true },
  };
  const updated = { ...current, displayName: 'Chris' };
  const saveProfile = vi.fn(async () => updated);
  const handler = createProfileSaveHandler(
    windowStub,
    trustedUrl,
    { loadProfile: vi.fn(async () => current), saveProfile },
    async () => 'avatar',
    () => false,
  );

  await expect(handler(eventFor(trustedUrl), { displayName: 'Chris' })).resolves.toEqual(updated);
  expect(saveProfile).toHaveBeenCalledWith({ displayName: 'Chris' });
});
