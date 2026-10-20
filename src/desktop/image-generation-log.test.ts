import { expect, it, vi } from 'vitest';

import { appendImageResponseLog } from './image-generation-log';

it('appends a bounded image response summary to the local diagnostics log', async () => {
  const makeDirectory = vi.fn(async () => undefined);
  const append = vi.fn(async () => undefined);

  await appendImageResponseLog('/profile/logs', {
    path: '/images/generations',
    status: 200,
    contentType: 'application/json',
    payloadKeys: ['data'],
    dataCount: 1,
    images: [{ keys: ['url'], url: 'https://cdn.example/generated.png?sig=temporary', urlHost: 'cdn.example', hasBase64: false, base64Length: 0 }],
  }, { makeDirectory, append, timestamp: '2026-10-20T04:00:00.000Z' });

  expect(makeDirectory).toHaveBeenCalledWith('/profile/logs', { recursive: true });
  expect(append).toHaveBeenCalledWith('/profile/logs/image-generation.jsonl', `${JSON.stringify({
    timestamp: '2026-10-20T04:00:00.000Z',
    path: '/images/generations',
    status: 200,
    contentType: 'application/json',
    payloadKeys: ['data'],
    dataCount: 1,
    images: [{ keys: ['url'], url: 'https://cdn.example/generated.png?sig=temporary', urlHost: 'cdn.example', hasBase64: false, base64Length: 0 }],
  })}\n`, 'utf8');
});
