import type { DesignScene } from '../canvas/scene';
import type { RevisionStore } from '../revisions/model';

export type ToolResultStatus = 'completed' | 'cancelled' | 'failed';

export type ApplyToolResultInput = {
  status: ToolResultStatus;
  projectId: string;
  documentId: string;
  baseRevisionId: string | null;
  operationId: string;
  sceneAssetId: string;
  assetIds?: string[];
  scene?: DesignScene;
  revisionStore: RevisionStore;
};

export type AppliedToolResult = {
  revisionId: string;
  beforeRevisionId: string | null;
  assetIds: string[];
};

export const applyToolResult = async (input: ApplyToolResultInput): Promise<AppliedToolResult | null> => {
  if (input.status !== 'completed') return null;
  if (!input.projectId.trim() || !input.documentId.trim() || !input.operationId.trim() || !input.sceneAssetId.trim()) {
    throw new Error('TOOL_RESULT_BINDING_REQUIRED');
  }
  const assetIds = [...(input.assetIds ?? [])];
  const committed = await input.revisionStore.commitRevision({
    projectId: input.projectId,
    documentId: input.documentId,
    baseRevisionId: input.baseRevisionId,
    operationId: input.operationId,
    sceneAssetId: input.sceneAssetId,
    assetIds,
    contributions: [],
    ...(input.scene === undefined ? {} : { scene: input.scene }),
  });
  return { revisionId: committed.revisionId, beforeRevisionId: input.baseRevisionId, assetIds };
};
