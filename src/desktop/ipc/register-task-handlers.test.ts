import { taskCompositionPublishChannel, taskCompositionResolveChannel, taskListChannel } from './tasks';
import { registerTaskHandlers } from './register-task-handlers';

describe('registerTaskHandlers', () => {
  it('registers task listing and composition lifecycle channels', () => {
    const registrations = new Map<string, (...args: unknown[]) => unknown>();
    registerTaskHandlers({
      ipc: { handle: (channel, listener) => { registrations.set(channel, listener as (...args: unknown[]) => unknown); } },
      getWindow: () => ({ webContents: {} } as never),
      getTrustedUrl: () => 'http://localhost:5173',
      getLibrary: () => null,
      loadTasks: vi.fn(),
      publishComposition: vi.fn(),
      resolveComposition: vi.fn(),
    });

    expect([...registrations.keys()]).toEqual([
      taskListChannel,
      taskCompositionPublishChannel,
      taskCompositionResolveChannel,
    ]);
  });
});
