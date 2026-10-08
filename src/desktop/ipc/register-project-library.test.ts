import { expect, it, vi } from 'vitest';

import { projectLibraryChooseChannel, projectLibraryStatusChannel } from './project-library';
import { registerProjectLibraryHandlers } from './register-project-library';

describe('registerProjectLibraryHandlers', () => {
  it('registers project library status and choose channels', () => {
    const registrations = new Map<string, (...args: unknown[]) => unknown>();
    registerProjectLibraryHandlers({
      ipc: { handle: (channel, listener) => { registrations.set(channel, listener as (...args: unknown[]) => unknown); } },
      getWindow: () => ({ webContents: {} } as never),
      getTrustedUrl: () => 'http://localhost:5173',
      createHandlers: () => ({ getStatus: vi.fn(), choose: vi.fn() }),
    });

    expect([...registrations.keys()]).toEqual([
      projectLibraryStatusChannel,
      projectLibraryChooseChannel,
    ]);
  });

  it('returns null until a trusted window context is available', async () => {
    const registrations = new Map<string, (...args: unknown[]) => unknown>();
    const createHandlers = vi.fn(() => ({ getStatus: vi.fn(), choose: vi.fn() }));
    registerProjectLibraryHandlers({
      ipc: { handle: (channel, listener) => { registrations.set(channel, listener as (...args: unknown[]) => unknown); } },
      getWindow: () => null,
      getTrustedUrl: () => null,
      createHandlers,
    });

    expect(registrations.get(projectLibraryStatusChannel)?.({})).toBeNull();
    expect(registrations.get(projectLibraryChooseChannel)?.({})).toBeNull();
    expect(createHandlers).not.toHaveBeenCalled();
  });
});
