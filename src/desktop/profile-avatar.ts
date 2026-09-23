import sharp from 'sharp';
import type { ProfileAvatarInput } from '../platform/contracts';

export type { ProfileAvatarInput } from '../platform/contracts';

const maxInputBytes = 10 * 1024 * 1024;
const maxOutputBytes = 512 * 1024;
const acceptedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export const normalizeProfileAvatar = async (input: ProfileAvatarInput): Promise<string> => {
  if (!acceptedMimeTypes.has(input.mimeType) || input.bytes.byteLength === 0 || input.bytes.byteLength > maxInputBytes) {
    throw new Error('INVALID_PROFILE_AVATAR');
  }
  try {
    const bytes = await sharp(Buffer.from(input.bytes), { animated: false })
      .rotate()
      .resize({ width: 512, height: 512, fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > maxOutputBytes) throw new Error('INVALID_PROFILE_AVATAR');
    return `data:image/webp;base64,${bytes.toString('base64')}`;
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PROFILE_AVATAR') throw error;
    throw new Error('INVALID_PROFILE_AVATAR');
  }
};
