import { projectPackageImportChannel } from './package';
import { registerProjectPackageHandlers } from './register-project-package';

describe('registerProjectPackageHandlers', () => {
  it('registers only the package import channel', () => {
    const registrations = new Map<string, (...args: unknown[]) => unknown>();

    registerProjectPackageHandlers({
      ipc: {
        handle: (channel, listener) => {
          registrations.set(channel, listener as (...args: unknown[]) => unknown);
        },
      },
      getWindow: () => ({ webContents: {} } as never),
      getTrustedUrl: () => 'http://localhost:5173',
      getLibrary: () => null,
      importPackage: vi.fn(),
    });

    expect([...registrations.keys()]).toEqual([projectPackageImportChannel]);
  });
});
