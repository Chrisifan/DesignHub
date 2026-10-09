import { randomUUID } from 'node:crypto';

import type { GeneratedImage } from '../../features/providers/adapter';
import { createProviderAdapterResolver } from '../provider-adapter-resolver';
import { normalizeProviderImage } from '../provider-image-input';
import { loadProviderConfigs } from '../security/provider-config';
import type { SystemCredentialStore } from '../security/credentials';
import { createAgentTaskService, type AgentTaskService } from '../../features/agent/task-service';
import { createTaskRuntime, type TaskRuntime } from '../../features/tasks/runtime';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { createAssetStore } from '../storage/asset-store';
import { createProjectStore } from '../storage/project-store';
import { loadTaskState, saveTaskState } from '../storage/task-store';
import { loadDocumentScene } from '../storage/scene-store';
import { saveDesignerArtwork } from '../storage/designer-store';
import { transformImageBytes } from '../../features/image-tools/local-codec';
import sharp from 'sharp';

export type TaskServiceFactoryDependencies = {
  workspace: ProjectLibraryHandle;
  credentialStore: Pick<SystemCredentialStore, 'getCredential'>;
  providerConfigPath: string;
  generatedImageBytes: (image: GeneratedImage) => Promise<{ bytes: Uint8Array; mimeType: string }>;
};

export const createAgentTaskServiceForLibrary = async ({
  workspace,
  credentialStore,
  providerConfigPath,
  generatedImageBytes,
}: TaskServiceFactoryDependencies): Promise<AgentTaskService> => {
  const initialTasks = await loadTaskState(workspace, workspace.library.libraryId);
  const runtime: TaskRuntime = createTaskRuntime({
    initialTasks,
    persist: async (tasks) => {
      await saveTaskState(workspace, workspace.library.libraryId, tasks);
    },
  });
  const projectStore = createProjectStore(workspace);
  const assetStore = createAssetStore(workspace);
  const loadManagedProviderImage = async (projectId: string, assetId: string) => {
    const assets = await assetStore.listAssets({ libraryId: workspace.library.libraryId, projectId, includeContextAssets: true });
    const asset = assets.find((candidate) => candidate.id === assetId);
    const bytes = await assetStore.readAsset({ libraryId: workspace.library.libraryId, projectId, assetId });
    if (!asset || !bytes) return null;
    return { name: asset.name, ...await normalizeProviderImage({ bytes, mimeType: asset.mimeType }) };
  };

  return createAgentTaskService({
    runtime,
    persistGeneratedImages: async ({ projectId, images }) => {
      const items = await Promise.all(images.map(async (image, index) => {
        const generated = await generatedImageBytes(image);
        const extension = generated.mimeType === 'image/jpeg' ? 'jpg' : generated.mimeType === 'image/webp' ? 'webp' : 'png';
        return { name: `generated-${index + 1}.${extension}`, mimeType: generated.mimeType, data: generated.bytes };
      }));
      const imported = await assetStore.importAssets({ libraryId: workspace.library.libraryId, projectId, items });
      const failures = imported.filter((result) => result.status === 'error');
      if (failures.length > 0) throw new Error(failures[0].error);
      return imported.filter((result): result is Extract<typeof result, { status: 'success' }> => result.status === 'success').map((result) => result.asset.id);
    },
    persistProjectDesigns: async ({ projectId, designs }) => {
      await projectStore.addProjectDesigns({ libraryId: workspace.library.libraryId, projectId, designs });
    },
    persistDesignerArtwork: async ({ images }) => {
      const generated = await Promise.all(images.map(generatedImageBytes));
      const saved = await Promise.all(generated.map((image) => saveDesignerArtwork(
        workspace,
        workspace.library.libraryId,
        `artwork-${randomUUID()}`,
        image.bytes,
        image.mimeType,
      )));
      return saved.map((item) => item.artworkId);
    },
    loadSourceImage: async ({ projectId, assetId }) => {
      const image = await loadManagedProviderImage(projectId, assetId);
      return image ? new Blob([new Uint8Array(image.bytes).buffer as ArrayBuffer], { type: image.mimeType }) : null;
    },
    loadMaskImage: async ({ projectId, assetId }) => {
      const image = await loadManagedProviderImage(projectId, assetId);
      return image ? new Blob([new Uint8Array(image.bytes).buffer as ArrayBuffer], { type: image.mimeType }) : null;
    },
    executeLocalImageTool: async (input, signal) => {
      if (input.tool !== 'resize') throw new Error('LOCAL_TOOL_UNSUPPORTED');
      if (signal.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
      const source = new Uint8Array(await input.image.arrayBuffer());
      const format = input.toolParams?.format === 'jpeg' || input.toolParams?.format === 'webp' || input.toolParams?.format === 'png' ? input.toolParams.format : 'png';
      const bytes = await transformImageBytes(source, 'resize', { ...input.toolParams, format });
      if (signal.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
      const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      return { images: [{ base64: Buffer.from(bytes).toString('base64'), mimeType }], cost: null };
    },
    validateImageResult: async (input, images) => {
      if (!('tool' in input) || !input.tool) return;
      const sourceBytes = 'image' in input ? new Uint8Array(await input.image.arrayBuffer()) : undefined;
      const sourceMetadata = sourceBytes ? await sharp(Buffer.from(sourceBytes), { animated: false }).metadata() : undefined;
      const expectedSize = input.tool === 'smart-crop'
        ? { width: Number(input.toolParams?.width), height: Number(input.toolParams?.height) }
        : input.tool === 'expand' && sourceMetadata?.width && sourceMetadata.height
          ? { width: sourceMetadata.width + Number(input.toolParams?.left ?? 0) + Number(input.toolParams?.right ?? 0), height: sourceMetadata.height + Number(input.toolParams?.top ?? 0) + Number(input.toolParams?.bottom ?? 0) }
          : input.tool === 'upscale' && sourceMetadata?.width && sourceMetadata.height
            ? { width: Math.round(sourceMetadata.width * Number(input.toolParams?.scale ?? 1)), height: Math.round(sourceMetadata.height * Number(input.toolParams?.scale ?? 1)) }
            : undefined;
      for (const image of images) {
        const generated = await generatedImageBytes(image);
        const metadata = await sharp(Buffer.from(generated.bytes), { animated: false }).metadata();
        if (input.tool === 'remove-background' && !metadata.hasAlpha) throw new Error('TRANSPARENCY_REQUIRED');
        if (expectedSize && (metadata.width !== expectedSize.width || metadata.height !== expectedSize.height)) throw new Error('RESULT_DIMENSIONS_INVALID');
      }
    },
    persistConversationAttachments: async ({ projectId, attachments }) => {
      const imported = await assetStore.importAssets({
        libraryId: workspace.library.libraryId,
        projectId,
        items: attachments.map((attachment) => ({ name: attachment.name, mimeType: attachment.mimeType, data: attachment.bytes, metadata: { purpose: 'conversation-reference' } })),
      });
      const failures = imported.filter((result) => result.status === 'error');
      if (failures.length > 0) throw new Error(failures[0].error);
      return imported.filter((result): result is Extract<typeof result, { status: 'success' }> => result.status === 'success').map((result) => result.asset.id);
    },
    loadContextImage: async ({ projectId, assetId }) => {
      const image = await loadManagedProviderImage(projectId, assetId);
      return image ? { name: image.name, mimeType: image.mimeType, bytes: image.bytes } : null;
    },
    resolveDesignContext: async ({ input, attachmentAssetIds }) => {
      if (!input.projectId || !input.libraryId) throw new Error('DESIGN_CONTEXT_BINDING_REQUIRED');
      const metadata = await projectStore.getProjectMetadata(input.projectId);
      if (!metadata || metadata.workspaceId !== input.libraryId) throw new Error('PROJECT_NOT_FOUND');
      const documentId = input.documentId ?? `${input.projectId}-canvas`;
      const scene = input.documentId ? await loadDocumentScene(workspace, input.libraryId, input.projectId, input.documentId) : null;
      const document = input.documentId ? metadata.documents.find((entry) => entry.id === input.documentId) : undefined;
      const currentImageAssetIds = scene?.layers
        .filter((layer): layer is Extract<typeof layer, { type: 'image' }> => layer.type === 'image' && layer.assetId !== 'placeholder')
        .map((layer) => layer.assetId)
        ?? (metadata.designs ?? []).map((design) => design.assetId);
      const firstDesign = metadata.designs?.[0];
      return {
        version: 1 as const,
        libraryId: input.libraryId,
        projectId: input.projectId,
        documentId,
        brief: metadata.brief ?? '',
        document: { width: document?.width ?? scene?.width ?? firstDesign?.width ?? 1080, height: document?.height ?? scene?.height ?? firstDesign?.height ?? 1440, currentImageAssetIds },
        attachmentAssetIds: [...attachmentAssetIds],
        userMessage: input.message,
        ...(metadata.designerSnapshot && typeof metadata.designerSnapshot === 'object' ? { designerSnapshot: structuredClone(metadata.designerSnapshot) as Record<string, unknown> } : {}),
        ...(metadata.brandSnapshot && typeof metadata.brandSnapshot === 'object' ? { brandSnapshot: structuredClone(metadata.brandSnapshot) as Record<string, unknown> } : {}),
        baseRevisionId: input.baseRevisionId ?? null,
      };
    },
    resolveAdapter: async (connectionId) => {
      if (connectionId !== 'openai-compatible') throw new Error('PROVIDER_NOT_CONFIGURED');
      const savedConfig = (await loadProviderConfigs(providerConfigPath))['openai-compatible'];
      return createProviderAdapterResolver({
        connectionId,
        config: savedConfig,
        environment: { baseUrl: process.env.DESIGNHUB_PROVIDER_BASE_URL, apiKey: process.env.DESIGNHUB_PROVIDER_API_KEY },
        getCredential: async (account) => credentialStore.getCredential?.(account) ?? null,
      })();
    },
  });
};
