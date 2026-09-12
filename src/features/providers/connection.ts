export const providerCapabilities = [
  'conversation',
  'vision-analysis',
  'image-generation',
  'image-editing',
] as const;

export type ProviderCapability = (typeof providerCapabilities)[number];
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
};

export const connectionSummary = (input: ConnectionInput): ConnectionSummary => ({
  id: input.id,
  label: input.label,
});
