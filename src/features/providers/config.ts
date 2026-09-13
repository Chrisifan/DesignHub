export const providerCapabilities = [
  'conversation',
  'vision-analysis',
  'image-generation',
  'image-editing',
] as const;

export const providerConnectionIds = ['openai-compatible'] as const;
export const imageTransports = ['images', 'responses'] as const;
export const providerProfiles = ['conversation', 'image'] as const;

export type ProviderCapability = (typeof providerCapabilities)[number];
export type ProviderConnectionId = (typeof providerConnectionIds)[number];
export type ImageTransport = (typeof imageTransports)[number];
export type ProviderProfile = (typeof providerProfiles)[number];
export type ProviderConversationCapability = 'conversation' | 'vision-analysis';
export type ProviderImageCapability = 'image-generation' | 'image-editing';
export type ProviderConversationModels = Partial<Record<ProviderConversationCapability, string>>;
export type ProviderImageModels = Partial<Record<ProviderImageCapability, string>>;
export type ProviderConversationConfig = {
  baseUrl: string;
  models: ProviderConversationModels;
};
export type ProviderImageConfig = {
  baseUrl: string;
  imageTransport: ImageTransport;
  models: ProviderImageModels;
};
export type ProviderConfig = {
  conversation: ProviderConversationConfig;
  image: ProviderImageConfig;
};
export type ProviderConfigMap = Partial<Record<ProviderConnectionId, ProviderConfig>>;
export type ProviderConfigSaveInput = {
  connectionId: ProviderConnectionId;
  config: ProviderConfig;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const hasOnlyKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => Object.keys(value).every((key) => allowed.includes(key));
const isImageTransport = (value: unknown): value is ImageTransport => typeof value === 'string' && imageTransports.includes(value as ImageTransport);
const conversationCapabilities: readonly ProviderConversationCapability[] = ['conversation', 'vision-analysis'];
const imageCapabilities: readonly ProviderImageCapability[] = ['image-generation', 'image-editing'];

const normalizeBaseUrl = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    const localHttp = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && localHttp)) || !url.hostname || url.username || url.password || url.search || url.hash) return null;
    const pathname = url.pathname.replace(/\/+$/u, '');
    return `${url.origin}${pathname === '/' ? '' : pathname}`;
  } catch {
    return null;
  }
};

const normalizeModels = <T extends string>(value: unknown, allowed: readonly T[]): Partial<Record<T, string>> | null => {
  if (value === undefined) return {};
  if (!isRecord(value) || !hasOnlyKeys(value, allowed)) return null;
  const models: Partial<Record<T, string>> = {};
  for (const [capability, model] of Object.entries(value)) {
    if (!allowed.includes(capability as T) || typeof model !== 'string') return null;
    const normalized = model.trim();
    if (!normalized || normalized.length > 128 || /[\u0000-\u001F]/u.test(normalized)) return null;
    models[capability as T] = normalized;
  }
  return models;
};

const normalizeConversationConfig = (value: unknown): ProviderConversationConfig | null => {
  if (!isRecord(value) || !hasOnlyKeys(value, ['baseUrl', 'models'])) return null;
  const baseUrl = normalizeBaseUrl(value.baseUrl);
  const models = normalizeModels(value.models, conversationCapabilities);
  return baseUrl && models ? { baseUrl, models } : null;
};

const normalizeImageConfig = (value: unknown): ProviderImageConfig | null => {
  if (!isRecord(value) || !hasOnlyKeys(value, ['baseUrl', 'imageTransport', 'models'])) return null;
  const baseUrl = normalizeBaseUrl(value.baseUrl);
  const imageTransport = value.imageTransport === undefined ? 'images' : isImageTransport(value.imageTransport) ? value.imageTransport : null;
  const models = normalizeModels(value.models, imageCapabilities);
  return baseUrl && imageTransport && models ? { baseUrl, imageTransport, models } : null;
};

const normalizeCanonicalProviderConfig = (value: Record<string, unknown>): ProviderConfig | null => {
  if (!hasOnlyKeys(value, ['conversation', 'image'])) return null;
  const conversation = normalizeConversationConfig(value.conversation);
  const image = normalizeImageConfig(value.image);
  return conversation && image ? { conversation, image } : null;
};

const normalizeLegacyProviderConfig = (value: Record<string, unknown>): ProviderConfig | null => {
  if (!hasOnlyKeys(value, ['baseUrl', 'imageTransport', 'models'])) return null;
  const baseUrl = normalizeBaseUrl(value.baseUrl);
  const imageTransport = value.imageTransport === undefined ? 'images' : isImageTransport(value.imageTransport) ? value.imageTransport : null;
  const models = normalizeModels(value.models, providerCapabilities);
  if (!baseUrl || !imageTransport || !models) return null;
  const conversationModels: ProviderConversationModels = {};
  const imageModels: ProviderImageModels = {};
  conversationCapabilities.forEach((capability) => {
    const model = models[capability];
    if (model) conversationModels[capability] = model;
  });
  imageCapabilities.forEach((capability) => {
    const model = models[capability];
    if (model) imageModels[capability] = model;
  });
  return {
    conversation: { baseUrl, models: conversationModels },
    image: { baseUrl, imageTransport, models: imageModels },
  };
};

export const normalizeProviderConfig = (value: unknown): ProviderConfig | null => {
  if (!isRecord(value)) return null;
  if ('conversation' in value || 'image' in value) return normalizeCanonicalProviderConfig(value);
  return normalizeLegacyProviderConfig(value);
};

export const normalizeProviderConfigs = (value: unknown): ProviderConfigMap | null => {
  if (!isRecord(value) || !hasOnlyKeys(value, providerConnectionIds)) return null;
  const configs: ProviderConfigMap = {};
  for (const [connectionId, config] of Object.entries(value)) {
    if (!providerConnectionIds.includes(connectionId as ProviderConnectionId)) return null;
    const normalized = normalizeProviderConfig(config);
    if (!normalized) return null;
    configs[connectionId as ProviderConnectionId] = normalized;
  }
  return configs;
};

export const normalizeProviderConfigSaveInput = (value: unknown): ProviderConfigSaveInput | null => {
  if (!isRecord(value) || !hasOnlyKeys(value, ['connectionId', 'config']) || typeof value.connectionId !== 'string') return null;
  if (!providerConnectionIds.includes(value.connectionId as ProviderConnectionId)) return null;
  const config = normalizeProviderConfig(value.config);
  return config ? { connectionId: value.connectionId as ProviderConnectionId, config } : null;
};

export const providerCredentialAccount = (connectionId: string, profile: ProviderProfile): string => `${connectionId}:${profile}`;

