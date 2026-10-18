import sharp from 'sharp';

export type ExpandMode = 'original-scene' | 'atmospheric';
export type ExpandImageParams = {
  mode?: string | number;
  top?: string | number;
  right?: string | number;
  bottom?: string | number;
  left?: string | number;
};

type NormalizedExpandParams = {
  mode: ExpandMode;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const edge = (value: string | number | undefined): number => {
  const parsed = Number(value ?? 0);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error('INVALID_EXPAND_MARGIN');
  return parsed;
};

const normalizeParams = (params: ExpandImageParams): NormalizedExpandParams => {
  const modeValue = params.mode ?? 'original-scene';
  if (modeValue !== 'original-scene' && modeValue !== 'atmospheric') throw new Error('INVALID_EXPAND_MODE');
  const mode: ExpandMode = modeValue;
  const normalized = {
    mode,
    top: edge(params.top),
    right: edge(params.right),
    bottom: edge(params.bottom),
    left: edge(params.left),
  };
  if (normalized.top + normalized.right + normalized.bottom + normalized.left === 0) throw new Error('INVALID_EXPAND_MARGIN');
  return normalized;
};

export const buildExpandPrompt = (mode: ExpandMode): string => {
  const common = [
    'Outpaint only into the transparent area outside the original image bounds.',
    'Do not redraw or alter any pixel inside the original image bounds.',
    'Preserve every person, face, body, hand, product, object, word, logo, color, proportion, and composition in the original image.',
    'Continue edges seamlessly with consistent perspective, lighting, texture, focus, and image quality.',
  ];
  const modeRule = mode === 'original-scene'
    ? 'Continue the existing scene conservatively. Do not add new subjects, text, logos, products, or prominent objects.'
    : 'Add subtle atmospheric details only in the new outer area when they support the existing scene; do not let them enter or cover the original image bounds.';
  return [...common, modeRule].join('\n');
};

const sourceSize = async (bytes: Uint8Array): Promise<{ width: number; height: number }> => {
  const metadata = await sharp(Buffer.from(bytes), { animated: false }).metadata();
  if (!metadata.width || !metadata.height) throw new Error('INVALID_SOURCE_IMAGE');
  return { width: metadata.width, height: metadata.height };
};

export const prepareExpandedImage = async (sourceBytes: Uint8Array, params: ExpandImageParams): Promise<{
  imageBytes: Uint8Array;
  maskBytes: Uint8Array;
  width: number;
  height: number;
  size: string;
  prompt: string;
}> => {
  const normalized = normalizeParams(params);
  const source = await sourceSize(sourceBytes);
  const width = source.width + normalized.left + normalized.right;
  const height = source.height + normalized.top + normalized.bottom;
  const imageBytes = new Uint8Array(await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: Buffer.from(sourceBytes), left: normalized.left, top: normalized.top }]).png().toBuffer());
  const maskBytes = new Uint8Array(await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{
    input: {
      create: { width: source.width, height: source.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    },
    left: normalized.left,
    top: normalized.top,
  }]).png().toBuffer());
  return {
    imageBytes,
    maskBytes,
    width,
    height,
    size: `${width}x${height}`,
    prompt: buildExpandPrompt(normalized.mode),
  };
};

export const normalizeExpandedImageResult = async (
  resultBytes: Uint8Array,
  width: number,
  height: number,
): Promise<Uint8Array> => {
  const metadata = await sharp(Buffer.from(resultBytes), { animated: false }).metadata();
  if (!metadata.width || !metadata.height) throw new Error('INVALID_PROVIDER_IMAGE');
  if (metadata.width === width && metadata.height === height) return resultBytes;

  return new Uint8Array(await sharp(Buffer.from(resultBytes), { animated: false })
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer());
};

