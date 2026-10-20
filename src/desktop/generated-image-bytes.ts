import type { GeneratedImage } from '../features/providers/adapter';

export type GeneratedImageDownloadDiagnostic = {
  host?: string;
  causeName?: string;
  causeCode?: string;
};

const safeToken = (value: unknown): string | undefined => typeof value === 'string'
  && /^[A-Z0-9_-]{1,64}$/u.test(value)
  ? value
  : undefined;

const downloadDiagnostic = (url: string, cause: unknown): GeneratedImageDownloadDiagnostic => {
  let host: string | undefined;
  try {
    host = new URL(url).hostname.slice(0, 253);
  } catch {
    host = undefined;
  }
  const record = cause && typeof cause === 'object' ? cause as Record<string, unknown> : {};
  const nested = record.cause && typeof record.cause === 'object' ? record.cause as Record<string, unknown> : record;
  const causeName = safeToken(typeof record.name === 'string' ? record.name.toUpperCase() : undefined);
  const causeCode = safeToken(nested.code) ?? safeToken(record.code);
  return {
    ...(host ? { host } : {}),
    ...(causeName ? { causeName } : {}),
    ...(causeCode ? { causeCode } : {}),
  };
};

export const generatedImageBytes = async (
  image: GeneratedImage,
  fetcher: typeof fetch = fetch,
): Promise<{ bytes: Uint8Array; mimeType: string }> => {
  if (image.base64) {
    const dataUrl = image.base64.match(/^data:([^;,]+);base64,(.*)$/su);
    const encoded = dataUrl ? dataUrl[2].replace(/\s+/gu, '') : image.base64.replace(/\s+/gu, '');
    const fromBase64 = Buffer.from(encoded, 'base64');
    if (fromBase64.length > 0) {
      const mimeType = image.mimeType ?? (dataUrl?.[1].toLowerCase() || 'image/png');
      return { bytes: new Uint8Array(fromBase64), mimeType };
    }
  }
  if (!image.url) throw new Error('GENERATED_IMAGE_EMPTY');

  let response: Response;
  try {
    response = await fetcher(image.url);
  } catch (cause) {
    throw Object.assign(new Error('GENERATED_IMAGE_URL_FETCH_FAILED'), {
      diagnostic: downloadDiagnostic(image.url, cause),
    });
  }
  if (!response.ok) throw new Error(`GENERATED_IMAGE_URL_HTTP_${response.status}`);
  const mimeType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (!mimeType?.startsWith('image/')) throw new Error('GENERATED_IMAGE_URL_NOT_IMAGE');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error('GENERATED_IMAGE_URL_EMPTY');
  return { bytes, mimeType };
};
