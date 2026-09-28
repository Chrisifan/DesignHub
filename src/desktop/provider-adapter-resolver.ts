import { createOpenAICompatibleAdapter, providerCapabilities, type ChatStreamEvent, type MainOnlyAdapterOptions, type OpenAICompatibleAdapter } from '../features/providers/adapter';
import { defaultProviderToolCapabilities, type ProviderConfig, type ProviderProfile } from '../features/providers/config';
import { resolveProviderCredential } from './security/keyring-credentials';

export type ProviderAdapterResolverOptions = {
  connectionId: string;
  config?: ProviderConfig;
  environment?: { baseUrl?: string; apiKey?: string };
  getCredential: (account: string) => Promise<string | null>;
  createAdapter?: (options: MainOnlyAdapterOptions) => OpenAICompatibleAdapter;
};

const profileConfig = (config: ProviderConfig | undefined, profile: ProviderProfile) => profile === 'conversation' ? config?.conversation : config?.image;

const forwardConversationStream = (adapterPromise: Promise<OpenAICompatibleAdapter>, request: Parameters<OpenAICompatibleAdapter['streamChat']>[0], signal?: AbortSignal): AsyncIterable<ChatStreamEvent> => ({
  [Symbol.asyncIterator]: () => {
    let iteratorPromise: Promise<AsyncIterator<ChatStreamEvent>> | undefined;
    const getIterator = (): Promise<AsyncIterator<ChatStreamEvent>> => {
      iteratorPromise ??= adapterPromise.then((adapter) => adapter.streamChat(request, signal)[Symbol.asyncIterator]());
      return iteratorPromise;
    };
    return { next: () => getIterator().then((iterator) => iterator.next()) };
  },
});

export const createProviderAdapterResolver = (options: ProviderAdapterResolverOptions): (() => Promise<OpenAICompatibleAdapter>) => {
  const createAdapter = options.createAdapter ?? createOpenAICompatibleAdapter;
  let conversationPromise: Promise<OpenAICompatibleAdapter> | undefined;
  let imagePromise: Promise<OpenAICompatibleAdapter> | undefined;

  const createProfileAdapter = async (profile: ProviderProfile): Promise<OpenAICompatibleAdapter> => {
    const configured = profileConfig(options.config, profile);
    const apiKey = await resolveProviderCredential({ getCredential: options.getCredential }, options.connectionId, profile)
      ?? options.environment?.apiKey
      ?? '';
    const adapterOptions: MainOnlyAdapterOptions = {
      baseUrl: configured?.baseUrl || options.environment?.baseUrl || '',
      apiKey,
      models: configured?.models,
      toolCapabilities: options.config?.toolCapabilities,
      ...(profile === 'image' ? { imageTransport: configured && 'imageTransport' in configured ? configured.imageTransport : 'images' } : {}),
    };
    return createAdapter(adapterOptions);
  };

  const getProfileAdapter = (profile: ProviderProfile): Promise<OpenAICompatibleAdapter> => {
    if (profile === 'conversation') {
      conversationPromise ??= createProfileAdapter(profile);
      return conversationPromise;
    }
    imagePromise ??= createProfileAdapter(profile);
    return imagePromise;
  };

  return async () => ({
    capabilities: providerCapabilities,
    toolCapabilities: options.config?.toolCapabilities ?? defaultProviderToolCapabilities,
    chat: (request, signal) => getProfileAdapter('conversation').then((adapter) => adapter.chat(request, signal)),
    streamChat: (request, signal) => forwardConversationStream(getProfileAdapter('conversation'), request, signal),
    analyzeVision: (request, signal) => getProfileAdapter('conversation').then((adapter) => adapter.analyzeVision(request, signal)),
    generateImage: (request, signal) => getProfileAdapter('image').then((adapter) => adapter.generateImage(request, signal)),
    editImage: (request, signal) => getProfileAdapter('image').then((adapter) => adapter.editImage(request, signal)),
  });
};
