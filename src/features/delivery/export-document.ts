import type { ExportFormat } from './export-policy';

export type ExportTarget = {
  exists: (path: string) => Promise<boolean>;
  write: (path: string, bytes: Uint8Array) => Promise<void>;
};

export type ExportDocumentInput = {
  revisionId: string;
  format: ExportFormat;
  targetPath: string;
  target: ExportTarget;
  render: () => Promise<Uint8Array>;
  archiveCopy?: (input: { revisionId: string; path: string; sha256: string }) => Promise<void>;
};

export type ExportResult = { revisionId: string; path: string; sha256: string; archived: boolean };

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
  const bytes = await input.render();
  if (!matchesMagic(input.format, bytes)) throw new Error('INVALID_OUTPUT');
  const sha256 = await hash(bytes);
  const temporaryPath = `${input.targetPath}.tmp`;
  await input.target.write(temporaryPath, bytes);
  await input.target.write(input.targetPath, bytes);
  if (input.archiveCopy) await input.archiveCopy({ revisionId: input.revisionId, path: input.targetPath, sha256 });
  return { revisionId: input.revisionId, path: input.targetPath, sha256, archived: Boolean(input.archiveCopy) };
};
