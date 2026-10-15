import { createTaskState, type ProjectDesignOutput, type TaskRecord, type TaskSource } from '../tasks/state';
import type { Region } from '../canvas/selection';
import { validateToolParams, type ImageTool, type ToolParams } from '../image-tools/target';

type ImageTaskCapability = 'image-generation' | 'image-editing' | 'local-transform';

export type ImageTaskRecordInput = {
  id: string;
  requestId: string;
  requestText: string;
  source: TaskSource;
  baseRevisionId?: string | null;
  designerVersionId?: string;
  connectionId: string;
  model?: string;
  size?: string;
  count?: number;
  tool?: ImageTool;
  toolParams?: ToolParams;
  projectDesignOutput?: ProjectDesignOutput;
  region?: Region;
  sourceAssetId?: string;
  sourceDesignId?: string;
  maskAssetId?: string;
  hasMask?: boolean;
  capability: ImageTaskCapability;
};

/** Builds the persisted task boundary for image generation/editing without starting execution. */
export const createImageTaskRecord = (input: ImageTaskRecordInput): TaskRecord => {
  const sourceId = input.source.id.trim();
  const connectionId = input.connectionId.trim();
  const requestText = input.requestText.trim();
  if (!sourceId || (input.capability !== 'local-transform' && !connectionId) || !requestText
    || (input.capability === 'image-editing' && input.source.kind !== 'project')) throw new Error('IMAGE_TASK_BINDING_REQUIRED');
  if (input.tool && (input.toolParams === undefined || !validateToolParams(input.tool, input.toolParams).ok)) throw new Error('INVALID_PARAMS');
  if (!input.tool && input.toolParams !== undefined) throw new Error('INVALID_PARAMS');

  return createTaskState({
    id: input.id,
    requestId: input.requestId,
    requestText,
    source: { kind: input.source.kind, id: sourceId },
    baseRevisionId: input.baseRevisionId ?? null,
    ...(input.designerVersionId ? { designerVersionId: input.designerVersionId } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.size ? { size: input.size } : {}),
    ...(input.count === undefined ? {} : { count: input.count }),
    ...(input.tool ? { tool: input.tool } : {}),
    ...(input.toolParams ? { toolParams: { ...input.toolParams } } : {}),
    ...(input.projectDesignOutput ? { projectDesignOutput: { ...input.projectDesignOutput } } : {}),
    ...(input.region ? { region: { ...input.region } } : {}),
    ...(input.sourceAssetId ? { sourceAssetId: input.sourceAssetId } : {}),
    ...(input.sourceDesignId ? { sourceDesignId: input.sourceDesignId } : {}),
    ...(input.maskAssetId ? { maskAssetId: input.maskAssetId } : {}),
    ...(input.capability === 'image-editing' ? { hasMask: input.hasMask === true || Boolean(input.maskAssetId) } : {}),
    ...(connectionId ? { providerId: connectionId } : {}),
    capability: input.capability,
    createdAt: new Date().toISOString(),
  });
};
