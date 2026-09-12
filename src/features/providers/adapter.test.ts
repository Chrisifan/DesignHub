import { describe, expect, it, vi } from 'vitest';

import {
  createLocalCancellation,
  createOpenAICompatibleAdapter,
  providerCapabilityMatrix,
} from './adapter';

const response = (body: unknown, status = 200, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('OpenAI-compatible provider adapter', () => {
  it('exposes an explicit capability matrix', () => {
    expect(providerCapabilityMatrix).toEqual({
      conversation: true,
      'vision-analysis': true,
      'image-generation': true,
      'image-editing': true,
    });
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

  it('supports vision, image generation, and image editing endpoints', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/chat/completions')) return response({ choices: [{ message: { content: 'vision result' } }] });
      if (url.endsWith('/images/generations')) return response({ data: [{ b64_json: 'generated' }] });
      return response({ data: [{ url: 'https://cdn.test/edited.png' }] });
    });
    const adapter = createOpenAICompatibleAdapter({ baseUrl: 'https://example.test/v1', apiKey: 'secret-key', fetch: fetcher });

    await expect(adapter.analyzeVision({ prompt: 'describe', image: { url: 'https://img.test/a.png' } })).resolves.toMatchObject({ text: 'vision result' });
    await expect(adapter.generateImage({ prompt: 'a poster' })).resolves.toMatchObject({ images: [{ base64: 'generated' }], cost: null });
    await expect(adapter.editImage({ prompt: 'remove logo', image: new Blob(['image']) })).resolves.toMatchObject({ images: [{ url: 'https://cdn.test/edited.png' }] });
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
