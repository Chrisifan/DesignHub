import type { ExportFormat } from './export-policy';
import type { CodecAdapter } from './codec';

export type ExportTarget = {
  exists: (path: string) => Promise<boolean>;
  write: (path: string, bytes: Uint8Array) => Promise<void>;
  rename?: (temporaryPath: string, targetPath: string) => Promise<void>;
  remove?: (path: string) => Promise<void>;
};

export type ExportDocumentInput = {
  revisionId: string;
  format: ExportFormat;
  targetPath: string;
  target: ExportTarget;
  render: () => Promise<Uint8Array>;
  background?: string;
  archiveCopy?: (input: { revisionId: string; path: string; sha256: string }) => Promise<void>;
  codec?: CodecAdapter;
  expectedSize?: { width: number; height: number };
};

export type ExportResult = { revisionId: string; path: string; sha256: string; archived: boolean; archiveError?: string };

const matchesMagic = (format: ExportFormat, bytes: Uint8Array): boolean => {
  if (format === 'png') return bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  if (format === 'jpeg') return bytes[0] === 255 && bytes[1] === 216;
  if (format === 'webp') return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  return new TextDecoder().decode(bytes.slice(0, 4)) === '%PDF';
};

const hash = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
};

export const exportDocument = async (input: ExportDocumentInput): Promise<ExportResult> => {
  if (!input.revisionId.trim() || !input.targetPath.trim()) throw new Error('EXPORT_BINDING_REQUIRED');
  if (await input.target.exists(input.targetPath)) throw new Error('TARGET_EXISTS');
  const rendered = await input.render();
  let bytes = rendered;
  if (input.codec) {
    if (input.format === 'pdf') {
      if (!matchesMagic('pdf', rendered)) bytes = await input.codec.toPdf(rendered);
    } else {
      const metadata = await input.codec.inspect(rendered);
      if (metadata.colorSpace && metadata.colorSpace.toLowerCase() !== 'srgb') throw new Error('INVALID_COLOR_SPACE');
      if (metadata.format !== input.format) bytes = await input.codec.encode(rendered, { format: input.format, ...(input.background ? { background: input.background } : {}) });
    }
  }
  if (!matchesMagic(input.format, bytes)) throw new Error('INVALID_OUTPUT');
  if (input.codec && input.format !== 'pdf') {
    const metadata = await input.codec.inspect(bytes);
    if (metadata.colorSpace && metadata.colorSpace.toLowerCase() !== 'srgb') throw new Error('INVALID_COLOR_SPACE');
    if (metadata.format !== input.format) throw new Error('INVALID_OUTPUT');
    if (input.expectedSize && (metadata.width !== input.expectedSize.width || metadata.height !== input.expectedSize.height)) throw new Error('INVALID_SIZE');
  }
  const sha256 = await hash(bytes);
  if (await input.target.exists(input.targetPath)) throw new Error('TARGET_EXISTS');
  const temporaryPath = `${input.targetPath}.tmp`;
  try {
    await input.target.write(temporaryPath, bytes);
    if (input.target.rename) await input.target.rename(temporaryPath, input.targetPath);
    else await input.target.write(input.targetPath, bytes);
  } catch (error) {
    if (input.target.remove) await input.target.remove(temporaryPath).catch(() => undefined);
    if (!input.target.rename && input.target.remove) await input.target.remove(input.targetPath).catch(() => undefined);
    throw error;
  }
  if (!input.archiveCopy) return { revisionId: input.revisionId, path: input.targetPath, sha256, archived: false };
  try {
    await input.archiveCopy({ revisionId: input.revisionId, path: input.targetPath, sha256 });
    return { revisionId: input.revisionId, path: input.targetPath, sha256, archived: true };
  } catch (error) {
    const archiveError = error instanceof Error && error.message ? error.message : 'ARCHIVE_FAILED';
    return { revisionId: input.revisionId, path: input.targetPath, sha256, archived: false, archiveError };
  }
};
