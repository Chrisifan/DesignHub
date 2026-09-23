import { describe, expect, it, vi } from 'vitest';

import {
  createLocalCancellation,
  createOpenAICompatibleAdapter,
  providerCapabilityMatrix,
} from './adapter';

const response = (body: unknown, status = 200, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
const jpegBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD';

describe('OpenAI-compatible provider adapter', () => {
  it('exposes an explicit capability matrix', () => {
    expect(providerCapabilityMatrix).toEqual({
      conversation: true,
      'vision-analysis': true,
      'image-generation': true,
      'image-editing': true,
    });
    expect(createOpenAICompatibleAdapter({ baseUrl: 'https://example.test/v1', apiKey: 'secret-key' }).capabilities).toEqual([
      'conversation', 'vision-analysis', 'image-generation', 'image-editing',
    ]);
  });

  it('sends non-streaming chat requests without exposing the API key', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://example.test/v1/chat/completions');
      expect(init?.headers).toEqual({ authorization: 'Bearer secret-key', 'content-type': 'application/json' });
      expect(JSON.stringify(init?.body)).not.toContain('secret-key');
      return response({ choices: [{ message: { role: 'assistant', content: 'hello' } }], usage: { total_tokens: 4 } });
    });
    const adapter = createOpenAICompatibleAdapter({ baseUrl: 'https://example.test/v1', apiKey: 'secret-key', fetch: fetcher });

    await expect(adapter.chat({ messages: [{ role: 'user', content: 'hi' }] })).resolves.toMatchObject({ text: 'hello', usage: { totalTokens: 4 }, cost: null });
  });

  it('uses the configured default model for each provider capability', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      if (typeof init?.body === 'string') bodies.push(JSON.parse(init.body) as Record<string, unknown>);
      return response({ choices: [{ message: { content: 'ok' } }], data: [{ b64_json: 'generated' }] });
    });
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret-key',
      models: { conversation: 'chat-model', 'vision-analysis': 'vision-model', 'image-generation': 'image-model' },
      fetch: fetcher,
    });

    await adapter.chat({ messages: [{ role: 'user', content: 'hi' }] });
    await adapter.analyzeVision({ prompt: 'describe', images: [{ url: 'https://img.test/a.png' }] });
    await adapter.generateImage({ prompt: 'a poster' });

    expect(bodies.map((body) => body.model)).toEqual(['chat-model', 'vision-model', 'image-model']);
  });

  it('parses SSE chat deltas and terminates at [DONE]', async () => {
    const stream = new ReadableStream({
      start: (controller) => {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"he"}}]}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"llo"}}]}\n\ndata: [DONE]\n\n'));
        controller.close();
      },
    });
    const fetcher = vi.fn(async () => new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }));
    const adapter = createOpenAICompatibleAdapter({ baseUrl: 'https://example.test/v1', apiKey: 'secret-key', fetch: fetcher });
    const deltas: string[] = [];

    for await (const event of adapter.streamChat({ messages: [{ role: 'user', content: 'hi' }] })) deltas.push(event.text);

    expect(deltas).toEqual(['he', 'llo']);
  });

  it('parses a non-stream JSON chat response when a provider ignores stream mode', async () => {
    const fetcher = vi.fn(async () => response({ choices: [{ message: { role: 'assistant', content: 'fallback response' } }] }));
    const adapter = createOpenAICompatibleAdapter({ baseUrl: 'https://example.test/v1', apiKey: 'secret-key', fetch: fetcher });
    const events: string[] = [];

    for await (const event of adapter.streamChat({ messages: [{ role: 'user', content: 'hi' }] })) events.push(event.text);

    expect(events).toEqual(['fallback response']);
  });

  it('preserves structured rate-limit errors for streaming requests', async () => {
    const fetcher = vi.fn(async () => response({ error: { message: 'slow down', code: 'rate_limit_exceeded' } }, 429, { 'retry-after': '7' }));
    const adapter = createOpenAICompatibleAdapter({ baseUrl: 'https://example.test/v1', apiKey: 'secret-key', fetch: fetcher });

    const iterator = adapter.streamChat({ messages: [{ role: 'user', content: 'hi' }] })[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toMatchObject({ kind: 'rate_limited', status: 429, retryAfterSeconds: 7 });
  });

  it('rejects malformed SSE frames as invalid provider responses', async () => {
    const stream = new ReadableStream({
      start: (controller) => {
        controller.enqueue(new TextEncoder().encode('data: {not-json}\n\n'));
        controller.close();
      },
    });
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret-key',
      fetch: vi.fn(async () => new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })),
    });

    const iterator = adapter.streamChat({ messages: [{ role: 'user', content: 'hi' }] })[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('sends all portfolio images in one vision request', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(init).toBeDefined();
      if (url.endsWith('/chat/completions')) return response({ choices: [{ message: { content: 'vision result' } }] });
      if (url.endsWith('/images/generations')) return response({ data: [{ b64_json: 'generated' }] });
      return response({ data: [{ url: 'https://cdn.test/edited.png' }] });
    });
    const adapter = createOpenAICompatibleAdapter({ baseUrl: 'https://example.test/v1', apiKey: 'secret-key', fetch: fetcher });

    await expect(adapter.analyzeVision({
      prompt: 'describe selected work',
      images: [
        { url: 'https://img.test/a.png' },
        { base64: pngBase64, mimeType: 'image/png' },
      ],
    })).resolves.toMatchObject({ text: 'vision result' });
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as { messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }> };
    expect(body.messages[0]?.content).toEqual([
      { type: 'text', text: 'describe selected work' },
      { type: 'image_url', image_url: { url: 'https://img.test/a.png' } },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${pngBase64}` } },
    ]);
    await expect(adapter.generateImage({ prompt: 'a poster' })).resolves.toMatchObject({ images: [{ base64: 'generated' }], cost: null });
    await expect(adapter.editImage({ prompt: 'remove logo', image: new Blob(['image']) })).resolves.toMatchObject({ images: [{ url: 'https://cdn.test/edited.png' }] });
  });

  it('uses a custom Responses endpoint and parses hosted image tool output', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://gateway.example.test/openai/v1/responses');
      expect(init?.headers).toEqual({ authorization: 'Bearer secret-key', 'content-type': 'application/json' });
      expect(JSON.parse(String(init?.body))).toEqual({
        model: 'gpt-5.6-terra',
        input: [{ role: 'user', content: [{ type: 'input_text', text: 'A minimal poster' }] }],
        tools: [{ type: 'image_generation', size: '1024x1024' }],
        tool_choice: { type: 'image_generation' },
      });
      return response({ output: [{ type: 'image_generation_call', result: pngBase64 }] });
    });
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: 'https://gateway.example.test/openai/v1',
      apiKey: 'secret-key',
      imageTransport: 'responses',
      models: { 'image-generation': 'gpt-5.6-terra' },
      fetch: fetcher,
    });

    await expect(adapter.generateImage({ prompt: 'A minimal poster', size: '1024x1024' })).resolves.toEqual({
      images: [{ base64: pngBase64 }],
      cost: null,
    });
  });

  it('includes reference images in Responses image generation requests', async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as { input: Array<{ content: Array<{ type: string; image_url?: string }> }> };
      expect(payload.input[0]?.content).toEqual([
        { type: 'input_image', image_url: 'data:image/png;base64,b25l' },
        { type: 'input_image', image_url: 'data:image/jpeg;base64,dHdv' },
        { type: 'input_text', text: 'Compose the supplied references' },
      ]);
      return response({ output: [{ type: 'image_generation_call', result: pngBase64 }] });
    });
    const adapter = createOpenAICompatibleAdapter({ baseUrl: 'https://gateway.example.test/v1', apiKey: 'secret-key', imageTransport: 'responses', fetch: fetcher });

    await expect(adapter.generateImage({
      prompt: 'Compose the supplied references',
      referenceImages: [new Blob(['one'], { type: 'image/png' }), new Blob(['two'], { type: 'image/jpeg' })],
    })).resolves.toMatchObject({ images: [{ base64: pngBase64 }] });
  });

  it('uses the multi-image edit endpoint for references with the Images transport', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://gateway.example.test/v1/images/edits');
      const form = init?.body as FormData;
      expect(form.get('prompt')).toBe('Compose the supplied references');
      expect(form.getAll('image[]')).toHaveLength(2);
      return response({ data: [{ b64_json: 'generated' }] });
    });
    const adapter = createOpenAICompatibleAdapter({ baseUrl: 'https://gateway.example.test/v1', apiKey: 'secret-key', fetch: fetcher });

    await expect(adapter.generateImage({
      prompt: 'Compose the supplied references',
      referenceImages: [new Blob(['one'], { type: 'image/png' }), new Blob(['two'], { type: 'image/png' })],
    })).resolves.toEqual({ images: [{ base64: 'generated' }], cost: null });
  });

  it('uses input images and explicit edit guidance with the Responses transport', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://gateway.example.test/v1/responses');
      const payload = JSON.parse(String(init?.body)) as { input: Array<{ content: Array<{ type: string; image_url?: string; text?: string }> }> };
      expect(payload.input[0]?.content).toEqual(expect.arrayContaining([
        { type: 'input_image', image_url: 'data:image/png;base64,c291cmNl' },
        { type: 'input_image', image_url: 'data:image/png;base64,bWFzaw==' },
        expect.objectContaining({ type: 'input_text', text: expect.stringContaining('remove-object') }),
      ]));
      expect(payload.input[0]?.content.find((item) => item.type === 'input_text')?.text).toContain('"feather":12');
      expect(payload.input[0]?.content.find((item) => item.type === 'input_text')?.text).toContain('"width":30');
      return response({ output: [{ type: 'image_generation_call', result: pngBase64 }] });
    });
    const adapter = createOpenAICompatibleAdapter({ baseUrl: 'https://gateway.example.test/v1', apiKey: 'secret-key', imageTransport: 'responses', fetch: fetcher });

    await expect(adapter.editImage({
      prompt: 'Remove the selected object',
      image: new Blob(['source'], { type: 'image/png' }),
      mask: new Blob(['mask'], { type: 'image/png' }),
      tool: 'remove-object',
      toolParams: { feather: 12 },
      region: { x: 1, y: 2, width: 30, height: 40 },
    })).resolves.toEqual({ images: [{ base64: pngBase64 }], cost: null });
  });

  it('rejects unsupported multi-image Responses requests before making a network call', async () => {
    const fetcher = vi.fn();
    const adapter = createOpenAICompatibleAdapter({ baseUrl: 'https://gateway.example.test/v1', apiKey: 'secret-key', imageTransport: 'responses', fetch: fetcher });

    await expect(adapter.generateImage({ prompt: 'A poster', count: 2 })).rejects.toThrow('RESPONSES_IMAGE_COUNT_UNSUPPORTED');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects Responses payloads without a hosted image result', async () => {
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: 'https://gateway.example.test/v1',
      apiKey: 'secret-key',
      imageTransport: 'responses',
      fetch: vi.fn(async () => response({ output: [{ type: 'message', content: [] }] })),
    });

    await expect(adapter.generateImage({ prompt: 'A poster' })).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('rejects a hosted image result that is not base64', async () => {
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: 'https://gateway.example.test/v1',
      apiKey: 'secret-key',
      imageTransport: 'responses',
      fetch: vi.fn(async () => response({ output: [{ type: 'image_generation_call', result: 'not-base64' }] })),
    });

    await expect(adapter.generateImage({ prompt: 'A poster' })).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('rejects an empty hosted Base64 result', async () => {
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: 'https://gateway.example.test/v1',
      apiKey: 'secret-key',
      imageTransport: 'responses',
      fetch: vi.fn(async () => response({ output: [{ type: 'image_generation_call', result: '' }] })),
    });

    await expect(adapter.generateImage({ prompt: 'A poster' })).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('accepts a valid non-PNG Responses image data URL and preserves its MIME type', async () => {
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: 'https://gateway.example.test/v1',
      apiKey: 'secret-key',
      imageTransport: 'responses',
      fetch: vi.fn(async () => response({ output: [{ type: 'image_generation_call', result: `data:image/jpeg;base64,${jpegBase64}` }] })),
    });

    await expect(adapter.generateImage({ prompt: 'A poster' })).resolves.toEqual({
      images: [{ base64: jpegBase64, mimeType: 'image/jpeg' }],
      cost: null,
    });
  });

  it('maps an aborted Responses image request to local cancellation', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      throw new DOMException('Request aborted', 'AbortError');
    });
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: 'https://gateway.example.test/v1',
      apiKey: 'secret-key',
      imageTransport: 'responses',
      fetch: fetcher,
    });
    controller.abort();

    await expect(adapter.generateImage({ prompt: 'A poster' }, controller.signal)).rejects.toMatchObject({ kind: 'cancelled' });
  });

  it('redacts the API key from Responses provider errors', async () => {
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: 'https://gateway.example.test/v1',
      apiKey: 'secret-key',
      imageTransport: 'responses',
      fetch: vi.fn(async () => response({ error: { message: 'Request rejected for secret-key' } }, 401)),
    });

    await expect(adapter.generateImage({ prompt: 'A poster' })).rejects.toMatchObject({
      kind: 'http',
      message: 'Request rejected for [redacted]',
    });
  });

  it('sends image tool metadata, parameters, and region with edit requests', async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const form = init?.body as FormData;
      expect(form.get('tool')).toBe('remove-object');
      expect(form.get('tool_params')).toBe(JSON.stringify({ feather: 12 }));
      expect(form.get('region')).toBe(JSON.stringify({ x: 1, y: 2, width: 30, height: 40 }));
      return response({ data: [] });
    });
    const adapter = createOpenAICompatibleAdapter({ baseUrl: 'https://example.test/v1', apiKey: 'secret-key', fetch: fetcher });
    await adapter.editImage({ prompt: 'remove object', image: new Blob(['image']), tool: 'remove-object', toolParams: { feather: 12 }, region: { x: 1, y: 2, width: 30, height: 40 } });
  });

  it('reports rate limits without leaking credentials and exposes local-only cancellation', async () => {
    const fetcher = vi.fn(async () => response({ error: { message: 'slow down', code: 'rate_limit_exceeded' } }, 429, { 'retry-after': '3' }));
    const adapter = createOpenAICompatibleAdapter({ baseUrl: 'https://example.test/v1', apiKey: 'secret-key', fetch: fetcher });

    await expect(adapter.chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toMatchObject({ kind: 'rate_limited', retryAfterSeconds: 3 });
    await expect(adapter.chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.not.toThrow('secret-key');

    const cancellation = createLocalCancellation();
    expect(cancellation.remoteCancellation).toBe(false);
    cancellation.cancel();
    expect(cancellation.signal.aborted).toBe(true);
  });

  it('redacts credentials from injected network failures', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('request failed for secret-key'); });
    const adapter = createOpenAICompatibleAdapter({ baseUrl: 'https://example.test/v1', apiKey: 'secret-key', fetchImpl });

    await expect(adapter.chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toMatchObject({ message: 'request failed for [redacted]' });
  });
});
