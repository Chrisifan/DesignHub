import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import type { CodecAdapter, ImageEncodeOptions, ImageMetadata } from './codec';

const formatFromMetadata = (format: string | undefined): ImageMetadata['format'] => {
  if (format === 'png' || format === 'webp') return format;
  if (format === 'jpeg' || format === 'jpg') return 'jpeg';
  throw new Error('UNSUPPORTED_IMAGE_FORMAT');
};

const createNodeCodec = (): CodecAdapter => {
  const inspect = async (bytes: Uint8Array): Promise<ImageMetadata> => {
    const metadata = await sharp(bytes).metadata();
    if (!metadata.width || !metadata.height || !metadata.format) throw new Error('INVALID_IMAGE');
    return {
      format: formatFromMetadata(metadata.format),
      width: metadata.width,
      height: metadata.height,
      hasAlpha: Boolean(metadata.hasAlpha),
    };
  };

  const encode = async (bytes: Uint8Array, options: ImageEncodeOptions): Promise<Uint8Array> => {
    const sourceMetadata = await inspect(bytes);
    if (options.format === 'jpeg' && sourceMetadata.hasAlpha && !options.background) throw new Error('BACKGROUND_REQUIRED');
    let image = sharp(bytes).ensureAlpha();
    if (options.format === 'jpeg' && options.background) image = image.flatten({ background: options.background });
    const output = options.format === 'png'
      ? image.png()
      : options.format === 'webp'
        ? image.webp()
        : image.jpeg({ quality: 90 });
    return new Uint8Array(await output.toBuffer());
  };

  const toPdf = async (bytes: Uint8Array): Promise<Uint8Array> => {
    const metadata = await inspect(bytes);
    const document = await PDFDocument.create();
    const page = document.addPage([metadata.width, metadata.height]);
    const imageBytes = metadata.format === 'webp'
      ? new Uint8Array(await sharp(Buffer.from(bytes)).flatten({ background: '#ffffff' }).jpeg().toBuffer())
      : bytes;
    const image = metadata.format === 'png'
      ? await document.embedPng(bytes)
      : metadata.format === 'jpeg'
        ? await document.embedJpg(bytes)
        : await document.embedJpg(imageBytes);
    page.drawImage(image, { x: 0, y: 0, width: metadata.width, height: metadata.height });
    return new Uint8Array(await document.save());
  };

  return { inspect, encode, toPdf };
};

export { createNodeCodec };
export const createSharpCodec = createNodeCodec;
