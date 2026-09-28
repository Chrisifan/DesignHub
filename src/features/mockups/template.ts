export type MockupTemplateCategory = 'phone-screen' | 'poster-frame' | 'packaging-bag';

export type MockupTemplateManifest = {
  id: string;
  category: MockupTemplateCategory;
  version: string;
  source: string;
  license: string;
  previewAsset: string;
  input: { minWidth: number; minHeight: number; requiresTransparency: boolean };
  placement: { x: number; y: number; width: number; height: number; perspective: number[]; crop: 'contain' | 'cover' };
  occlusion: 'none' | 'top-layer' | 'foreground';
  output: { width: number; height: number; supportsTransparency: boolean };
  colors: readonly string[];
};

export const builtInMockupTemplates: readonly MockupTemplateManifest[] = [
  {
    id: 'builtin-phone-screen', category: 'phone-screen', version: '1.0.0', source: 'DesignHub built-in', license: 'DesignHub built-in assets', previewAsset: 'mockup-phone-screen-preview',
    input: { minWidth: 640, minHeight: 640, requiresTransparency: false },
    placement: { x: 0.18, y: 0.12, width: 0.64, height: 0.76, perspective: [0, 0, 0, 0], crop: 'cover' }, occlusion: 'top-layer',
    output: { width: 1600, height: 2000, supportsTransparency: false }, colors: ['black', 'white', 'graphite'],
  },
  {
    id: 'builtin-poster-frame', category: 'poster-frame', version: '1.0.0', source: 'DesignHub built-in', license: 'DesignHub built-in assets', previewAsset: 'mockup-poster-frame-preview',
    input: { minWidth: 800, minHeight: 1000, requiresTransparency: false },
    placement: { x: 0.24, y: 0.18, width: 0.52, height: 0.64, perspective: [0, 0, 0, 0], crop: 'contain' }, occlusion: 'foreground',
    output: { width: 1800, height: 1800, supportsTransparency: false }, colors: ['oak', 'black', 'white'],
  },
  {
    id: 'builtin-packaging-bag', category: 'packaging-bag', version: '1.0.0', source: 'DesignHub built-in', license: 'DesignHub built-in assets', previewAsset: 'mockup-packaging-bag-preview',
    input: { minWidth: 800, minHeight: 800, requiresTransparency: false },
    placement: { x: 0.2, y: 0.2, width: 0.6, height: 0.58, perspective: [0, 0, 0, 0], crop: 'contain' }, occlusion: 'top-layer',
    output: { width: 1800, height: 1800, supportsTransparency: true }, colors: ['kraft', 'white', 'black'],
  },
];

export type MockupRenderInput = { templateId: string; sourceWidth: number; sourceHeight: number; color: string };
export type MockupRenderValidation = { ok: true; template: MockupTemplateManifest } | { ok: false; reason: 'TEMPLATE_NOT_FOUND' | 'SOURCE_TOO_SMALL' | 'COLOR_UNSUPPORTED' };

export const validateMockupRenderInput = (input: MockupRenderInput): MockupRenderValidation => {
  const template = builtInMockupTemplates.find((item) => item.id === input.templateId);
  if (!template) return { ok: false, reason: 'TEMPLATE_NOT_FOUND' };
  if (!Number.isFinite(input.sourceWidth) || !Number.isFinite(input.sourceHeight)
    || input.sourceWidth < template.input.minWidth || input.sourceHeight < template.input.minHeight) return { ok: false, reason: 'SOURCE_TOO_SMALL' };
  if (!template.colors.includes(input.color)) return { ok: false, reason: 'COLOR_UNSUPPORTED' };
  return { ok: true, template };
};

export type MockupPlacementPixels = { left: number; top: number; width: number; height: number };

export const resolveMockupPlacement = (template: MockupTemplateManifest): MockupPlacementPixels => {
  const { width: outputWidth, height: outputHeight } = template.output;
  const { x, y, width, height } = template.placement;
  const placement = {
    left: Math.round(x * outputWidth),
    top: Math.round(y * outputHeight),
    width: Math.round(width * outputWidth),
    height: Math.round(height * outputHeight),
  };
  if (placement.left < 0 || placement.top < 0
    || placement.width <= 0 || placement.height <= 0
    || placement.left + placement.width > outputWidth
    || placement.top + placement.height > outputHeight) throw new Error('MOCKUP_PLACEMENT_OUT_OF_BOUNDS');
  return placement;
};
