import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

import { Unzip, UnzipInflate } from 'fflate';

import type { PortfolioImageSource } from '../features/agent/analyze-portfolio';
import type { PortfolioInspection, PortfolioInspectionCandidate, PortfolioUploadFile } from '../platform/contracts';

const maxPortfolioSources = 8;
const maxArchiveEntries = 128;
const maxArchiveBytes = 24 * 1024 * 1024;
const maxImageBytes = 8 * 1024 * 1024;
const supportedImageTypes = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
  ['gif', 'image/gif'],
]);

export type { PortfolioInspection, PortfolioInspectionCandidate } from '../platform/contracts';

type LoadedInspectionSource = PortfolioInspectionCandidate & { image: PortfolioImageSource['image'] };
type InspectionSource = LoadedInspectionSource;

export type PortfolioSourceInspectorOptions = {
  readFile?: (path: string) => Promise<Uint8Array>;
  normalizeImage?: (input: { bytes: Uint8Array; mimeType: string }) => Promise<{ bytes: Uint8Array; mimeType: string }>;
};

export type PortfolioSourceInspector = {
  inspectLocalFiles: (paths: readonly string[]) => Promise<PortfolioInspection>;
  inspectUploadedFiles: (files: readonly PortfolioUploadFile[]) => Promise<PortfolioInspection>;
  selectedSources: (inspectionId: string, sourceIds: readonly string[]) => Promise<PortfolioImageSource[]>;
  discard: (inspectionId: string) => void;
  discardAll: () => void;
};

const imageTypeForName = (name: string): string | null => {
  const extension = name.split('.').at(-1)?.toLowerCase();
  return extension ? supportedImageTypes.get(extension) ?? null : null;
};

const fileName = (path: string): string => path.split(/[\\/]/u).at(-1) || 'Portfolio image';
const isZipName = (name: string): boolean => name.toLowerCase().endsWith('.zip');
const assertBatchShape = (names: readonly string[]): 'images' | 'zip' => {
  if (names.length === 0) throw new Error('PORTFOLIO_SOURCE_REQUIRED');
  const zipCount = names.filter(isZipName).length;
  if (zipCount > 1) throw new Error('PORTFOLIO_ARCHIVE_MULTIPLE');
  if (zipCount === 1 && names.length !== 1) throw new Error('PORTFOLIO_SOURCE_MIXED');
  if (zipCount === 0 && names.length > maxPortfolioSources) throw new Error('PORTFOLIO_SOURCE_LIMIT');
  return zipCount === 1 ? 'zip' : 'images';
};

const hasImageSignature = (bytes: Uint8Array, mimeType: string): boolean => {
  if (mimeType === 'image/png') return bytes.length >= 8 && bytes.slice(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mimeType === 'image/gif') return bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(new TextDecoder().decode(bytes.slice(0, 6)));
  return mimeType === 'image/webp' && bytes.length >= 12
    && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF'
    && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
};

const assertImageBytes = (bytes: Uint8Array, mimeType: string): void => {
  if (!hasImageSignature(bytes, mimeType)) throw new Error('PORTFOLIO_IMAGE_BYTES_INVALID');
};

const dataUrl = (bytes: Uint8Array, mimeType: string): string => `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;

const normalizePortfolioImage = async (input: { bytes: Uint8Array; mimeType: string }): Promise<{ bytes: Uint8Array; mimeType: string }> => {
  try {
    const bytes = new Uint8Array(await sharp(Buffer.from(input.bytes), { animated: false })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 85, chromaSubsampling: '4:2:0' })
      .toBuffer());
    return { bytes, mimeType: 'image/jpeg' };
  } catch {
    throw new Error('PORTFOLIO_IMAGE_NORMALIZATION_FAILED');
  }
};

const sourceFromBytes = (input: {
  label: string;
  description?: string;
  origin: PortfolioInspectionCandidate['origin'];
  bytes: Uint8Array;
  mimeType: string;
}): LoadedInspectionSource => {
  assertImageBytes(input.bytes, input.mimeType);
  return {
    id: `portfolio-source-${randomUUID()}`,
    label: input.label,
    description: input.description?.trim() || input.label,
    origin: input.origin,
    previewUrl: dataUrl(input.bytes, input.mimeType),
    image: { base64: Buffer.from(input.bytes).toString('base64'), mimeType: input.mimeType },
  };
};

const assertArchivePath = (name: string): string => {
  const normalized = name.replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || /^[a-z]:/iu.test(normalized)
    || normalized.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('PORTFOLIO_ARCHIVE_PATH_INVALID');
  return normalized;
};

export const createPortfolioSourceInspector = (options: PortfolioSourceInspectorOptions = {}): PortfolioSourceInspector => {
  const sessions = new Map<string, InspectionSource[]>();
  const read = options.readFile ?? (async (path: string) => new Uint8Array(await readFile(path)));
  const normalizeImage = options.normalizeImage ?? normalizePortfolioImage;
  const visionImage = async (bytes: Uint8Array, mimeType: string): Promise<PortfolioImageSource['image']> => {
    const normalized = await normalizeImage({ bytes, mimeType });
    assertImageBytes(normalized.bytes, normalized.mimeType);
    return { base64: Buffer.from(normalized.bytes).toString('base64'), mimeType: normalized.mimeType };
  };
  const saveInspection = (sources: InspectionSource[]): PortfolioInspection => {
    if (sources.length === 0) throw new Error('PORTFOLIO_SOURCE_REQUIRED');
    if (sources.length > maxPortfolioSources) throw new Error('PORTFOLIO_SOURCE_LIMIT');
    const id = `portfolio-inspection-${randomUUID()}`;
    sessions.set(id, sources);
    return {
      id,
      candidates: sources.map(({ id: sourceId, label, description, origin, previewUrl }) => ({
        id: sourceId, label, description, origin, previewUrl,
      })),
    };
  };
  const inspectImages = async (files: readonly { name: string; bytes: Uint8Array; declaredMimeType?: string }[]): Promise<PortfolioInspection> => {
    if (files.length === 0) throw new Error('PORTFOLIO_SOURCE_REQUIRED');
    if (files.length > maxPortfolioSources) throw new Error('PORTFOLIO_SOURCE_LIMIT');
    const sources = files.map(({ name, bytes, declaredMimeType }) => {
      const mimeType = imageTypeForName(name);
      if (!mimeType) throw new Error('PORTFOLIO_IMAGE_TYPE_INVALID');
      if (declaredMimeType && declaredMimeType !== mimeType) throw new Error('PORTFOLIO_IMAGE_TYPE_INVALID');
      if (bytes.byteLength > maxImageBytes) throw new Error('PORTFOLIO_SOURCE_TOO_LARGE');
      return sourceFromBytes({ label: name, origin: 'local-image', bytes, mimeType });
    });
    return saveInspection(sources);
  };
  const inspectArchive = (archive: Uint8Array): PortfolioInspection => {
    if (archive.byteLength > maxArchiveBytes) throw new Error('PORTFOLIO_ARCHIVE_TOO_LARGE');
    const sources: InspectionSource[] = [];
    const names = new Set<string>();
    let failure: Error | null = null;
    let entryCount = 0;
    const unzip = new Unzip((entry) => {
      entryCount += 1;
      if (failure || entryCount > maxArchiveEntries) { failure = new Error('PORTFOLIO_ARCHIVE_LIMIT'); return; }
      let name: string;
      try { name = assertArchivePath(entry.name); } catch (error) { failure = error as Error; return; }
      if (names.has(name)) { failure = new Error('PORTFOLIO_ARCHIVE_PATH_INVALID'); return; }
      names.add(name);
      const mimeType = imageTypeForName(name);
      if (!mimeType) return;
      if (sources.length >= maxPortfolioSources || (entry.originalSize !== undefined && entry.originalSize > maxImageBytes)) { failure = new Error('PORTFOLIO_SOURCE_LIMIT'); return; }
      const chunks: Uint8Array[] = [];
      let size = 0;
      entry.ondata = (error, chunk, final) => {
        if (error || failure) { failure ??= new Error('PORTFOLIO_ARCHIVE_INVALID'); return; }
        size += chunk.byteLength;
        if (size > maxImageBytes) { failure = new Error('PORTFOLIO_SOURCE_TOO_LARGE'); entry.terminate(); return; }
        chunks.push(chunk);
        if (!final) return;
        const bytes = new Uint8Array(size);
        let offset = 0;
        chunks.forEach((part) => { bytes.set(part, offset); offset += part.byteLength; });
        sources.push(sourceFromBytes({ label: name, origin: 'zip-image', bytes, mimeType }));
      };
      entry.start();
    });
    unzip.register(UnzipInflate);
    try { unzip.push(archive, true); } catch { throw failure ?? new Error('PORTFOLIO_ARCHIVE_INVALID'); }
    if (failure) throw failure;
    return saveInspection(sources);
  };
  const inspectLocalFiles = async (paths: readonly string[]): Promise<PortfolioInspection> => {
    const kind = assertBatchShape(paths);
    if (kind === 'zip') return inspectArchive(await read(paths[0] as string));
    return inspectImages(await Promise.all(paths.map(async (path) => ({ name: fileName(path), bytes: await read(path) }))));
  };
  const inspectUploadedFiles = async (files: readonly PortfolioUploadFile[]): Promise<PortfolioInspection> => {
    const kind = assertBatchShape(files.map(({ name }) => name));
    if (kind === 'zip') {
      const [archive] = files;
      if (!archive || (archive.mimeType && !['application/zip', 'application/x-zip-compressed'].includes(archive.mimeType))) {
        throw new Error('PORTFOLIO_ARCHIVE_TYPE_INVALID');
      }
      return inspectArchive(archive.bytes);
    }
    return inspectImages(files.map(({ name, mimeType, bytes }) => ({ name, declaredMimeType: mimeType, bytes })));
  };
  const selectedSources = async (inspectionId: string, sourceIds: readonly string[]): Promise<PortfolioImageSource[]> => {
    const sources = sessions.get(inspectionId);
    if (!sources) throw new Error('PORTFOLIO_INSPECTION_NOT_FOUND');
    if (sourceIds.length === 0) throw new Error('PORTFOLIO_SOURCE_REQUIRED');
    if (sourceIds.length > maxPortfolioSources || new Set(sourceIds).size !== sourceIds.length) throw new Error('PORTFOLIO_SOURCE_LIMIT');
    const selected = sourceIds.map((id) => sources.find((source) => source.id === id)).filter((source): source is InspectionSource => Boolean(source));
    if (selected.length !== sourceIds.length) throw new Error('PORTFOLIO_SOURCE_SELECTION_INVALID');
    return Promise.all(selected.map(async (source) => {
      if ('url' in source.image) return { id: source.id, description: source.description, image: source.image };
      return {
        id: source.id,
        description: source.description,
        image: await visionImage(new Uint8Array(Buffer.from(source.image.base64, 'base64')), source.image.mimeType ?? 'image/png'),
      };
    }));
  };
  const discard = (inspectionId: string): void => { sessions.delete(inspectionId); };
  const discardAll = (): void => { sessions.clear(); };
  return { inspectLocalFiles, inspectUploadedFiles, selectedSources, discard, discardAll };
};
