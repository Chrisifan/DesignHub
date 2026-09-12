export type DocumentSize = { width: number; height: number };

export const documentSizePresets: readonly string[] = ['1080 × 1440', '1080 × 1080', '1920 × 1080'];

export const parseDocumentSize = (value: string): DocumentSize => {
  const match = /^([1-9][0-9]{0,4})\s*×\s*([1-9][0-9]{0,4})$/u.exec(value.trim());
  if (!match) throw new Error('INVALID_SIZE');
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width > 20_000 || height > 20_000) throw new Error('INVALID_SIZE');
  return { width, height };
};
