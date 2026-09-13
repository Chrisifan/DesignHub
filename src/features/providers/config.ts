export const providerCapabilities = [
  'conversation',
  'vision-analysis',
  'image-generation',
  'image-editing',
] as const;

export const providerConnectionIds = ['openai-compatible'] as const;

export type ProviderCapability = (typeof providerCapabilities)[number];
export type ProviderConnectionId = (typeof providerConnectionIds)[number];
export type ProviderModelConfig = Partial<Record<ProviderCapability, string>>;
export type ProviderConfig = {
  baseUrl: string;
  models: ProviderModelConfig;
};
export type ProviderConfigMap = Partial<Record<ProviderConnectionId, ProviderConfig>>;
export type ProviderConfigSaveInput = {
  connectionId: ProviderConnectionId;
  config: ProviderConfig;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const hasOnlyKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => Object.keys(value).every((key) => allowed.includes(key));
const isProviderCapability = (value: string): value is ProviderCapability => providerCapabilities.includes(value as ProviderCapability);

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

const normalizeModels = (value: unknown): ProviderModelConfig | null => {
  if (value === undefined) return {};
  if (!isRecord(value) || !hasOnlyKeys(value, providerCapabilities)) return null;
  const models: ProviderModelConfig = {};
  for (const [capability, model] of Object.entries(value)) {
    if (!isProviderCapability(capability) || typeof model !== 'string') return null;
    const normalized = model.trim();
    if (!normalized || normalized.length > 128 || /[\u0000-\u001F]/u.test(normalized)) return null;
    models[capability] = normalized;
  }
  return models;
};

export const normalizeProviderConfig = (value: unknown): ProviderConfig | null => {
  if (!isRecord(value) || !hasOnlyKeys(value, ['baseUrl', 'models'])) return null;
  const baseUrl = normalizeBaseUrl(value.baseUrl);
  const models = normalizeModels(value.models);
  return baseUrl && models ? { baseUrl, models } : null;
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
