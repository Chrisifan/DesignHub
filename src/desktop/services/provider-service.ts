import type { GeneratedImage } from '../../features/providers/adapter';
import { createProviderAdapterResolver } from '../provider-adapter-resolver';
import { loadProviderConfigs } from '../security/provider-config';
import type { SystemCredentialStore } from '../security/credentials';
import type { ProviderBatchRequest, ProviderBatchResponse } from '../../features/image-tools/worker';

export type ProviderServiceDependencies = {
  credentialStore: Pick<SystemCredentialStore, 'getCredential'>;
  providerConfigPath: string;
  generatedImageBytes: (image: GeneratedImage) => Promise<{ bytes: Uint8Array; mimeType: string }>;
  environment?: { baseUrl?: string; apiKey?: string };
};

/** Main-process provider boundary used by image-tool workers. */
export const createProviderService = (dependencies: ProviderServiceDependencies) => ({
  executeImageTool: async (request: ProviderBatchRequest): Promise<ProviderBatchResponse> => {
    const executor = request.job.executor;
    if (!executor || executor.kind !== 'provider' || !executor.connectionId) throw new Error('CONNECTION_REQUIRED');
    const savedConfig = (await loadProviderConfigs(dependencies.providerConfigPath))[executor.connectionId as 'openai-compatible'];
    if (!savedConfig) throw new Error('PROVIDER_NOT_CONFIGURED');
    const adapter = await createProviderAdapterResolver({
      connectionId: executor.connectionId,
      config: savedConfig,
      environment: dependencies.environment ?? { baseUrl: process.env.DESIGNHUB_PROVIDER_BASE_URL, apiKey: process.env.DESIGNHUB_PROVIDER_API_KEY },
      getCredential: async (account) => dependencies.credentialStore.getCredential?.(account) ?? null,
    })();
    if (!adapter.editImage) throw new Error('IMAGE_CAPABILITY_UNAVAILABLE');
    const result = await adapter.editImage({
      prompt: `Batch ${request.job.tool}`,
      image: new Blob([new Uint8Array(request.sourceBytes).buffer as ArrayBuffer], { type: 'image/*' }),
      tool: request.job.tool as import('../../features/image-tools/target').ImageTool,
      toolParams: request.job.params,
      ...(executor.modelId ? { model: executor.modelId } : {}),
      requiresTransparency: request.job.tool === 'remove-background',
    }, request.signal);
    if (!result.images[0]) throw new Error('IMAGE_RESULT_EMPTY');
    return { bytes: (await dependencies.generatedImageBytes(result.images[0])).bytes };
  },
});
