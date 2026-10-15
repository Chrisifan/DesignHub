import { expect, it, vi } from 'vitest';

import { runLiveProviderSmoke } from './live-smoke';

const candidate = {
  name: { zh: '纸感', en: 'Paper' },
  signature: { zh: '纸张与秩序', en: 'Paper and order' },
  summary: { zh: '克制的纸感排版', en: 'Restrained paper typography' },
  principle: { zh: '保留留白', en: 'Preserve generous whitespace' },
  tags: [{ zh: '编辑感', en: 'Editorial' }],
  styleDna: {
    palette: ['#F5F0E6', '#242424'],
    typography: { zh: '高对比衬线体', en: 'High-contrast serif' },
    composition: { zh: '对称网格', en: 'Symmetrical grid' },
    texture: { zh: '粗粝纸张', en: 'Rough paper' },
    signals: {
      contrast: 68,
      darkAiriness: 82,
      whitespace: 38,
      grain: 15,
      diffuseLight: 92,
      typeFamily: { zh: '宋体倾向', en: 'Serif tendency' },
      typeWeight: { zh: '半粗体', en: 'Semibold' },
      tracking: { zh: '紧凑', en: 'Compact' },
      compositionTopology: { zh: '非对称垂直流', en: 'Asymmetric vertical flow' },
      rendering: { zh: '柔和纸张漫反射', en: 'Soft paper diffusion' },
    },
  },
  negativeRules: [{ zh: '避免霓虹渐变', en: 'Avoid neon gradients' }],
};

it('runs all live capabilities through the production adapter and task service', async () => {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/chat/completions')) {
      const body = JSON.parse(String(init?.body)) as { stream?: boolean; messages?: Array<{ content?: unknown }> };
      if (body.stream) {
        return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }
      const isVision = Array.isArray(body.messages?.[0]?.content);
      return new Response(JSON.stringify({ choices: [{ message: { content: isVision ? JSON.stringify({ candidates: [candidate] }) : 'ok' } }], cost: 0.01 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ data: [{ b64_json: 'aW1hZ2U=' }], cost: 0.02 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  const report = await runLiveProviderSmoke({
    baseUrl: 'https://provider.example/v1',
    apiKey: 'live-secret',
    models: {
      conversation: 'chat-model',
      vision: 'vision-model',
      imageGeneration: 'image-model',
      imageEditing: 'edit-model',
    },
    fetch: fetcher,
  });

  expect(report.status).toBe('passed');
  expect(report.checks.map((check) => check.name)).toEqual(['conversation', 'vision-analysis', 'image-generation', 'image-editing']);
  expect(report.checks.every((check) => check.status === 'passed')).toBe(true);
  expect(JSON.stringify(report)).not.toContain('live-secret');
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/chat/completions'), expect.any(Object));
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/images/generations'), expect.any(Object));
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/images/edits'), expect.any(Object));
});

it('times out through task cancellation without exposing the API key', async () => {
  const fetcher = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('live-secret timeout', 'AbortError')), { once: true });
  }));

  const report = await runLiveProviderSmoke({
    baseUrl: 'https://provider.example/v1',
    apiKey: 'live-secret',
    models: {
      conversation: 'chat-model',
      vision: 'vision-model',
      imageGeneration: 'image-model',
      imageEditing: 'edit-model',
    },
    fetch: fetcher,
    timeoutMs: 5,
  });

  expect(report.status).toBe('failed');
  expect(report.checks.every((check) => check.error === 'TIMEOUT')).toBe(true);
  expect(report.checks.every((check) => check.remoteCancellation === 'unavailable')).toBe(true);
  expect(JSON.stringify(report)).not.toContain('live-secret');
});
