export const supportedAssetFormats = ['PNG', 'JPEG', 'WebP', 'HEIC', 'SVG', 'GIF', 'PDF', 'PSD'] as const;

export type SupportedAssetFormat = typeof supportedAssetFormats[number];

export type AssetDecodeMetadata = {
  width?: number;
  height?: number;
  animated?: boolean;
  [key: string]: unknown;
};

export type AssetImportItem = {
  name: string;
  mimeType?: string;
  data?: Uint8Array | ArrayBuffer | Blob | string;
  externalReference?: string;
  metadata?: Record<string, unknown>;
};

export type ManagedAsset = {
  id: string;
  name: string;
  format: SupportedAssetFormat;
  mimeType: string;
  contentHash: string;
  originalBytes?: Uint8Array;
  decode?: AssetDecodeMetadata;
  metadata?: Record<string, unknown>;
  managed: boolean;
  externalReference?: string;
};

export type AssetImportResult =
  | { status: 'success'; asset: ManagedAsset; external?: boolean }
  | { status: 'error'; error: string; item: AssetImportItem };

export type ImportAssetsOptions = {
  existingAssets?: ManagedAsset[];
  decode?: (bytes: Uint8Array, item: AssetImportItem) => AssetDecodeMetadata | Promise<AssetDecodeMetadata>;
  saveOriginal?: (bytes: Uint8Array, metadata: { assetId: string; contentHash: string; name: string; format: SupportedAssetFormat }) => void | Promise<void>;
};

const mimeFormats: Record<string, SupportedAssetFormat> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/webp': 'WebP',
  'image/heic': 'HEIC',
  'image/heif': 'HEIC',
  'image/svg+xml': 'SVG',
  'image/gif': 'GIF',
  'application/pdf': 'PDF',
  'image/vnd.adobe.photoshop': 'PSD',
  'image/psd': 'PSD',
  'application/psd': 'PSD',
};

const extensionFormats: Record<string, SupportedAssetFormat> = {
  png: 'PNG', jpg: 'JPEG', jpeg: 'JPEG', webp: 'WebP', heic: 'HEIC', heif: 'HEIC', svg: 'SVG', gif: 'GIF', pdf: 'PDF', psd: 'PSD',
};

const mimeForFormat: Record<SupportedAssetFormat, string> = {
  PNG: 'image/png', JPEG: 'image/jpeg', WebP: 'image/webp', HEIC: 'image/heic', SVG: 'image/svg+xml', GIF: 'image/gif', PDF: 'application/pdf', PSD: 'image/vnd.adobe.photoshop',
};

const isSafeName = (name: unknown): name is string => typeof name === 'string'
  && name.length > 0
  && name.length <= 240
  && !/[\\/\0\u0000-\u001f\u007f]/u.test(name)
  && name !== '.'
  && name !== '..'
  && !name.split('.').includes('..');

const formatFor = (item: AssetImportItem): SupportedAssetFormat | undefined => {
  const mime = item.mimeType?.toLowerCase().split(';', 1)[0].trim();
  const byMime = mime ? mimeFormats[mime] : undefined;
  const extension = item.name.toLowerCase().split('.').pop() ?? '';
  const byExtension = extensionFormats[extension];
  if (byMime && byExtension && byMime !== byExtension) return undefined;
  return byMime ?? byExtension;
};

const toBytes = async (data: AssetImportItem['data']): Promise<Uint8Array> => {
  if (data && typeof data === 'object' && ArrayBuffer.isView(data)) {
    if (typeof (data as Uint8Array).slice === 'function') return (data as Uint8Array).slice();
    return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
  if (typeof Blob !== 'undefined' && data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (typeof data === 'string') return new TextEncoder().encode(data);
  throw new Error('DATA_REQUIRED');
};

const sha256 = async (bytes: Uint8Array): Promise<string> => {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  }
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0').repeat(8);
};

const hasUnsafeMetadata = (value: unknown): boolean => {
  if (typeof value === 'string') return /[\u0000-\u001f\u007f]/u.test(value);
  if (Array.isArray(value)) return value.some((item) => hasUnsafeMetadata(item));
  if (typeof value === 'object' && value !== null) return Object.entries(value).some(([key, entry]) => hasUnsafeMetadata(key) || hasUnsafeMetadata(entry));
  return false;
};

const validateDecode = (metadata: AssetDecodeMetadata): void => {
  for (const key of ['width', 'height']) {
    const value = metadata[key];
    if (value !== undefined && (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > 100000)) throw new Error('INVALID_METADATA');
  }
};

const externalHash = async (reference: string): Promise<string> => sha256(new TextEncoder().encode(`external:${reference}`));

export const importAssets = async (items: AssetImportItem[], options: ImportAssetsOptions = {}): Promise<AssetImportResult[]> => {
  const existingByHash = new Map((options.existingAssets ?? []).filter((asset) => asset.contentHash).map((asset) => [asset.contentHash, asset]));
  const results: AssetImportResult[] = [];
  for (const item of items) {
    try {
      if (!isSafeName(item.name)) throw new Error('UNSAFE_PATH');
      const format = formatFor(item);
      if (!format) throw new Error('UNSUPPORTED_FORMAT');
      if (item.metadata !== undefined && (typeof item.metadata !== 'object' || item.metadata === null || Array.isArray(item.metadata) || hasUnsafeMetadata(item.metadata))) throw new Error('INVALID_METADATA');
      if (item.externalReference !== undefined) {
        let url: URL;
        try { url = new URL(item.externalReference); } catch { throw new Error('INVALID_EXTERNAL_REFERENCE'); }
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('INVALID_EXTERNAL_REFERENCE');
        const contentHash = await externalHash(item.externalReference);
        const asset: ManagedAsset = { id: `asset-${contentHash.slice(0, 16)}`, name: item.name, format, mimeType: item.mimeType ?? mimeForFormat[format], contentHash, metadata: item.metadata ? structuredClone(item.metadata) : undefined, managed: false, externalReference: item.externalReference };
        results.push({ status: 'success', asset, external: true });
        continue;
      }
      const bytes = await toBytes(item.data);
      const contentHash = await sha256(bytes);
      const duplicate = existingByHash.get(contentHash);
      if (duplicate) {
        results.push({ status: 'success', asset: structuredClone(duplicate) });
        continue;
      }
      const decode = options.decode ? await options.decode(new Uint8Array(bytes), item) : undefined;
      if (decode) validateDecode(decode);
      const asset: ManagedAsset = { id: `asset-${contentHash.slice(0, 16)}`, name: item.name, format, mimeType: item.mimeType ?? mimeForFormat[format], contentHash, originalBytes: bytes, decode: decode ? structuredClone(decode) : undefined, metadata: item.metadata ? structuredClone(item.metadata) : undefined, managed: true };
      await options.saveOriginal?.(bytes.slice(), { assetId: asset.id, contentHash, name: asset.name, format });
      existingByHash.set(contentHash, asset);
      results.push({ status: 'success', asset });
    } catch (error) {
      results.push({ status: 'error', error: error instanceof Error ? error.message : 'IMPORT_FAILED', item });
    }
  }
  return results;
};

export const convertExternalReference = async (asset: ManagedAsset, data: Uint8Array | ArrayBuffer | Blob | string, options: Omit<ImportAssetsOptions, 'existingAssets'> = {}): Promise<ManagedAsset> => {
  const [result] = await importAssets([{ name: asset.name, mimeType: asset.mimeType, data, metadata: asset.metadata }], options);
  if (result.status === 'error') throw new Error(result.error);
  return result.asset;
};
