import { isRegionInside, type Region } from '../canvas/selection';
import { getToolDefinition, needsRegion, type ImageTool, type ToolCapability, validateToolParams } from './target';

export type ToolExecutionInput = { documentId: string; baseRevisionId: string | null; targetLayerId: string; tool: ImageTool; params: unknown; region?: Region; connectionId?: string };
export type ToolLayer = { id: string; width: number; height: number };
export type ToolExecutionResult = { revisionId?: string; [key: string]: unknown };
export type ToolExecutionDeps = { getLayer: (documentId: string, layerId: string) => ToolLayer | undefined; capabilities?: readonly ToolCapability[]; applyLocal?: (input: ToolExecutionInput, layer: ToolLayer) => Promise<ToolExecutionResult> | ToolExecutionResult; executeModel?: (input: ToolExecutionInput, layer: ToolLayer) => Promise<ToolExecutionResult> | ToolExecutionResult; };

export const executeTool = async (input: ToolExecutionInput, deps: ToolExecutionDeps): Promise<ToolExecutionResult> => {
  if (!input.documentId || !input.targetLayerId) throw new Error('TARGET_REQUIRED');
  const validation = validateToolParams(input.tool, input.params);
  if (!validation.ok) throw new Error(validation.reason);
  const layer = deps.getLayer(input.documentId, input.targetLayerId);
  if (!layer) throw new Error('TARGET_NOT_FOUND');
  if (needsRegion(input.tool as 'remove-object' | 'inpaint' | 'remove-background' | 'resize') && (!input.region || !isRegionInside(input.region, layer))) throw new Error(input.region ? 'REGION_OUT_OF_BOUNDS' : 'REGION_REQUIRED');
  const definition = getToolDefinition(input.tool);
  if (deps.capabilities && !deps.capabilities.includes(definition.capability)) throw new Error('CAPABILITY_UNAVAILABLE');
  if (!definition.requiresConnection) {
    if (!deps.applyLocal) throw new Error('LOCAL_ADAPTER_UNAVAILABLE');
    return deps.applyLocal(input, layer);
  }
  if (!input.connectionId || input.connectionId.trim() === '') throw new Error('CONNECTION_REQUIRED');
  if (!deps.executeModel) throw new Error('MODEL_ADAPTER_UNAVAILABLE');
  return deps.executeModel(input, layer);
};
