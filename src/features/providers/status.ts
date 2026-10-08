import type { ProviderConfig, ProviderConfigMap, ProviderConnectionId, ProviderProfile } from './config';

export type ProviderTestStatus = 'unknown' | 'connected' | 'error';

export type ProviderProfileStatus = {
  status: Exclude<ProviderTestStatus, 'unknown'>;
  testedAt: string;
  configFingerprint: string;
};

export type ProviderConnectionStatusMap = Partial<Record<ProviderConnectionId, Partial<Record<ProviderProfile, ProviderProfileStatus>>>>;

const providerStatusCacheTtlMs = 30 * 60 * 1000;

const profileConfig = (config: ProviderConfig | undefined, profile: ProviderProfile): unknown => {
  if (!config) return null;
  return profile === 'conversation' ? config.conversation : config.image;
};

export const providerConfigFingerprint = (configs: ProviderConfigMap | ProviderConfig | undefined, profile: ProviderProfile): string => {
  const config = 'conversation' in (configs ?? {}) || 'image' in (configs ?? {})
    ? configs as ProviderConfig
    : (configs as ProviderConfigMap | undefined)?.['openai-compatible'];
  return JSON.stringify(profileConfig(config, profile));
};

export const getProviderProfileStatus = (
  statuses: ProviderConnectionStatusMap | null | undefined,
  connectionId: ProviderConnectionId,
  profile: ProviderProfile,
  configs: ProviderConfigMap | ProviderConfig | undefined,
): ProviderTestStatus => {
  const saved = statuses?.[connectionId]?.[profile];
  return saved && saved.configFingerprint === providerConfigFingerprint(configs, profile) ? saved.status : 'unknown';
};

export const isProviderProfileStatusCacheValid = (
  statuses: ProviderConnectionStatusMap | null | undefined,
  connectionId: ProviderConnectionId,
  profile: ProviderProfile,
  configs: ProviderConfigMap | ProviderConfig | undefined,
  now = Date.now(),
): boolean => {
  const saved = statuses?.[connectionId]?.[profile];
  if (saved?.status !== 'connected' || saved.configFingerprint !== providerConfigFingerprint(configs, profile)) return false;
  const testedAt = Date.parse(saved.testedAt);
  if (!Number.isFinite(testedAt)) return false;
  const age = now - testedAt;
  return age >= 0 && age <= providerStatusCacheTtlMs;
};

export const mergeProviderConnectionStatus = (
  current: ProviderConnectionStatusMap,
  connectionId: ProviderConnectionId,
  profile: ProviderProfile,
  status: Exclude<ProviderTestStatus, 'unknown'>,
  configs: ProviderConfigMap | ProviderConfig | undefined,
  testedAt = new Date().toISOString(),
): ProviderConnectionStatusMap => ({
  ...current,
  [connectionId]: {
    ...current[connectionId],
    [profile]: { status, testedAt, configFingerprint: providerConfigFingerprint(configs, profile) },
  },
});
