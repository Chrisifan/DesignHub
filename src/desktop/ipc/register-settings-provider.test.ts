import { providerConfigLoadChannel, providerConfigSaveChannel, providerStatusLoadChannel, providerStatusSaveChannel } from './providers';
import { settingsLoadChannel, settingsSaveChannel } from './settings';
import { registerSettingsProviderHandlers } from './register-settings-provider';

describe('registerSettingsProviderHandlers', () => {
  it('registers settings and provider channels as one domain group', () => {
    const registrations = new Map<string, (...args: unknown[]) => unknown>();
    registerSettingsProviderHandlers({
      ipc: { handle: (channel, listener) => { registrations.set(channel, listener as (...args: unknown[]) => unknown); } },
      getWindow: () => ({ webContents: {} } as never),
      getTrustedUrl: () => 'http://localhost:5173',
      getLibrary: () => null,
      loadSettings: vi.fn(),
      saveSettings: vi.fn(),
      loadProviderConfigs: vi.fn(),
      saveProviderConfig: vi.fn(),
    });

    expect([...registrations.keys()]).toEqual([
      settingsLoadChannel,
      settingsSaveChannel,
      providerConfigLoadChannel,
      providerConfigSaveChannel,
      providerStatusLoadChannel,
      providerStatusSaveChannel,
    ]);
  });
});
