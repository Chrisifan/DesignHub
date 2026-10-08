import type { ChatStreamEvent, OpenAICompatibleAdapter } from '../../src/features/providers/adapter';
import { providerCapabilities } from '../../src/features/providers/config';

export const createProviderBridgeFixture = (overrides: Partial<OpenAICompatibleAdapter> = {}): OpenAICompatibleAdapter => ({
  capabilities: providerCapabilities,
  chat: async () => ({ text: 'fixture response', cost: null }),
  streamChat: (): AsyncIterable<ChatStreamEvent> => {
    let consumed = false;
    return {
      [Symbol.asyncIterator]: () => ({
        next: async (): Promise<IteratorResult<ChatStreamEvent>> => {
          if (consumed) return { done: true, value: undefined };
          consumed = true;
          return { done: false, value: { text: 'fixture response', finishReason: 'stop' } };
        },
      }),
    };
  },
  analyzeVision: async () => ({ text: 'fixture vision response', cost: null }),
  generateImage: async () => ({ images: [], cost: null }),
  editImage: async () => ({ images: [], cost: null }),
  ...overrides,
});
