import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import type { ManagedAsset } from '../../features/assets/import-assets';
import { createAssetStore } from '../storage/asset-store';
import type { ProviderBatchRequest, ProviderBatchResponse } from '../../features/image-tools/worker';
import { createProviderService, type ProviderServiceDependencies } from './provider-service';

export type ImageToolServiceDependencies = ProviderServiceDependencies;

export const createImageToolService = (dependencies: ImageToolServiceDependencies) => {
  const provider = createProviderService(dependencies);
  return {
    executeProvider: (request: ProviderBatchRequest): Promise<ProviderBatchResponse> => provider.executeImageTool(request),
    importAsset: async (
      workspace: ProjectLibraryHandle,
      input: { libraryId: string; projectId: string; items: Array<{ name: string; mimeType: string; data: Uint8Array }> },
    ): Promise<ManagedAsset | null> => {
      const result = await createAssetStore(workspace).importAssets(input);
      return result.find((item) => item.status === 'success')?.asset ?? null;
    },
  };
};
