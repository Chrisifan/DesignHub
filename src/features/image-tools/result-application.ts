import type { DesignScene } from '../canvas/scene';
import type { RevisionStore } from '../revisions/model';
import type { ToolCandidate } from '../tasks/state';

export type ToolResultStatus = 'completed' | 'cancelled' | 'failed' | 'unknown';

/** A completed provider result that is visible to the user but not yet a revision. */
export type { ToolCandidate } from '../tasks/state';

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
  candidate?: ToolCandidate;
};

export type AppliedToolResult = {
  revisionId: string;
  beforeRevisionId: string | null;
  assetIds: string[];
};

export const applyToolResult = async (input: ApplyToolResultInput): Promise<AppliedToolResult | null> => {
  if (input.status !== 'completed') return null;
  const sceneAssetId = input.candidate?.resultAssetId ?? input.sceneAssetId;
  const scene = input.candidate?.candidateScene ?? input.scene;
  const baseRevisionId = input.candidate?.baseRevisionId ?? input.baseRevisionId;
  if (!input.projectId.trim() || !input.documentId.trim() || !input.operationId.trim() || !sceneAssetId.trim()) {
    throw new Error('TOOL_RESULT_BINDING_REQUIRED');
  }
  const assetIds = [...(input.assetIds ?? [])];
  const committed = await input.revisionStore.commitRevision({
    projectId: input.projectId,
    documentId: input.documentId,
    baseRevisionId,
    operationId: input.operationId,
    sceneAssetId,
    assetIds,
    contributions: [],
    ...(scene === undefined ? {} : { scene }),
  });
  return { revisionId: committed.revisionId, beforeRevisionId: baseRevisionId, assetIds };
};
