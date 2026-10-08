import { credentialDeleteChannel, credentialStatusChannel, credentialStoreChannel } from './credentials';
import { registerCredentialHandlers } from './register-credentials';

describe('registerCredentialHandlers', () => {
  it('registers credential store, delete, and status channels', () => {
    const registrations = new Map<string, (...args: unknown[]) => unknown>();
    registerCredentialHandlers({
      ipc: { handle: (channel, listener) => { registrations.set(channel, listener as (...args: unknown[]) => unknown); } },
      getWindow: () => ({ webContents: {} } as never),
      getTrustedUrl: () => 'http://localhost:5173',
      boundary: {
        storeCredential: vi.fn(),
        deleteCredential: vi.fn(),
        hasCredential: vi.fn(),
      },
    });

    expect([...registrations.keys()]).toEqual([
      credentialStoreChannel,
      credentialDeleteChannel,
      credentialStatusChannel,
    ]);
  });
});
