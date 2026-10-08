import { normalizeProviderConfigSaveInput, type ProviderConfigMap, type ProviderConfigSaveInput } from '../../features/providers/config';
import type { ProviderConnectionStatusMap } from '../../features/providers/status';
import { isTrustedProjectLibraryRequest } from './workspace';

export const providerConfigLoadChannel = 'provider:config-load';
export const providerConfigSaveChannel = 'provider:config-save';
export const providerStatusLoadChannel = 'provider:status-load';
export const providerStatusSaveChannel = 'provider:status-save';

type ProviderSender = { mainFrame: { url: string }; getURL: () => string };
type ProviderRequest = { sender: ProviderSender; senderFrame: { url: string } | null };
type ProviderWindow = { webContents: ProviderSender };

export const createProviderConfigLoadHandler = (
  window: ProviderWindow,
  trustedUrl: string,
  loadConfigs: () => Promise<ProviderConfigMap>,
) => async (event: ProviderRequest): Promise<ProviderConfigMap | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl)) return null;
  return loadConfigs();
};

export const createProviderConfigSaveHandler = (
  window: ProviderWindow,
  trustedUrl: string,
  saveConfig: (input: ProviderConfigSaveInput) => Promise<boolean>,
) => async (event: ProviderRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl)) return false;
  const normalized = normalizeProviderConfigSaveInput(input);
  if (!normalized) return false;
  return saveConfig(normalized);
};

export const createProviderStatusLoadHandler = (
  window: ProviderWindow,
  trustedUrl: string,
  loadStatuses: () => Promise<ProviderConnectionStatusMap>,
) => async (event: ProviderRequest): Promise<ProviderConnectionStatusMap | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl)) return null;
  return loadStatuses();
};

export const createProviderStatusSaveHandler = (
  window: ProviderWindow,
  trustedUrl: string,
  saveStatuses: (statuses: ProviderConnectionStatusMap) => Promise<boolean>,
) => async (event: ProviderRequest, statuses: unknown): Promise<boolean> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl)) return false;
  if (!statuses || typeof statuses !== 'object' || Array.isArray(statuses)) return false;
  return saveStatuses(statuses as ProviderConnectionStatusMap);
};
