import type { ExportFormat } from './export-policy';

export type ImageMetadata = {
  format: 'png' | 'jpeg' | 'webp';
  width: number;
  height: number;
  hasAlpha: boolean;
};

export type ImageEncodeOptions = {
  format: Exclude<ExportFormat, 'pdf'>;
  background?: string;
};

export type CodecAdapter = {
  inspect: (bytes: Uint8Array) => Promise<ImageMetadata>;
  encode: (bytes: Uint8Array, options: ImageEncodeOptions) => Promise<Uint8Array>;
  toPdf: (bytes: Uint8Array) => Promise<Uint8Array>;
};
