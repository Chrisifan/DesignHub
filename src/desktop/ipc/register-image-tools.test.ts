import {
  imageToolCancelChannel,
  imageToolChooseInputChannel,
  imageToolChooseOutputChannel,
  imageToolCreateChannel,
  imageToolGetChannel,
  imageToolImportResultChannel,
  imageToolListChannel,
  imageToolOpenOutputChannel,
  imageToolOpenResultChannel,
  imageToolPauseChannel,
  imageToolReadResultChannel,
  imageToolResumeChannel,
  imageToolRetryChannel,
  imageToolRevealResultChannel,
  imageToolScanChannel,
} from './image-tools-channels';
import { registerImageToolIpcHandlers } from './register-image-tools';

describe('registerImageToolIpcHandlers', () => {
  it('registers every image-tool channel exactly once and guards window-only actions', () => {
    const registrations = new Map<string, (...args: unknown[]) => unknown>();
    const handlers = {
      chooseInput: vi.fn(),
      chooseOutput: vi.fn(),
      scan: vi.fn(),
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
      retry: vi.fn(),
      readResult: vi.fn(),
      openResult: vi.fn(),
      revealResult: vi.fn(),
      openOutput: vi.fn(),
      importResult: vi.fn(),
    };
    const window = { webContents: {} };
    registerImageToolIpcHandlers({
      ipc: { handle: (channel, listener) => { registrations.set(channel, listener as (...args: unknown[]) => unknown); } },
      getWindow: () => window,
      handlers,
    });

    expect([...registrations.keys()]).toEqual([
      imageToolChooseInputChannel,
      imageToolChooseOutputChannel,
      imageToolScanChannel,
      imageToolCreateChannel,
      imageToolListChannel,
      imageToolGetChannel,
      imageToolPauseChannel,
      imageToolResumeChannel,
      imageToolCancelChannel,
      imageToolRetryChannel,
      imageToolReadResultChannel,
      imageToolOpenResultChannel,
      imageToolRevealResultChannel,
      imageToolOpenOutputChannel,
      imageToolImportResultChannel,
    ]);
  });
});
