import { defaultProviderToolCapabilities, normalizeProviderToolCapabilities, providerCapabilities, validateProviderToolCapability, type ImageTransport, type ProviderCapability, type ProviderModelConfig, type ProviderToolCapability } from './config';
import type { ImageTool, ToolParams } from '../image-tools/target';

export {
  defaultProviderToolCapabilities,
  providerCapabilities,
  normalizeProviderToolCapability,
  normalizeProviderToolCapabilities,
  validateProviderToolCapability,
} from './config';

export const providerCapabilityMatrix = {
  conversation: true,
  'vision-analysis': true,
  'image-generation': true,
  'image-editing': true,
} as const;
export type ProviderCapabilityMatrix = typeof providerCapabilityMatrix;
export type { ProviderToolCapability } from './config';
export type ChatRole = 'system' | 'user' | 'assistant';
export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };
export type ChatMessage = { role: ChatRole; content: string | ChatContentPart[] };
export type ChatRequest = { messages: ChatMessage[]; model?: string; temperature?: number; maxTokens?: number };
export type ChatUsage = { promptTokens?: number; completionTokens?: number; totalTokens?: number };
export type ChatResponse = { text: string; usage?: ChatUsage; cost: number | null };
export type ChatStreamEvent = { text: string; finishReason?: string | null };
export type VisionImage = { url: string } | { base64: string; mimeType?: string };
export type VisionRequest = { prompt: string; images: VisionImage[] };
export type ImageRequest = { prompt: string; model?: string; size?: string; count?: number; referenceImages?: Blob[]; tool?: ImageTool; toolParams?: ToolParams; requiresTransparency?: boolean; width?: number; height?: number; bytes?: number };
export type ImageEditRequest = { prompt: string; image: Blob; referenceImages?: Blob[]; mask?: Blob; model?: string; size?: string; tool?: ImageTool; toolParams?: ToolParams; region?: { x: number; y: number; width: number; height: number }; requiresTransparency?: boolean; width?: number; height?: number; bytes?: number };
export type GeneratedImage = { url?: string; base64?: string; mimeType?: string };
export type ImageResponse = { images: GeneratedImage[]; cost: number | null; remoteRequestId?: string; supportsRemoteCancellation?: boolean; supportsStatusQuery?: boolean };

export type ProviderAdapterErrorKind = 'http' | 'rate_limited' | 'invalid_response' | 'cancelled' | 'capability';
export type ProviderAdapterError = Error & {
  kind: ProviderAdapterErrorKind;
  status?: number;
  retryAfterSeconds?: number;
  providerCode?: string;
};

export type MainOnlyAdapterOptions = {
  baseUrl: string;
  apiKey: string;
  imageTransport?: ImageTransport;
  models?: ProviderModelConfig;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
  toolCapabilities?: readonly ProviderToolCapability[];
};

export type OpenAICompatibleAdapter = {
  capabilities: typeof providerCapabilities;
  toolCapabilities?: readonly ProviderToolCapability[];
  chat: (request: ChatRequest, signal?: AbortSignal) => Promise<ChatResponse>;
  streamChat: (request: ChatRequest, signal?: AbortSignal) => AsyncIterable<ChatStreamEvent>;
  analyzeVision: (request: VisionRequest, signal?: AbortSignal) => Promise<ChatResponse>;
  generateImage: (request: ImageRequest, signal?: AbortSignal) => Promise<ImageResponse>;
  editImage: (request: ImageEditRequest, signal?: AbortSignal) => Promise<ImageResponse>;
};

export type LocalCancellation = {
  signal: AbortSignal;
  cancel: () => void;
  remoteCancellation: false;
};

const toUsage = (usage: unknown): ChatUsage | undefined => {
  if (!usage || typeof usage !== 'object') return undefined;
  const record = usage as Record<string, unknown>;
  const promptTokens = typeof record.prompt_tokens === 'number' ? record.prompt_tokens : undefined;
  const completionTokens = typeof record.completion_tokens === 'number' ? record.completion_tokens : undefined;
  const totalTokens = typeof record.total_tokens === 'number' ? record.total_tokens : undefined;
  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined) return undefined;
  return { promptTokens, completionTokens, totalTokens };
};

const toError = (message: string, kind: ProviderAdapterErrorKind, details: Partial<ProviderAdapterError> = {}): ProviderAdapterError => {
  const error = Object.assign(new Error(message), { kind, ...details }) as ProviderAdapterError;
  return error;
};

const capabilityError = (reason: string): ProviderAdapterError => toError(`Provider does not support this request (${reason}).`, 'capability', { providerCode: `PROVIDER_${reason}` });

const parseImageSize = (size: string | undefined): { width?: number; height?: number } => {
  if (!size) return {};
  const match = /^(\d+)x(\d+)$/u.exec(size.trim());
  if (!match) return {};
  return { width: Number(match[1]), height: Number(match[2]) };
};

const readJson = async (response: Response): Promise<Record<string, unknown>> => {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    throw toError('Provider returned invalid JSON.', 'invalid_response', { status: response.status });
  }
};

const retryAfter = (response: Response): number | undefined => {
  const value = response.headers.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
};

const createHttpError = async (response: Response, redact: (value: string) => string): Promise<ProviderAdapterError> => {
  let payload: Record<string, unknown> = {};
  try {
    payload = await readJson(response);
  } catch {
    payload = {};
  }
  const providerError = payload.error && typeof payload.error === 'object' ? payload.error as Record<string, unknown> : {};
  const providerMessage = typeof providerError.message === 'string' ? redact(providerError.message) : `Provider request failed (${response.status}).`;
  const providerCode = typeof providerError.code === 'string' ? redact(providerError.code) : undefined;
  const limited = response.status === 429;
  return toError(providerMessage, limited ? 'rate_limited' : 'http', {
    status: response.status,
    retryAfterSeconds: retryAfter(response),
    providerCode,
  });
};

const networkError = (cause: unknown, redact: (value: string) => string): ProviderAdapterError => {
  const nestedCause = cause && typeof cause === 'object' && 'cause' in cause
    ? (cause as { cause?: unknown }).cause
    : undefined;
  const detail = nestedCause ?? cause;
  const detailRecord = detail && typeof detail === 'object' ? detail as { code?: unknown; message?: unknown } : {};
  const code = typeof detailRecord.code === 'string' ? redact(detailRecord.code) : undefined;
  const detailMessage = typeof detailRecord.message === 'string' ? redact(detailRecord.message) : undefined;
  const tlsFailure = Boolean(
    (code && /(?:CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY)/iu.test(code))
    || (detailMessage && /(?:certificate|self[- ]signed|TLS|SSL)/iu.test(detailMessage)),
  );
  if (tlsFailure) {
    const description = detailMessage || 'TLS certificate validation failed';
    return toError(`PROVIDER_TLS_ERROR: ${description}${code ? ` (${code})` : ''}`, 'http', { providerCode: code });
  }
  const message = cause instanceof Error ? redact(cause.message) : 'Provider network request failed.';
  return toError(message || 'Provider network request failed.', 'http');
};

const blobBytes = async (blob: Blob): Promise<ArrayBuffer> => {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  if (typeof FileReader === 'undefined') throw toError('Provider cannot read the supplied image.', 'invalid_response');
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(toError('Provider cannot read the supplied image.', 'invalid_response'));
    reader.onload = () => reader.result instanceof ArrayBuffer
      ? resolve(reader.result)
      : reject(toError('Provider returned an unreadable image.', 'invalid_response'));
    reader.readAsArrayBuffer(blob);
  });
};

const blobDataUrl = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blobBytes(blob));
  const base64 = Buffer.from(bytes).toString('base64');
  return `data:${blob.type || 'image/png'};base64,${base64}`;
};

const isBase64 = (value: string): boolean => value.length > 0
  && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);

const imageMimeType = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const mimeType = value.trim().toLowerCase();
  return /^image\/[a-z0-9.+-]+$/u.test(mimeType) ? mimeType : undefined;
};

const responseImage = (item: Record<string, unknown>): GeneratedImage | undefined => {
  if (item.type !== 'image_generation_call' || typeof item.result !== 'string') return undefined;

  let result = item.result.trim();
  let mimeType: string | undefined;
  const dataUrl = result.match(/^data:([^;,]+);base64,(.*)$/su);
  if (dataUrl) {
    mimeType = imageMimeType(dataUrl[1]);
    if (!mimeType) return undefined;
    result = dataUrl[2];
  } else {
    mimeType = imageMimeType(item.mime_type) ?? imageMimeType(item.mimeType);
  }

  const base64 = result.replace(/\s+/gu, '');
  if (!isBase64(base64) || Buffer.from(base64, 'base64').length === 0) return undefined;
  return { base64, ...(mimeType ? { mimeType } : {}) };
};

const responsesImages = (payload: Record<string, unknown>): GeneratedImage[] => {
  const output = Array.isArray(payload.output) ? payload.output : [];
  return output.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    const image = responseImage(item);
    return image ? [image] : [];
  });
};

const editInstruction = (request: ImageEditRequest): string => [
  request.prompt,
  ...(request.mask ? ['The second input image is an edit mask guide. Apply changes only within its marked region.'] : []),
  ...(request.tool ? [`Requested edit tool: ${request.tool}.`] : []),
  ...(request.toolParams ? [`Tool parameters: ${JSON.stringify(request.toolParams)}.`] : []),
  ...(request.region ? [`Target region: ${JSON.stringify(request.region)}.`] : []),
].join('\n\n');

const imageResponse = (payload: Record<string, unknown>): ImageResponse => ({
  images: Array.isArray(payload.data) ? payload.data.map((entry) => {
    const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    return { ...(typeof item.url === 'string' ? { url: item.url } : {}), ...(typeof item.b64_json === 'string' ? { base64: item.b64_json } : {}) };
  }) : [],
  cost: typeof payload.cost === 'number' ? payload.cost : null,
  ...(typeof payload.id === 'string' ? { remoteRequestId: payload.id } : {}),
  ...(typeof payload.supportsRemoteCancellation === 'boolean' ? { supportsRemoteCancellation: payload.supportsRemoteCancellation } : {}),
  ...(typeof payload.supportsStatusQuery === 'boolean' ? { supportsStatusQuery: payload.supportsStatusQuery } : {}),
});

const appendImages = (form: FormData, images: readonly Blob[]): void => {
  const field = images.length > 1 ? 'image[]' : 'image';
  images.forEach((image) => form.append(field, image));
};

const contentText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.flatMap((part) => {
    if (part && typeof part === 'object' && (part as Record<string, unknown>).type === 'text') {
      const text = (part as Record<string, unknown>).text;
      return typeof text === 'string' ? [text] : [];
    }
    return [];
  }).join('');
};

const chatStreamEvent = (payload: unknown, redact: (value: string) => string): ChatStreamEvent | undefined => {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  const choices = record.choices;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  const choice = first && typeof first === 'object' ? first as Record<string, unknown> : {};
  const delta = choice.delta && typeof choice.delta === 'object' ? choice.delta as Record<string, unknown> : {};
  const message = choice.message && typeof choice.message === 'object' ? choice.message as Record<string, unknown> : {};
  const text = redact(contentText(delta.content || message.content || choice.text || record.output_text));
  if (!text && choice.finish_reason === undefined) return undefined;
  return { text, finishReason: typeof choice.finish_reason === 'string' ? choice.finish_reason : null };
};

const sseIterable = (response: Response, signal: AbortSignal | undefined, redact: (value: string) => string): AsyncIterable<ChatStreamEvent> => {
  const reader = response.body?.getReader();
  if (!reader) throw toError('Provider returned no stream body.', 'invalid_response', { status: response.status });
  let buffer = '';
  let ended = false;
  let done = false;
  const decode = new TextDecoder();

  const parseFrames = (): ChatStreamEvent[] => {
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? '';
    const events: ChatStreamEvent[] = [];
    for (const frame of frames) {
      const data = frame.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
      if (!data) {
        const fallback = frame.trim();
        if (!/^[{[]/u.test(fallback)) continue;
        try {
          const event = chatStreamEvent(JSON.parse(fallback), redact);
          if (event) events.push(event);
        } catch {
          throw toError('Provider returned malformed stream data.', 'invalid_response', { status: response.status });
        }
        continue;
      }
      if (data === '[DONE]') {
        ended = true;
        continue;
      }
      try {
        const event = chatStreamEvent(JSON.parse(data), redact);
        if (event) events.push(event);
      } catch {
        throw toError('Provider returned malformed SSE data.', 'invalid_response', { status: response.status });
      }
    }
    return events;
  };

  let pending: ChatStreamEvent[] = [];
  const next = async (): Promise<IteratorResult<ChatStreamEvent>> => {
    if (pending.length > 0) return { done: false, value: pending.shift() as ChatStreamEvent };
    if (done || ended) {
      done = true;
      return { done: true, value: undefined } as IteratorResult<ChatStreamEvent>;
    }
    try {
      while (pending.length === 0 && !done && !ended) {
        const chunk = await reader.read();
        if (chunk.done) {
          buffer += decode.decode();
          if (buffer.trim()) buffer += '\n\n';
          pending = parseFrames();
          done = true;
          break;
        }
        buffer += decode.decode(chunk.value, { stream: true });
        pending = parseFrames();
      }
    } catch (cause) {
      if (signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) throw toError('Provider request cancelled locally.', 'cancelled');
      if (cause && typeof cause === 'object' && 'kind' in cause) throw cause as ProviderAdapterError;
      throw networkError(cause, redact);
    }
    if (pending.length > 0) return { done: false, value: pending.shift() as ChatStreamEvent };
    return { done: true, value: undefined } as IteratorResult<ChatStreamEvent>;
  };

  return { [Symbol.asyncIterator]: (): AsyncIterator<ChatStreamEvent> => ({ next }) };
};

export const createLocalCancellation = (): LocalCancellation => {
  const controller = new AbortController();
  return { signal: controller.signal, cancel: () => controller.abort(), remoteCancellation: false };
};

export const createOpenAICompatibleAdapter = (options: MainOnlyAdapterOptions): OpenAICompatibleAdapter => {
  if (!options.baseUrl.trim()) throw new Error('PROVIDER_BASE_URL_REQUIRED');
  if (!options.apiKey.trim()) throw new Error('PROVIDER_API_KEY_REQUIRED');
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const apiKey = options.apiKey;
  const imageTransport = options.imageTransport ?? 'images';
  const normalizedToolCapabilities = normalizeProviderToolCapabilities(options.toolCapabilities);
  if (normalizedToolCapabilities === null) throw new Error('PROVIDER_CAPABILITY_INVALID');
  const toolCapabilities = normalizedToolCapabilities ?? defaultProviderToolCapabilities;
  const configuredModel = (capability: ProviderCapability, requested?: string): string | undefined => requested ?? options.models?.[capability];
  const fetcher = options.fetch ?? options.fetchImpl ?? ((input: string, init?: RequestInit): Promise<Response> => globalThis.fetch(input, init));
  const redact = (value: string): string => apiKey ? value.replaceAll(apiKey, '[redacted]') : value;
  const postJson = async (path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> => {
    let response: Response;
    try {
      response = await fetcher(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
    } catch (cause) {
      if (signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) throw toError('Provider request cancelled locally.', 'cancelled');
      throw networkError(cause, redact);
    }
    if (!response.ok) throw await createHttpError(response, redact);
    return readJson(response);
  };
  const chatFor = async (capability: 'conversation' | 'vision-analysis', request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> => {
    const payload = await postJson('/chat/completions', {
      messages: request.messages,
      ...(configuredModel(capability, request.model) ? { model: configuredModel(capability, request.model) } : {}),
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens }),
    }, signal);
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const first = choices[0] && typeof choices[0] === 'object' ? choices[0] as Record<string, unknown> : {};
    const message = first.message && typeof first.message === 'object' ? first.message as Record<string, unknown> : {};
    return { text: redact(contentText(message.content)), usage: toUsage(payload.usage), cost: null };
  };
  const chat = async (request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> => chatFor('conversation', request, signal);
  const streamChat = (request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatStreamEvent> => {
    let responsePromise: Promise<Response> | undefined;
    const getResponse = async (): Promise<Response> => {
      if (!responsePromise) {
        responsePromise = (async () => {
          try {
            const response = await fetcher(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
              body: JSON.stringify({
                messages: request.messages,
                ...(configuredModel('conversation', request.model) ? { model: configuredModel('conversation', request.model) } : {}),
                ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
                ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens }),
                stream: true,
              }),
              signal,
            });
            if (!response.ok) throw await createHttpError(response, redact);
            return response;
          } catch (cause) {
            if (signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) throw toError('Provider request cancelled locally.', 'cancelled');
            if (cause && typeof cause === 'object' && 'kind' in cause) throw cause as ProviderAdapterError;
            throw networkError(cause, redact);
          }
        })();
      }
      return responsePromise;
    };
    let iterable: AsyncIterable<ChatStreamEvent> | undefined;
    let iterator: AsyncIterator<ChatStreamEvent> | undefined;
    const next = async (): Promise<IteratorResult<ChatStreamEvent>> => {
      if (!iterable) iterable = sseIterable(await getResponse(), signal, redact);
      if (!iterator) iterator = iterable[Symbol.asyncIterator]();
      return iterator.next();
    };
    return { [Symbol.asyncIterator]: (): AsyncIterator<ChatStreamEvent> => ({ next }) };
  };
  const analyzeVision = async (request: VisionRequest, signal?: AbortSignal): Promise<ChatResponse> => {
    if (request.images.length === 0) throw toError('Vision analysis requires at least one image.', 'invalid_response');
    const images: ChatContentPart[] = request.images.map((image) => ({
      type: 'image_url',
      image_url: {
        url: 'url' in image ? image.url : `data:${image.mimeType ?? 'image/png'};base64,${image.base64}`,
      },
    }));
    return chatFor('vision-analysis', { messages: [{ role: 'user', content: [{ type: 'text', text: request.prompt }, ...images] }] }, signal);
  };
  const generateImage = async (request: ImageRequest, signal?: AbortSignal): Promise<ImageResponse> => {
    if (request.tool) {
      const size = parseImageSize(request.size);
      const validation = validateProviderToolCapability({
        tool: request.tool,
        requiresTransparency: request.requiresTransparency,
        width: request.width ?? size.width,
        height: request.height ?? size.height,
        bytes: request.bytes,
        params: request.toolParams,
      }, toolCapabilities);
      if (!validation.ok) throw capabilityError(validation.reason);
    }
    if (imageTransport === 'responses') {
      if (request.count !== undefined && request.count !== 1) throw new Error('RESPONSES_IMAGE_COUNT_UNSUPPORTED');
      const model = configuredModel('image-generation', request.model);
      const referenceImages = request.referenceImages ?? [];
      const payload = await postJson('/responses', {
        ...(model ? { model } : {}),
        input: [{
          role: 'user',
          content: [
            ...await Promise.all(referenceImages.map(async (image) => ({ type: 'input_image', image_url: await blobDataUrl(image) }))),
            { type: 'input_text', text: request.prompt },
          ],
        }],
        tools: [{ type: 'image_generation', ...(request.size ? { size: request.size } : {}) }],
        tool_choice: { type: 'image_generation' },
      }, signal);
      const images = responsesImages(payload);
      if (images.length === 0) throw toError('Provider returned no hosted image result.', 'invalid_response');
      return { images, cost: null };
    }
    if (request.referenceImages?.length) {
      const form = new FormData();
      form.append('prompt', request.prompt);
      appendImages(form, request.referenceImages);
      const model = configuredModel('image-generation', request.model);
      if (model) form.append('model', model);
      if (request.size) form.append('size', request.size);
      if (request.count !== undefined) form.append('n', String(request.count));
      let response: Response;
      try {
        response = await fetcher(`${baseUrl}/images/edits`, { method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: form, signal });
      } catch (cause) {
        if (signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) throw toError('Provider request cancelled locally.', 'cancelled');
        throw networkError(cause, redact);
      }
      if (!response.ok) throw await createHttpError(response, redact);
      return imageResponse(await readJson(response));
    }
    const model = configuredModel('image-generation', request.model);
    const payload = await postJson('/images/generations', { prompt: request.prompt, ...(model ? { model } : {}), ...(request.size ? { size: request.size } : {}), ...(request.count === undefined ? {} : { n: request.count }) }, signal);
    return imageResponse({
      ...payload,
      data: Array.isArray(payload.data) ? payload.data.map((entry) => {
        const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
        return { ...(typeof item.url === 'string' ? { url: redact(item.url) } : {}), ...(typeof item.b64_json === 'string' ? { b64_json: redact(item.b64_json) } : {}) };
      }) : [],
    });
  };
  const editImage = async (request: ImageEditRequest, signal?: AbortSignal): Promise<ImageResponse> => {
    if (request.tool) {
      const size = parseImageSize(request.size);
      const validation = validateProviderToolCapability({
        tool: request.tool,
        hasMask: Boolean(request.mask),
        requiresTransparency: request.requiresTransparency,
        width: request.width ?? size.width,
        height: request.height ?? size.height,
        bytes: request.bytes,
        params: request.toolParams,
      }, toolCapabilities);
      if (!validation.ok) throw capabilityError(validation.reason);
    }
    if (imageTransport === 'responses') {
      const model = configuredModel('image-editing', request.model);
      const payload = await postJson('/responses', {
        ...(model ? { model } : {}),
        input: [{
          role: 'user',
          content: [
            { type: 'input_image', image_url: await blobDataUrl(request.image) },
            ...await Promise.all((request.referenceImages ?? []).map(async (image) => ({ type: 'input_image', image_url: await blobDataUrl(image) }))),
            ...(request.mask ? [{ type: 'input_image', image_url: await blobDataUrl(request.mask) }] : []),
            { type: 'input_text', text: editInstruction(request) },
          ],
        }],
        tools: [{ type: 'image_generation', ...(request.size ? { size: request.size } : {}) }],
        tool_choice: { type: 'image_generation' },
      }, signal);
      const images = responsesImages(payload);
      if (images.length === 0) throw toError('Provider returned no hosted image result.', 'invalid_response');
      return { images, cost: null };
    }
    const form = new FormData();
    form.append('prompt', request.prompt);
    appendImages(form, [request.image, ...(request.referenceImages ?? [])]);
    if (request.mask) form.append('mask', request.mask);
    if (request.tool) form.append('tool', request.tool);
    if (request.toolParams) form.append('tool_params', JSON.stringify(request.toolParams));
    if (request.region) form.append('region', JSON.stringify(request.region));
    const model = configuredModel('image-editing', request.model);
    if (model) form.append('model', model);
    if (request.size) form.append('size', request.size);
    let response: Response;
    try {
      response = await fetcher(`${baseUrl}/images/edits`, { method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: form, signal });
    } catch (cause) {
      if (signal?.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) throw toError('Provider request cancelled locally.', 'cancelled');
      throw networkError(cause, redact);
    }
    if (!response.ok) throw await createHttpError(response, redact);
    const payload = await readJson(response);
    return imageResponse({
      ...payload,
      data: Array.isArray(payload.data) ? payload.data.map((entry) => {
        const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
        return { ...(typeof item.url === 'string' ? { url: redact(item.url) } : {}), ...(typeof item.b64_json === 'string' ? { b64_json: redact(item.b64_json) } : {}) };
      }) : [],
    });
  };
  return { capabilities: providerCapabilities, toolCapabilities, chat, streamChat, analyzeVision, generateImage, editImage };
};
