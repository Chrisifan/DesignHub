import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { readFile } from 'node:fs/promises';

import { Unzip, UnzipInflate } from 'fflate';

import type { PortfolioImageSource } from '../features/agent/analyze-portfolio';
import type { PortfolioInspection, PortfolioInspectionCandidate } from '../platform/contracts';

const maxPortfolioSources = 8;
const maxArchiveEntries = 128;
const maxArchiveBytes = 24 * 1024 * 1024;
const maxImageBytes = 8 * 1024 * 1024;
const maxPageBytes = 1024 * 1024;
const maxRedirects = 3;
const supportedImageTypes = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
  ['gif', 'image/gif'],
]);

export type { PortfolioInspection, PortfolioInspectionCandidate } from '../platform/contracts';

type LoadedInspectionSource = PortfolioInspectionCandidate & { image: PortfolioImageSource['image'] };
type DeferredPageInspectionSource = PortfolioInspectionCandidate & { remoteImageUrl: string };
type InspectionSource = LoadedInspectionSource | DeferredPageInspectionSource;
type FetchResponse = {
  status: number;
  headers: { get: (name: string) => string | null };
  body?: { getReader: () => { read: () => Promise<{ done: boolean; value?: Uint8Array }> } } | null;
  arrayBuffer: () => Promise<ArrayBuffer>;
};
type FetchRequest = (url: string, options: { redirect: 'manual'; credentials: 'omit'; headers: Record<string, string> }) => Promise<FetchResponse>;

export type PortfolioSourceInspectorOptions = {
  readFile?: (path: string) => Promise<Uint8Array>;
  resolvePublicAddresses?: (hostname: string) => Promise<string[]>;
  fetch?: FetchRequest;
};

export type PortfolioSourceInspector = {
  inspectLocalImages: (paths: readonly string[]) => Promise<PortfolioInspection>;
  inspectZip: (path: string) => Promise<PortfolioInspection>;
  inspectRemoteImage: (url: string) => Promise<PortfolioInspection>;
  inspectRemotePage: (url: string) => Promise<PortfolioInspection>;
  selectedSources: (inspectionId: string, sourceIds: readonly string[]) => Promise<PortfolioImageSource[]>;
  discard: (inspectionId: string) => void;
  discardAll: () => void;
};

const ipv4Parts = (address: string): number[] | null => {
  const parts = address.split('.').map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
};

const isPrivateIpv4Address = (address: string): boolean => {
  const parts = ipv4Parts(address);
  if (!parts) return true;
  const [first, second] = parts;
  return first === 0 || first === 10 || first === 127 || first >= 224
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && (second === 0 || second === 168))
    || (first === 198 && (second === 18 || second === 19 || second === 51))
    || (first === 203 && second === 0);
};

const ipv6Hextets = (address: string): number[] | null => {
  const normalized = address.toLowerCase();
  if (normalized.includes('%') || normalized.split('::').length > 2) return null;
  const convert = (part: string): number[] | null => {
    if (part.includes('.')) {
      const parts = ipv4Parts(part);
      return parts ? [(parts[0]! << 8) | parts[1]!, (parts[2]! << 8) | parts[3]!] : null;
    }
    return /^[0-9a-f]{1,4}$/u.test(part) ? [Number.parseInt(part, 16)] : null;
  };
  const [before, after] = normalized.split('::');
  const beforeParts = before ? before.split(':') : [];
  const afterParts = after === undefined || !after ? [] : after.split(':');
  const values = [...beforeParts, ...afterParts].flatMap((part) => convert(part) ?? []);
  if ([...beforeParts, ...afterParts].some((part) => convert(part) === null)) return null;
  if (after === undefined) return values.length === 8 ? values : null;
  const omitted = 8 - values.length;
  return omitted > 0 ? [...beforeParts.flatMap((part) => convert(part) as number[]), ...Array.from({ length: omitted }, () => 0), ...afterParts.flatMap((part) => convert(part) as number[])] : null;
};

const isPrivateAddress = (address: string): boolean => {
  const normalized = address.toLowerCase();
  if (!normalized.includes(':')) return isPrivateIpv4Address(normalized);
  const parts = ipv6Hextets(normalized);
  if (!parts) return true;
  const first = parts[0]!;
  const isUnspecified = parts.every((part) => part === 0);
  const isLoopback = parts.slice(0, 7).every((part) => part === 0) && parts[7] === 1;
  const isIpv4Mapped = parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff;
  if (isIpv4Mapped) return isPrivateIpv4Address(`${parts[6]! >> 8}.${parts[6]! & 255}.${parts[7]! >> 8}.${parts[7]! & 255}`);
  return isUnspecified || isLoopback || (first & 0xffc0) === 0xfe80 || (first & 0xfe00) === 0xfc00 || (first & 0xff00) === 0xff00;
};

const imageTypeForName = (name: string): string | null => {
  const extension = name.split('.').at(-1)?.toLowerCase();
  return extension ? supportedImageTypes.get(extension) ?? null : null;
};

const imageTypeFromHeader = (contentType: string | null): string | null => {
  const normalized = contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return [...supportedImageTypes.values()].includes(normalized) ? normalized : null;
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

const readBoundedResponse = async (response: FetchResponse, maximumBytes: number): Promise<Uint8Array> => {
  const advertised = Number(response.headers.get('content-length'));
  if (Number.isFinite(advertised) && advertised > maximumBytes) throw new Error('PORTFOLIO_SOURCE_TOO_LARGE');
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maximumBytes) throw new Error('PORTFOLIO_SOURCE_TOO_LARGE');
    return bytes;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    const chunk = next.value ?? new Uint8Array();
    size += chunk.byteLength;
    if (size > maximumBytes) throw new Error('PORTFOLIO_SOURCE_TOO_LARGE');
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.byteLength; });
  return bytes;
};

const attributeValue = (tag: string, name: string): string | null => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const matched = tag.match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s/>]+))`, 'iu'));
  return matched ? (matched[1] ?? matched[2] ?? matched[3] ?? '').trim() : null;
};

const hasHiddenSemantics = (tag: string): boolean => {
  const hasHidden = /(?:^|\s)hidden(?:\s|=|\/|>)/iu.test(tag);
  const ariaHidden = attributeValue(tag, 'aria-hidden')?.toLowerCase() === 'true';
  const style = attributeValue(tag, 'style') ?? '';
  return hasHidden || ariaHidden || /\bdisplay\s*:\s*none\b|\bvisibility\s*:\s*hidden\b/iu.test(style);
};

const isZeroDimension = (value: string): boolean => /^0+(?:\.0+)?(?:px|em|rem|%|vh|vw|pt|pc|cm|mm|in)?$/iu.test(value.trim());

const hasZeroDimension = (tag: string): boolean => {
  const style = attributeValue(tag, 'style') ?? '';
  const zeroStyle = /(?:^|;)\s*(?:width|height)\s*:\s*0+(?:\.0+)?(?:px|em|rem|%|vh|vw|pt|pc|cm|mm|in)?\s*(?:!important\s*)?(?:;|$)/iu.test(style);
  return zeroStyle || ['width', 'height'].some((name) => {
    const value = attributeValue(tag, name);
    return value !== null && isZeroDimension(value);
  });
};

const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

const visiblePageImages = (html: string, baseUrl: string): Array<{ url: string; label: string }> => {
  const seen = new Set<string>();
  const candidates: Array<{ url: string; label: string }> = [];
  const hiddenStack: boolean[] = [];
  const tags = html.replace(/<!--[\s\S]*?-->/gu, '').match(/<\/?[a-z][a-z0-9:-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>/giu) ?? [];
  tags.forEach((tag) => {
    const match = tag.match(/^<\/?([a-z][a-z0-9:-]*)\b/iu);
    const name = match?.[1]?.toLowerCase();
    if (!name) return;
    if (tag.startsWith('</')) {
      hiddenStack.pop();
      return;
    }
    const isImage = name === 'img';
    const hidden = hiddenStack.some(Boolean) || name === 'template' || name === 'script' || name === 'style' || name === 'noscript' || hasHiddenSemantics(tag);
    if (!isImage) {
      if (!tag.endsWith('/>') && !voidElements.has(name)) hiddenStack.push(hidden);
      return;
    }
    if (hidden || hasZeroDimension(tag)) return;
    const source = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/iu)?.[1];
    if (!source) return;
    try {
      const url = new URL(source, baseUrl).toString();
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || seen.has(url)) return;
      seen.add(url);
      candidates.push({ url, label: tag.match(/\balt\s*=\s*["']([^"']*)["']/iu)?.[1]?.trim() || parsed.pathname.split('/').at(-1) || 'Portfolio image' });
    } catch { /* An unparseable page image is not a selectable candidate. */ }
  });
  return candidates;
};

export const createPortfolioSourceInspector = (options: PortfolioSourceInspectorOptions = {}): PortfolioSourceInspector => {
  const sessions = new Map<string, InspectionSource[]>();
  const read = options.readFile ?? (async (path: string) => new Uint8Array(await readFile(path)));
  const resolvePublicAddresses = options.resolvePublicAddresses ?? (async (hostname: string) => (await lookup(hostname, { all: true })).map((item) => item.address));
  const remoteFetch = options.fetch ?? ((url, request) => fetch(url, request) as Promise<FetchResponse>);
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
  const assertPublicUrl = async (value: string): Promise<URL> => {
    let parsed: URL;
    try { parsed = new URL(value); } catch { throw new Error('PORTFOLIO_REMOTE_URL_INVALID'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hostname.length === 0) throw new Error('PORTFOLIO_REMOTE_URL_INVALID');
    const addresses = await resolvePublicAddresses(parsed.hostname);
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new Error('PORTFOLIO_REMOTE_ADDRESS_FORBIDDEN');
    return parsed;
  };
  const download = async (value: string, kind: 'image' | 'page'): Promise<{ url: string; bytes: Uint8Array; mimeType: string }> => {
    let current = value;
    for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
      const url = await assertPublicUrl(current);
      const response = await remoteFetch(url.toString(), { redirect: 'manual', credentials: 'omit', headers: { accept: kind === 'image' ? 'image/png,image/jpeg,image/webp,image/gif' : 'text/html,application/xhtml+xml' } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirects === maxRedirects) throw new Error('PORTFOLIO_REDIRECT_INVALID');
        current = new URL(location, url).toString();
        continue;
      }
      if (response.status < 200 || response.status >= 300) throw new Error('PORTFOLIO_REMOTE_FETCH_FAILED');
      const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
      const mimeType = kind === 'image' ? imageTypeFromHeader(contentType) : (contentType === 'text/html' || contentType === 'application/xhtml+xml' ? contentType : null);
      if (!mimeType) throw new Error('PORTFOLIO_REMOTE_TYPE_INVALID');
      return { url: url.toString(), bytes: await readBoundedResponse(response, kind === 'image' ? maxImageBytes : maxPageBytes), mimeType };
    }
    throw new Error('PORTFOLIO_REDIRECT_INVALID');
  };
  const inspectLocalImages = async (paths: readonly string[]): Promise<PortfolioInspection> => {
    if (paths.length === 0) throw new Error('PORTFOLIO_SOURCE_REQUIRED');
    if (paths.length > maxPortfolioSources) throw new Error('PORTFOLIO_SOURCE_LIMIT');
    const sources = await Promise.all(paths.map(async (path) => {
      const mimeType = imageTypeForName(path);
      if (!mimeType) throw new Error('PORTFOLIO_IMAGE_TYPE_INVALID');
      const bytes = await read(path);
      if (bytes.byteLength > maxImageBytes) throw new Error('PORTFOLIO_SOURCE_TOO_LARGE');
      return sourceFromBytes({ label: path.split(/[\\/]/u).at(-1) || 'Portfolio image', origin: 'local-image', bytes, mimeType });
    }));
    return saveInspection(sources);
  };
  const inspectZip = async (path: string): Promise<PortfolioInspection> => {
    const archive = await read(path);
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
  const inspectRemoteImage = async (url: string): Promise<PortfolioInspection> => {
    const downloaded = await download(url, 'image');
    return saveInspection([sourceFromBytes({ label: new URL(downloaded.url).pathname.split('/').at(-1) || 'Portfolio image', origin: 'remote-image', bytes: downloaded.bytes, mimeType: downloaded.mimeType })]);
  };
  const inspectRemotePage = async (url: string): Promise<PortfolioInspection> => {
    const page = await download(url, 'page');
    const decoder = new TextDecoder();
    const discovered = visiblePageImages(decoder.decode(page.bytes), page.url).slice(0, maxPortfolioSources);
    const sources: InspectionSource[] = discovered.map((candidate) => ({
      id: `portfolio-source-${randomUUID()}`,
      label: candidate.label,
      description: candidate.label,
      origin: 'page-image',
      previewUrl: '',
      remoteImageUrl: candidate.url,
    }));
    return saveInspection(sources);
  };
  const selectedSources = async (inspectionId: string, sourceIds: readonly string[]): Promise<PortfolioImageSource[]> => {
    const sources = sessions.get(inspectionId);
    if (!sources) throw new Error('PORTFOLIO_INSPECTION_NOT_FOUND');
    if (sourceIds.length === 0) throw new Error('PORTFOLIO_SOURCE_REQUIRED');
    if (sourceIds.length > maxPortfolioSources || new Set(sourceIds).size !== sourceIds.length) throw new Error('PORTFOLIO_SOURCE_LIMIT');
    const selected = sourceIds.map((id) => sources.find((source) => source.id === id)).filter((source): source is InspectionSource => Boolean(source));
    if (selected.length !== sourceIds.length) throw new Error('PORTFOLIO_SOURCE_SELECTION_INVALID');
    return Promise.all(selected.map(async (source) => {
      if ('image' in source) return { id: source.id, description: source.description, image: source.image };
      const downloaded = await download(source.remoteImageUrl, 'image');
      assertImageBytes(downloaded.bytes, downloaded.mimeType);
      return {
        id: source.id,
        description: source.description,
        image: { base64: Buffer.from(downloaded.bytes).toString('base64'), mimeType: downloaded.mimeType },
      };
    }));
  };
  const discard = (inspectionId: string): void => { sessions.delete(inspectionId); };
  const discardAll = (): void => { sessions.clear(); };
  return { inspectLocalImages, inspectZip, inspectRemoteImage, inspectRemotePage, selectedSources, discard, discardAll };
};
