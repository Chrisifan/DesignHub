import sharp from 'sharp';

const maximumProviderImageBytes = 2 * 1024 * 1024;
const maximumProviderImageEdge = 2048;

export type ProviderImageInput = {
  bytes: Uint8Array;
  mimeType: string;
};

const normalizedMimeType = (value: string): string => value.toLowerCase().split(';', 1)[0]?.trim() || 'image/png';

export const normalizeProviderImage = async (input: ProviderImageInput): Promise<ProviderImageInput> => {
  try {
    const mimeType = normalizedMimeType(input.mimeType);
    const image = sharp(Buffer.from(input.bytes), { animated: false });
    const metadata = await image.metadata();
    const longestEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);
    if (longestEdge > 0 && longestEdge <= maximumProviderImageEdge && input.bytes.byteLength <= maximumProviderImageBytes) {
      return { bytes: input.bytes, mimeType };
    }

    const pipeline = image
      .rotate()
      .resize({ width: maximumProviderImageEdge, height: maximumProviderImageEdge, fit: 'inside', withoutEnlargement: true });
    if (mimeType === 'image/jpeg') {
      return {
        bytes: new Uint8Array(await pipeline.jpeg({ quality: 84, chromaSubsampling: '4:2:0', mozjpeg: true }).toBuffer()),
        mimeType,
      };
    }
    if (mimeType === 'image/webp') {
      return {
        bytes: new Uint8Array(await pipeline.webp({ quality: 84, alphaQuality: 90, effort: 5 }).toBuffer()),
        mimeType,
      };
    }
    return {
      bytes: new Uint8Array(await pipeline.png({ compressionLevel: 9, effort: 7 }).toBuffer()),
      mimeType: 'image/png',
    };
  } catch {
    throw new Error('PROVIDER_IMAGE_NORMALIZATION_FAILED');
  }
};
