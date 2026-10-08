import { profileLoadChannel, profileSaveChannel } from './profile';
import { registerProfileHandlers } from './register-profile';

describe('registerProfileHandlers', () => {
  it('registers profile load and save channels', () => {
    const registrations = new Map<string, (...args: unknown[]) => unknown>();
    registerProfileHandlers({
      ipc: { handle: (channel, listener) => { registrations.set(channel, listener as (...args: unknown[]) => unknown); } },
      getWindow: () => ({ webContents: {} } as never),
      getTrustedUrl: () => 'http://localhost:5173',
      store: { loadProfile: vi.fn(), saveProfile: vi.fn() },
      normalizeAvatar: vi.fn(),
    });

    expect([...registrations.keys()]).toEqual([
      profileLoadChannel,
      profileSaveChannel,
    ]);
  });
});
