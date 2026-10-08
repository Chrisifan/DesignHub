import { backupChooseDirectoryChannel, backupCreateChannel, backupRestoreChannel } from './backup';
import { diagnosticsExportChannel } from './diagnostics';
import { exportHistoryListChannel } from './export-history';
import { registerSupportHandlers } from './register-support-handlers';

describe('registerSupportHandlers', () => {
  it('registers backup, export-history, and diagnostics channels', () => {
    const registrations = new Map<string, (...args: unknown[]) => unknown>();
    registerSupportHandlers({
      ipc: { handle: (channel, listener) => { registrations.set(channel, listener as (...args: unknown[]) => unknown); } },
      getWindow: () => ({ webContents: {} } as never),
      getTrustedUrl: () => 'http://localhost:5173',
      getLibrary: () => null,
      showDirectoryDialog: vi.fn(),
      createBackup: vi.fn(),
      restoreBackup: vi.fn(),
      loadExportHistory: vi.fn(),
      writeDiagnostics: vi.fn(),
    });

    expect([...registrations.keys()]).toEqual([
      backupChooseDirectoryChannel,
      backupCreateChannel,
      backupRestoreChannel,
      exportHistoryListChannel,
      diagnosticsExportChannel,
    ]);
  });
});
