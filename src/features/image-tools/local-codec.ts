import sharp from 'sharp';
import type { ToolParams } from './target';

export type BatchTransformParams = ToolParams & {
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg' | 'webp';
  fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside';
  background?: string;
};

const positiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

export const transformImageBytes = async (bytes: Uint8Array, tool: 'resize' | 'format-convert', params: BatchTransformParams): Promise<Uint8Array> => {
  const image = sharp(Buffer.from(bytes), { animated: false });
  const metadata = await image.metadata();
  const format = params.format;
  if (!format || !['png', 'jpeg', 'webp'].includes(format)) throw new Error('OUTPUT_FORMAT_REQUIRED');
  let pipeline = image;
  if (tool === 'resize') {
    if (!positiveInteger(params.width) || !positiveInteger(params.height)) throw new Error('INVALID_SIZE');
    pipeline = pipeline.resize({ width: params.width, height: params.height, fit: params.fit ?? 'contain', background: params.background });
  }
  if (format === 'jpeg' && metadata.hasAlpha && !params.background) throw new Error('JPEG_BACKGROUND_REQUIRED');
  if (format === 'png') pipeline = pipeline.png();
  else if (format === 'webp') pipeline = pipeline.webp();
  else pipeline = pipeline.flatten({ background: params.background ?? '#ffffff' }).jpeg();
  return new Uint8Array(await pipeline.toBuffer());
};
