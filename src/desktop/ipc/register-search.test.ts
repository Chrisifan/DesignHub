import { searchQueryChannel, searchRebuildChannel } from './search';
import { registerSearchHandlers } from './register-search';

describe('registerSearchHandlers', () => {
  it('registers search rebuild and query channels', () => {
    const registrations = new Map<string, (...args: unknown[]) => unknown>();
    registerSearchHandlers({
      ipc: { handle: (channel, listener) => { registrations.set(channel, listener as (...args: unknown[]) => unknown); } },
      getWindow: () => ({ webContents: {} } as never),
      getTrustedUrl: () => 'http://localhost:5173',
      getLibrary: () => null,
      rebuild: vi.fn(),
      search: vi.fn(),
    });

    expect([...registrations.keys()]).toEqual([
      searchRebuildChannel,
      searchQueryChannel,
    ]);
  });
});
