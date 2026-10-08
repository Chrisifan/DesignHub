import {
  conversationSubmitChannel,
  conversationTestChannel,
  designGenerationSlotRetryChannel,
  designGenerationSubmitChannel,
  designerArtworkGenerationSubmitChannel,
  imageEditSubmitChannel,
  imageGenerationSubmitChannel,
  imageGenerationTestChannel,
  taskCancelChannel,
  taskRetryChannel,
} from './agent';
import { registerAgentHandlers } from './register-agent';

describe('registerAgentHandlers', () => {
  const options = () => ({
    ipc: {
      handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
        registrations.set(channel, listener);
      },
    },
    getWindow: () => ({ webContents: {} } as never),
    getTrustedUrl: () => 'http://localhost:5173',
    getLibrary: () => null,
    submitConversation: vi.fn(),
    submitDesignGeneration: vi.fn(),
    retryDesignGenerationSlot: vi.fn(),
    testConversation: vi.fn(),
    submitImageGeneration: vi.fn(),
    testImageGeneration: vi.fn(),
    submitDesignerArtworkGeneration: vi.fn(),
    submitImageEdit: vi.fn(),
    cancelTask: vi.fn(),
    retryTask: vi.fn(),
  });

  let registrations: Map<string, (...args: unknown[]) => unknown>;

  beforeEach(() => {
    registrations = new Map();
  });

  it('registers all agent channels', () => {
    registerAgentHandlers(options());

    expect([...registrations.keys()]).toEqual([
      conversationSubmitChannel,
      designGenerationSubmitChannel,
      designGenerationSlotRetryChannel,
      conversationTestChannel,
      imageGenerationSubmitChannel,
      imageGenerationTestChannel,
      designerArtworkGenerationSubmitChannel,
      imageEditSubmitChannel,
      taskCancelChannel,
      taskRetryChannel,
    ]);
  });

  it('returns the channel-specific empty value without trusted window context', async () => {
    registerAgentHandlers({ ...options(), getWindow: () => null, getTrustedUrl: () => null });
    const event = {};

    expect(await registrations.get(conversationSubmitChannel)?.(event, {})).toBeNull();
    expect(await registrations.get(taskCancelChannel)?.(event, {})).toBe(false);
  });
});
