import { normalizeProviderConfigSaveInput, type ProviderConfigMap, type ProviderConfigSaveInput } from '../../features/providers/config';
import { isTrustedWorkspaceRequest } from './workspace';

export const providerConfigLoadChannel = 'provider:config-load';
export const providerConfigSaveChannel = 'provider:config-save';

type ProviderSender = { mainFrame: { url: string }; getURL: () => string };
type ProviderRequest = { sender: ProviderSender; senderFrame: { url: string } | null };
type ProviderWindow = { webContents: ProviderSender };

export const createProviderConfigLoadHandler = (
  window: ProviderWindow,
  trustedUrl: string,
  loadConfigs: () => Promise<ProviderConfigMap>,
) => async (event: ProviderRequest): Promise<ProviderConfigMap | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl)) return null;
  return loadConfigs();
};

export const createProviderConfigSaveHandler = (
  window: ProviderWindow,
  trustedUrl: string,
  saveConfig: (input: ProviderConfigSaveInput) => Promise<boolean>,
) => async (event: ProviderRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl)) return false;
  const normalized = normalizeProviderConfigSaveInput(input);
  if (!normalized) return false;
  return saveConfig(normalized);
};
