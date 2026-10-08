import { exportDocumentChannel } from './export';
import { registerExportHandlers } from './register-export';

describe('registerExportHandlers', () => {
  it('registers the document export channel', () => {
    const registrations = new Map<string, (...args: unknown[]) => unknown>();
    registerExportHandlers({
      ipc: { handle: (channel, listener) => { registrations.set(channel, listener as (...args: unknown[]) => unknown); } },
      getWindow: () => ({ webContents: {} } as never),
      getTrustedUrl: () => 'http://localhost:5173',
      getLibrary: () => null,
      exportDocument: vi.fn(),
    });

    expect([...registrations.keys()]).toEqual([exportDocumentChannel]);
  });
});
