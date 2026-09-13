export const imageTools = ['remove-background', 'replace-background', 'remove-object', 'inpaint', 'expand', 'smart-crop', 'upscale', 'resize'] as const;
export type ImageTool = (typeof imageTools)[number];
export type ToolCapability = 'image-editing' | 'image-generation' | 'local-transform';
export type ToolField = { key: string; label: string; type: 'number' | 'text' | 'select'; required: boolean; options?: readonly string[] };
export type ToolDefinition = { tool: ImageTool; capability: ToolCapability; requiresConnection: boolean; requiresRegion: boolean; schema: readonly ToolField[] };
export type ToolParams = Record<string, string | number>;

const definitions: Record<ImageTool, ToolDefinition> = {
  'remove-background': { tool: 'remove-background', capability: 'image-editing', requiresConnection: true, requiresRegion: false, schema: [{ key: 'edgeRefinement', label: 'Edge refinement', type: 'number', required: false }] },
  'replace-background': { tool: 'replace-background', capability: 'image-generation', requiresConnection: true, requiresRegion: false, schema: [{ key: 'prompt', label: 'Background prompt', type: 'text', required: true }, { key: 'lighting', label: 'Lighting', type: 'select', required: false, options: ['match-original', 'studio', 'natural'] }] },
  'remove-object': { tool: 'remove-object', capability: 'image-editing', requiresConnection: true, requiresRegion: true, schema: [{ key: 'feather', label: 'Feather', type: 'number', required: false }] },
  inpaint: { tool: 'inpaint', capability: 'image-editing', requiresConnection: true, requiresRegion: true, schema: [{ key: 'prompt', label: 'Inpaint prompt', type: 'text', required: false }, { key: 'strength', label: 'Strength', type: 'number', required: false }] },
  expand: { tool: 'expand', capability: 'image-generation', requiresConnection: true, requiresRegion: false, schema: [{ key: 'top', label: 'Top', type: 'number', required: true }, { key: 'right', label: 'Right', type: 'number', required: true }, { key: 'bottom', label: 'Bottom', type: 'number', required: true }, { key: 'left', label: 'Left', type: 'number', required: true }] },
  'smart-crop': { tool: 'smart-crop', capability: 'image-editing', requiresConnection: true, requiresRegion: false, schema: [{ key: 'width', label: 'Width', type: 'number', required: true }, { key: 'height', label: 'Height', type: 'number', required: true }, { key: 'focus', label: 'Focus', type: 'select', required: false, options: ['subject', 'center', 'face'] }] },
  upscale: { tool: 'upscale', capability: 'image-editing', requiresConnection: true, requiresRegion: false, schema: [{ key: 'scale', label: 'Scale', type: 'number', required: true }, { key: 'preserveDetails', label: 'Detail mode', type: 'select', required: false, options: ['balanced', 'details', 'texture'] }] },
  resize: { tool: 'resize', capability: 'local-transform', requiresConnection: false, requiresRegion: false, schema: [{ key: 'width', label: 'Width', type: 'number', required: true }, { key: 'height', label: 'Height', type: 'number', required: true }, { key: 'format', label: 'Format', type: 'select', required: false, options: ['png', 'jpeg', 'webp'] }] },
};

export const needsRegion = (tool: ImageTool): boolean => definitions[tool].requiresRegion;
export const getToolDefinition = (tool: ImageTool): ToolDefinition => definitions[tool];

export const defaultToolParams = (tool: ImageTool, dimensions: { width: number; height: number }): ToolParams => {
  if (tool === 'remove-background') return { edgeRefinement: 50 };
  if (tool === 'replace-background') return { prompt: '', lighting: 'match-original' };
  if (tool === 'remove-object') return { feather: 10 };
  if (tool === 'inpaint') return { prompt: '', strength: 0.5 };
  if (tool === 'expand') return { top: 0, right: 0, bottom: 0, left: 0 };
  if (tool === 'smart-crop') return { width: dimensions.width, height: dimensions.height, focus: 'subject' };
  if (tool === 'upscale') return { scale: 2, preserveDetails: 'balanced' };
  return { width: dimensions.width, height: dimensions.height, format: 'png' };
};

export type ToolParamsValidation = { ok: true } | { ok: false; reason: 'INVALID_PARAMS' };
const finitePositive = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value > 0;
const finiteNonNegative = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export const validateToolParams = (tool: ImageTool, params: unknown): ToolParamsValidation => {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return { ok: false, reason: 'INVALID_PARAMS' };
  const value = params as Record<string, unknown>;
  const fields = definitions[tool].schema;
  if (Object.keys(value).some((key) => !fields.some((field) => field.key === key))) return { ok: false, reason: 'INVALID_PARAMS' };
  if (fields.some((field) => field.required && !(field.key in value))) return { ok: false, reason: 'INVALID_PARAMS' };
  if (tool === 'replace-background' && (typeof value.prompt !== 'string' || value.prompt.trim() === '')) return { ok: false, reason: 'INVALID_PARAMS' };
  if (fields.some((field) => field.type === 'select' && field.key in value && field.options && !field.options.includes(String(value[field.key])))) return { ok: false, reason: 'INVALID_PARAMS' };
  if (['resize', 'smart-crop'].includes(tool) && (!finitePositive(value.width) || !finitePositive(value.height))) return { ok: false, reason: 'INVALID_PARAMS' };
  if (tool === 'upscale' && (!finitePositive(value.scale) || (value.scale as number) < 1)) return { ok: false, reason: 'INVALID_PARAMS' };
  if (tool === 'expand' && ['top', 'right', 'bottom', 'left'].some((key) => !finitePositive(value[key]) && value[key] !== 0)) return { ok: false, reason: 'INVALID_PARAMS' };
  if ('edgeRefinement' in value && (!finiteNonNegative(value.edgeRefinement) || Number(value.edgeRefinement) > 100)) return { ok: false, reason: 'INVALID_PARAMS' };
  if ('feather' in value && (!finiteNonNegative(value.feather) || Number(value.feather) > 100)) return { ok: false, reason: 'INVALID_PARAMS' };
  if ('strength' in value && (!finiteNonNegative(value.strength) || Number(value.strength) > 1)) return { ok: false, reason: 'INVALID_PARAMS' };
  if ('format' in value && !['png', 'jpeg', 'webp'].includes(String(value.format))) return { ok: false, reason: 'INVALID_PARAMS' };
  return { ok: true };
};
