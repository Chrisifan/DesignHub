import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { validateRelativePath } from './jobs';

export type PublishedImage = { path: string; bytes: number; width: number; height: number; format?: string; hasAlpha: boolean };

const randomSuffix = (): string => `${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}`;

export const inspectImageBytes = async (bytes: Uint8Array): Promise<Omit<PublishedImage, 'path' | 'bytes'>> => {
  try {
    const metadata = await sharp(Buffer.from(bytes), { animated: false }).metadata();
    if (!metadata.width || !metadata.height || !metadata.format) throw new Error('IMAGE_RESULT_INVALID');
    return { width: metadata.width, height: metadata.height, format: metadata.format, hasAlpha: metadata.hasAlpha === true || metadata.channels === 4 };
  } catch {
    throw new Error('IMAGE_RESULT_INVALID');
  }
};

export type PublishImageInput = {
  outputRoot: string;
  relativePath: string;
  bytes: Uint8Array;
  /** Existing files are never replaced unless the caller explicitly opts in. */
  overwrite?: boolean;
};

/** Validates an image and publishes it with a same-directory atomic rename. */
export const publishImageResult = async (input: PublishImageInput): Promise<PublishedImage> => {
  if (!input.outputRoot || !validateRelativePath(input.relativePath)) throw new Error('IMAGE_TOOL_OUTPUT_PATH_INVALID');
  const metadata = await inspectImageBytes(input.bytes);
  const outputPath = join(input.outputRoot, input.relativePath);
  const temporaryPath = `${outputPath}.${randomSuffix()}.tmp`;
  let reserved = false;
  let published = false;
  await mkdir(dirname(outputPath), { recursive: true });
  if (!input.overwrite) {
    try {
      await writeFile(outputPath, '', { flag: 'wx' });
      // Reserve the path, then replace the reservation with the validated bytes.
      reserved = true;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'EEXIST') throw new Error('OUTPUT_EXISTS');
      throw error;
    }
  }
  try {
    await writeFile(temporaryPath, Buffer.from(input.bytes), { flag: 'wx' });
    await rename(temporaryPath, outputPath);
    published = true;
  } catch (error) {
    // Best-effort cleanup is intentionally local to the temporary output.
    try {
      const { unlink } = await import('node:fs/promises');
      await unlink(temporaryPath);
    } catch {
      // Ignore cleanup failures; the caller still receives the original error.
    }
    if (reserved && !published) {
      try {
        const { unlink } = await import('node:fs/promises');
        await unlink(outputPath);
      } catch {
        // Ignore cleanup failures; a later scan will report the collision.
      }
    }
    throw error;
  }
  return { path: outputPath, bytes: input.bytes.byteLength, ...metadata };
};

export const publishAtomicResult = publishImageResult;
