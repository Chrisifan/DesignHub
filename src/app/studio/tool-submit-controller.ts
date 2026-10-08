import type { Region } from '../../features/canvas/selection';
import type { DesignScene } from '../../features/canvas/scene';
import { validateToolParams, type ImageTool, type ToolParams } from '../../features/image-tools/target';
import { findSelectedImageLayer, type CanvasSelection } from './selection-controller';

export type ToolSubmitContext = {
  tool: ImageTool;
  params: ToolParams;
  scene: DesignScene;
  selection: CanvasSelection | null;
  libraryId?: string;
  documentId?: string;
  readOnly?: boolean;
  region?: Region;
};

export type ToolSubmitValidation =
  | { ok: true; targetLayerId?: string; region?: Region }
  | { ok: false; code: 'READ_ONLY' | 'PARAMETERS_INVALID' | 'IMAGE_LAYER_REQUIRED' | 'IMAGE_ASSET_REQUIRED' | 'DOCUMENT_REQUIRED' };

/** Validates tool submission without reaching into IPC or choosing a fallback layer. */
export const validateToolSubmission = (context: ToolSubmitContext): ToolSubmitValidation => {
  if (context.readOnly) return { ok: false, code: 'READ_ONLY' };
  if (!validateToolParams(context.tool, context.params).ok) return { ok: false, code: 'PARAMETERS_INVALID' };
  if (context.libraryId && !context.documentId) return { ok: false, code: 'DOCUMENT_REQUIRED' };
  if (context.tool === 'resize') return { ok: true, ...(context.region ? { region: context.region } : {}) };
  // Unsaved local drafts may not have a persisted document or managed asset
  // yet. Preserve their existing preview workflow while persisted projects
  // always require an explicit image layer below.
  if (!context.libraryId || !context.documentId) return { ok: true, ...(context.region ? { region: context.region } : {}) };
  if (!context.selection || context.selection.type !== 'image') return { ok: false, code: 'IMAGE_LAYER_REQUIRED' };
  const imageLayer = findSelectedImageLayer(context.scene, context.selection);
  if (!imageLayer) return { ok: false, code: 'IMAGE_ASSET_REQUIRED' };
  return { ok: true, targetLayerId: imageLayer.id, ...(context.region ? { region: context.region } : {}) };
};
