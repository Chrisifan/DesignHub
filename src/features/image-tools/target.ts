export const imageTools = ['remove-background', 'replace-background', 'remove-object', 'inpaint', 'expand', 'smart-crop', 'upscale', 'resize', 'remove-watermark'] as const;
export type ImageTool = (typeof imageTools)[number];
export type ToolCapability = 'image-editing' | 'image-generation' | 'local-transform';
export type ToolField = { key: string; label: string; type: 'number' | 'text' | 'select'; required: boolean; options?: readonly string[] };
export type ToolDefinition = { tool: ImageTool; capability: ToolCapability; requiresConnection: boolean; requiresRegion: boolean; requiresMask: boolean; requiresTransparency: boolean; schema: readonly ToolField[] };
export type ToolParams = Record<string, string | number>;

const definitions: Record<ImageTool, ToolDefinition> = {
  'remove-background': { tool: 'remove-background', capability: 'image-editing', requiresConnection: true, requiresRegion: false, requiresMask: false, requiresTransparency: true, schema: [{ key: 'edgeRefinement', label: 'Edge refinement', type: 'number', required: false }] },
  'replace-background': { tool: 'replace-background', capability: 'image-generation', requiresConnection: true, requiresRegion: false, requiresMask: false, requiresTransparency: false, schema: [{ key: 'source', label: 'Background source', type: 'select', required: true, options: ['description', 'asset', 'solid-color'] }, { key: 'prompt', label: 'Background prompt', type: 'text', required: false }, { key: 'backgroundAssetId', label: 'Background asset', type: 'text', required: false }, { key: 'backgroundColor', label: 'Background color', type: 'text', required: false }, { key: 'lighting', label: 'Lighting', type: 'select', required: false, options: ['match-original', 'studio', 'natural'] }] },
  'remove-object': { tool: 'remove-object', capability: 'image-editing', requiresConnection: true, requiresRegion: true, requiresMask: true, requiresTransparency: false, schema: [{ key: 'feather', label: 'Feather', type: 'number', required: false }] },
  inpaint: { tool: 'inpaint', capability: 'image-editing', requiresConnection: true, requiresRegion: true, requiresMask: true, requiresTransparency: false, schema: [{ key: 'prompt', label: 'Inpaint prompt', type: 'text', required: false }, { key: 'strength', label: 'Strength', type: 'number', required: false }] },
  expand: { tool: 'expand', capability: 'image-generation', requiresConnection: true, requiresRegion: false, requiresMask: false, requiresTransparency: false, schema: [{ key: 'mode', label: 'Expansion mode', type: 'select', required: false, options: ['original-scene', 'atmospheric'] }, { key: 'top', label: 'Top', type: 'number', required: true }, { key: 'right', label: 'Right', type: 'number', required: true }, { key: 'bottom', label: 'Bottom', type: 'number', required: true }, { key: 'left', label: 'Left', type: 'number', required: true }] },
  'smart-crop': { tool: 'smart-crop', capability: 'image-editing', requiresConnection: true, requiresRegion: false, requiresMask: false, requiresTransparency: false, schema: [{ key: 'width', label: 'Width', type: 'number', required: true }, { key: 'height', label: 'Height', type: 'number', required: true }, { key: 'safeArea', label: 'Safe area', type: 'number', required: false }, { key: 'focus', label: 'Focus', type: 'select', required: false, options: ['subject', 'center', 'face', 'manual'] }] },
  upscale: { tool: 'upscale', capability: 'image-editing', requiresConnection: true, requiresRegion: false, requiresMask: false, requiresTransparency: false, schema: [{ key: 'scale', label: 'Scale', type: 'number', required: true }, { key: 'preserveDetails', label: 'Detail mode', type: 'select', required: false, options: ['balanced', 'details', 'texture'] }] },
  resize: { tool: 'resize', capability: 'local-transform', requiresConnection: false, requiresRegion: false, requiresMask: false, requiresTransparency: false, schema: [{ key: 'width', label: 'Width', type: 'number', required: true }, { key: 'height', label: 'Height', type: 'number', required: true }, { key: 'fit', label: 'Fit', type: 'select', required: false, options: ['contain', 'cover', 'stretch'] }, { key: 'format', label: 'Format', type: 'select', required: false, options: ['png', 'jpeg', 'webp'] }, { key: 'background', label: 'Background', type: 'text', required: false }] },
  'remove-watermark': { tool: 'remove-watermark', capability: 'image-editing', requiresConnection: true, requiresRegion: true, requiresMask: true, requiresTransparency: false, schema: [{ key: 'rightsConfirmed', label: 'Rights confirmation', type: 'select', required: true, options: ['confirmed'] }, { key: 'feather', label: 'Feather', type: 'number', required: false }] },
};

export const needsRegion = (tool: ImageTool): boolean => definitions[tool].requiresRegion;
export const getToolDefinition = (tool: ImageTool): ToolDefinition => definitions[tool];

export const defaultToolParams = (tool: ImageTool, dimensions: { width: number; height: number }): ToolParams => {
  if (tool === 'remove-background') return { edgeRefinement: 50 };
  if (tool === 'replace-background') return { source: 'description', prompt: '', lighting: 'match-original' };
  if (tool === 'remove-object') return { feather: 10 };
  if (tool === 'inpaint') return { prompt: '', strength: 0.5 };
  if (tool === 'expand') return { mode: 'original-scene', top: 0, right: 0, bottom: 0, left: 0 };
  if (tool === 'smart-crop') return { width: dimensions.width, height: dimensions.height, focus: 'subject' };
  if (tool === 'upscale') return { scale: 2, preserveDetails: 'balanced' };
  if (tool === 'remove-watermark') return { rightsConfirmed: 'confirmed', feather: 10 };
  return { width: dimensions.width, height: dimensions.height, fit: 'contain', format: 'png' };
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
  if (tool === 'replace-background') {
    if (!['description', 'asset', 'solid-color'].includes(String(value.source))) return { ok: false, reason: 'INVALID_PARAMS' };
    if (value.source === 'description' && (typeof value.prompt !== 'string' || value.prompt.trim() === '')) return { ok: false, reason: 'INVALID_PARAMS' };
    if (value.source === 'asset' && (typeof value.backgroundAssetId !== 'string' || value.backgroundAssetId.trim() === '')) return { ok: false, reason: 'INVALID_PARAMS' };
    if (value.source === 'solid-color' && (typeof value.backgroundColor !== 'string' || !/^#[0-9a-f]{6}$/iu.test(value.backgroundColor))) return { ok: false, reason: 'INVALID_PARAMS' };
  }
  if (tool === 'expand' && value.mode !== undefined && !['original-scene', 'atmospheric'].includes(String(value.mode))) return { ok: false, reason: 'INVALID_PARAMS' };
  if (fields.some((field) => field.type === 'select' && field.key in value && field.options && !field.options.includes(String(value[field.key])))) return { ok: false, reason: 'INVALID_PARAMS' };
  if (['resize', 'smart-crop'].includes(tool) && (!finitePositive(value.width) || !finitePositive(value.height))) return { ok: false, reason: 'INVALID_PARAMS' };
  if ('safeArea' in value && (!finiteNonNegative(value.safeArea) || Number(value.safeArea) > 100)) return { ok: false, reason: 'INVALID_PARAMS' };
  if (tool === 'upscale' && (!finitePositive(value.scale) || (value.scale as number) < 1)) return { ok: false, reason: 'INVALID_PARAMS' };
  if (tool === 'expand' && ['top', 'right', 'bottom', 'left'].some((key) => !finitePositive(value[key]) && value[key] !== 0)) return { ok: false, reason: 'INVALID_PARAMS' };
  if ('edgeRefinement' in value && (!finiteNonNegative(value.edgeRefinement) || Number(value.edgeRefinement) > 100)) return { ok: false, reason: 'INVALID_PARAMS' };
  if ('feather' in value && (!finiteNonNegative(value.feather) || Number(value.feather) > 100)) return { ok: false, reason: 'INVALID_PARAMS' };
  if ('strength' in value && (!finiteNonNegative(value.strength) || Number(value.strength) > 1)) return { ok: false, reason: 'INVALID_PARAMS' };
  if ('format' in value && !['png', 'jpeg', 'webp'].includes(String(value.format))) return { ok: false, reason: 'INVALID_PARAMS' };
  return { ok: true };
};
