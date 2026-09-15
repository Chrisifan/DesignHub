import { describe, expect, it, vi } from 'vitest';

import { createOpenAICompatibleAdapter } from '../../src/features/providers/adapter';
import { createProviderConformanceHarness } from '../../src/features/providers/conformance';

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}): Response => new Response(
  JSON.stringify(body),
  { status, headers: { 'content-type': 'application/json', ...headers } },
);

const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ';

describe('provider conformance harness', () => {
  it('passes all capability checks against an OpenAI-compatible fixture', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url.endsWith('/chat/completions') && JSON.parse(String(init?.body)).stream) {
        expect(JSON.parse(String(init?.body)).model).toBe('chat-model');
        const stream = new ReadableStream({
          start: (controller) => {
            controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n'));
            controller.close();
          },
        });
        return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
      }
      if (url.endsWith('/chat/completions')) {
        const body = JSON.parse(String(init?.body)) as { model?: string; messages?: unknown[] };
        expect(body.model).toBe(Array.isArray(body.messages?.[0] && (body.messages[0] as { content?: unknown }).content) ? 'vision-model' : 'chat-model');
        return jsonResponse({ choices: [{ message: { content: 'ok' } }] });
      }
      if (url.endsWith('/images/edits')) {
        const form = init?.body as FormData;
        expect(form.get('model')).toBe('edit-model');
        expect(form.get('tool')).toBe('remove-object');
        expect(form.get('region')).toBe('{"x":0,"y":0,"width":1,"height":1}');
        return jsonResponse({ data: [{ b64_json: pngBase64 }] });
      }
      if (url.endsWith('/images/generations')) {
        expect(JSON.parse(String(init?.body)).model).toBe('image-model');
        return jsonResponse({ data: [{ b64_json: pngBase64 }] });
      }
      return jsonResponse({ choices: [{ message: { content: 'vision ok' } }] });
    });
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: 'https://fixture.example/v1',
      apiKey: 'fixture-secret',
      models: { conversation: 'chat-model', 'vision-analysis': 'vision-model', 'image-generation': 'image-model', 'image-editing': 'edit-model' },
      fetch: fetcher,
    });

    const report = await createProviderConformanceHarness(adapter).run();

    expect(report.ok).toBe(true);
    expect(report.checks.every((check) => check.ok)).toBe(true);
    expect(requests.some(({ url }) => url.endsWith('/chat/completions'))).toBe(true);
    expect(requests.some(({ url }) => url.endsWith('/images/generations'))).toBe(true);
    expect(requests.some(({ url }) => url.endsWith('/images/edits'))).toBe(true);
  });

  it('reports a failed check without throwing when the provider returns an empty image list', async () => {
    const adapter = createOpenAICompatibleAdapter({
      baseUrl: 'https://fixture.example/v1',
      apiKey: 'fixture-secret',
      fetch: vi.fn(async () => jsonResponse({ data: [] })),
    });

    const report = await createProviderConformanceHarness(adapter).run();

    expect(report.ok).toBe(false);
    expect(report.checks.some((check) => check.name === 'image-generation' && !check.ok)).toBe(true);
    expect(report.checks.every((check) => !check.error?.includes('fixture-secret'))).toBe(true);
  });

  it('contains malformed stream failures to the stream check and redacts provider errors', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/chat/completions')) {
        const stream = new ReadableStream({
          start: (controller) => {
            controller.enqueue(new TextEncoder().encode('data: {bad-json}\n\n'));
            controller.close();
          },
        });
        return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
      }
      return jsonResponse({ error: { message: 'failed fixture-secret' } }, 500);
    });
    const adapter = createOpenAICompatibleAdapter({ baseUrl: 'https://fixture.example/v1', apiKey: 'fixture-secret', fetch: fetcher });

    const report = await createProviderConformanceHarness(adapter, { redactError: (value) => value.replaceAll('fixture-secret', '[redacted]') }).run();

    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === 'stream')).toMatchObject({ ok: false });
    expect(report.checks.every((check) => !check.error?.includes('fixture-secret'))).toBe(true);
  });
});
