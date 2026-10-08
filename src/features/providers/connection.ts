import { providerConnectionIds, type ProviderCapability, type ProviderConfigMap } from './config';
import type { ProviderTestStatus } from './status';

export { providerCapabilities } from './config';
export type { ProviderCapability } from './config';
export type ConnectionInput = {
  id: string;
  label: string;
  apiKey: string;
};
export type ConnectionSummary = {
  id: string;
  label: string;
};
export type ProviderConnection = ConnectionSummary & {
  status: 'connected' | 'not-configured' | 'error';
  capabilities: readonly ProviderCapability[];
  profileStatuses?: Partial<Record<'conversation' | 'image', ProviderTestStatus>>;
};

export const connectionSummary = (input: ConnectionInput): ConnectionSummary => ({
  id: input.id,
  label: input.label,
});

export const selectConfiguredConnection = (
  capability: ProviderCapability,
  configs: ProviderConfigMap | null | undefined,
  credentialAccounts: readonly string[],
): string | null => {
  if (!configs) return null;
  const credentialSet = new Set(credentialAccounts);
  return providerConnectionIds.find((connectionId) => {
    const config = configs[connectionId];
    if (!credentialSet.has(`${connectionId}:${capability === 'image-generation' || capability === 'image-editing' ? 'image' : 'conversation'}`)) return false;
    if (!config) return true;
    return capability === 'conversation' || capability === 'vision-analysis'
      ? Boolean(config.conversation)
      : Boolean(config.image);
  }) ?? null;
};
