import { imageTools, type ImageTool } from '../image-tools/target';

export const providerCapabilities = [
  'conversation',
  'vision-analysis',
  'image-generation',
  'image-editing',
] as const;

export type ProviderToolCapability = {
  tool: ImageTool;
  supportsMask: boolean;
  supportsTransparency: boolean;
  maxWidth?: number;
  maxHeight?: number;
  maxBytes?: number;
  supportsRemoteCancellation: boolean;
  supportsStatusQuery: boolean;
  parameterRanges?: Record<string, { min?: number; max?: number }>;
};

export const providerConnectionIds = ['openai-compatible'] as const;
export const imageTransports = ['images', 'responses'] as const;
export const providerProfiles = ['conversation', 'image'] as const;

export type ProviderCapability = (typeof providerCapabilities)[number];
export type ProviderModelConfig = Partial<Record<ProviderCapability, string>>;
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
  toolCapabilities?: readonly ProviderToolCapability[];
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

const isFinitePositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isImageTool = (value: unknown): value is ImageTool => typeof value === 'string' && imageTools.includes(value as ImageTool);

const normalizeParameterRanges = (value: unknown): Record<string, { min?: number; max?: number }> | undefined | null => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  const ranges: Record<string, { min?: number; max?: number }> = {};
  for (const [key, range] of Object.entries(value)) {
    if (!/^[-_a-zA-Z][-_a-zA-Z0-9]*$/u.test(key) || !isRecord(range)) return null;
    const min = range.min;
    const max = range.max;
    if (min !== undefined && (typeof min !== 'number' || !Number.isFinite(min)) || max !== undefined && (typeof max !== 'number' || !Number.isFinite(max))) return null;
    if (min !== undefined && max !== undefined && ((min as number) > (max as number))) return null;
    ranges[key] = { ...(min === undefined ? {} : { min: min as number }), ...(max === undefined ? {} : { max: max as number }) };
  }
  return ranges;
};

export const normalizeProviderToolCapability = (value: unknown): ProviderToolCapability | null => {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'tool', 'supportsMask', 'supportsTransparency', 'maxWidth', 'maxHeight', 'maxBytes',
    'supportsRemoteCancellation', 'supportsStatusQuery', 'parameterRanges',
  ])) return null;
  if (!isImageTool(value.tool) || typeof value.supportsMask !== 'boolean' || typeof value.supportsTransparency !== 'boolean'
    || typeof value.supportsRemoteCancellation !== 'boolean' || typeof value.supportsStatusQuery !== 'boolean') return null;
  const maxWidth = value.maxWidth;
  const maxHeight = value.maxHeight;
  const maxBytes = value.maxBytes;
  if (maxWidth !== undefined && !isFinitePositive(maxWidth)) return null;
  if (maxHeight !== undefined && !isFinitePositive(maxHeight)) return null;
  if (maxBytes !== undefined && !isFinitePositive(maxBytes)) return null;
  const parameterRanges = normalizeParameterRanges(value.parameterRanges);
  if (parameterRanges === null) return null;
  return {
    tool: value.tool,
    supportsMask: value.supportsMask,
    supportsTransparency: value.supportsTransparency,
    ...(maxWidth === undefined ? {} : { maxWidth }),
    ...(maxHeight === undefined ? {} : { maxHeight }),
    ...(maxBytes === undefined ? {} : { maxBytes }),
    supportsRemoteCancellation: value.supportsRemoteCancellation,
    supportsStatusQuery: value.supportsStatusQuery,
    ...(parameterRanges === undefined ? {} : { parameterRanges }),
  };
};

export const normalizeProviderToolCapabilities = (value: unknown): readonly ProviderToolCapability[] | undefined | null => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;
  const normalized = value.map(normalizeProviderToolCapability);
  if (normalized.some((capability) => capability === null)) return null;
  const capabilities = normalized as ProviderToolCapability[];
  if (new Set(capabilities.map((capability) => capability.tool)).size !== capabilities.length) return null;
  return capabilities;
};

export const defaultProviderToolCapabilities: readonly ProviderToolCapability[] = imageTools.map((tool) => ({
  tool,
  supportsMask: tool === 'remove-object' || tool === 'inpaint' || tool === 'remove-watermark',
  supportsTransparency: tool !== 'smart-crop' && tool !== 'resize',
  supportsRemoteCancellation: false,
  supportsStatusQuery: false,
}));

export type ProviderToolCapabilityRequest = {
  tool: ImageTool;
  hasMask?: boolean;
  requiresTransparency?: boolean;
  width?: number;
  height?: number;
  bytes?: number;
  params?: Record<string, unknown>;
};

export type ProviderToolCapabilityValidation =
  | { ok: true; capability: ProviderToolCapability }
  | { ok: false; reason: 'TOOL_UNSUPPORTED' | 'MASK_UNSUPPORTED' | 'TRANSPARENCY_UNSUPPORTED' | 'SIZE_UNSUPPORTED' | 'PARAMETER_OUT_OF_RANGE' };

export const validateProviderToolCapability = (
  request: ProviderToolCapabilityRequest,
  capabilities: readonly ProviderToolCapability[] = defaultProviderToolCapabilities,
): ProviderToolCapabilityValidation => {
  const capability = capabilities.find((candidate) => candidate.tool === request.tool);
  if (!capability) return { ok: false, reason: 'TOOL_UNSUPPORTED' };
  if (request.hasMask === true && !capability.supportsMask) return { ok: false, reason: 'MASK_UNSUPPORTED' };
  if (request.requiresTransparency === true && !capability.supportsTransparency) return { ok: false, reason: 'TRANSPARENCY_UNSUPPORTED' };
  if (request.width !== undefined && (!Number.isFinite(request.width) || request.width <= 0 || (capability.maxWidth !== undefined && request.width > capability.maxWidth))) return { ok: false, reason: 'SIZE_UNSUPPORTED' };
  if (request.height !== undefined && (!Number.isFinite(request.height) || request.height <= 0 || (capability.maxHeight !== undefined && request.height > capability.maxHeight))) return { ok: false, reason: 'SIZE_UNSUPPORTED' };
  if (request.bytes !== undefined && (!Number.isFinite(request.bytes) || request.bytes <= 0 || (capability.maxBytes !== undefined && request.bytes > capability.maxBytes))) return { ok: false, reason: 'SIZE_UNSUPPORTED' };
  for (const [key, range] of Object.entries(capability.parameterRanges ?? {})) {
    if (!(key in (request.params ?? {}))) continue;
    const value = request.params?.[key];
    if (typeof value !== 'number' || !Number.isFinite(value)
      || (range.min !== undefined && value < range.min)
      || (range.max !== undefined && value > range.max)) return { ok: false, reason: 'PARAMETER_OUT_OF_RANGE' };
  }
  return { ok: true, capability };
};

const normalizeBaseUrl = (value: unknown, allowEmpty = false): string | null => {
  if (typeof value !== 'string' || value.length > 2048) return null;
  if (value.trim().length === 0) return allowEmpty ? '' : null;
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
  const baseUrl = normalizeBaseUrl(value.baseUrl, true);
  const models = normalizeModels(value.models, conversationCapabilities);
  return baseUrl !== null && models ? { baseUrl, models } : null;
};

const normalizeImageConfig = (value: unknown): ProviderImageConfig | null => {
  if (!isRecord(value) || !hasOnlyKeys(value, ['baseUrl', 'imageTransport', 'models'])) return null;
  const baseUrl = normalizeBaseUrl(value.baseUrl, true);
  const imageTransport = value.imageTransport === undefined ? 'images' : isImageTransport(value.imageTransport) ? value.imageTransport : null;
  const models = normalizeModels(value.models, imageCapabilities);
  return baseUrl !== null && imageTransport && models ? { baseUrl, imageTransport, models } : null;
};

const normalizeCanonicalProviderConfig = (value: Record<string, unknown>): ProviderConfig | null => {
  if (!hasOnlyKeys(value, ['conversation', 'image', 'toolCapabilities'])) return null;
  const conversation = normalizeConversationConfig(value.conversation);
  const image = normalizeImageConfig(value.image);
  const toolCapabilities = normalizeProviderToolCapabilities(value.toolCapabilities);
  return conversation && image && toolCapabilities !== null ? {
    conversation,
    image,
    ...(toolCapabilities === undefined ? {} : { toolCapabilities }),
  } : null;
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
