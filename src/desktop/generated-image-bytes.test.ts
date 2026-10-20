import { expect, it, vi } from 'vitest';

import { generatedImageBytes } from './generated-image-bytes';

it('downloads generated image URLs and preserves their image content type', async () => {
  const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { 'content-type': 'image/webp; charset=binary' },
  }));

  await expect(generatedImageBytes({ url: 'https://images.example/generated.webp' }, fetcher)).resolves.toEqual({
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: 'image/webp',
  });
});

it('reports successful non-image URL responses distinctly', async () => {
  const fetcher = vi.fn(async () => new Response('<html>sign in</html>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  }));

  await expect(generatedImageBytes({ url: 'https://images.example/generated' }, fetcher)).rejects.toThrow('GENERATED_IMAGE_URL_NOT_IMAGE');
});

it('retains the HTTP status when a generated image URL cannot be downloaded', async () => {
  const fetcher = vi.fn(async () => new Response('missing', { status: 403 }));

  await expect(generatedImageBytes({ url: 'https://images.example/generated' }, fetcher)).rejects.toThrow('GENERATED_IMAGE_URL_HTTP_403');
});

it('retains only safe host and network error metadata when URL download fails', async () => {
  const cause = Object.assign(new Error('connection reset for https://images.example/private?token=secret'), { code: 'ECONNRESET' });
  const fetcher = vi.fn(async () => { throw cause; });

  await expect(generatedImageBytes({ url: 'https://images.example/private?token=secret' }, fetcher)).rejects.toMatchObject({
    message: 'GENERATED_IMAGE_URL_FETCH_FAILED',
    diagnostic: { host: 'images.example', causeName: 'ERROR', causeCode: 'ECONNRESET' },
  });
});

it('accepts provider base64 image data without an additional request', async () => {
  const fetcher = vi.fn();

  await expect(generatedImageBytes({ base64: 'aW1hZ2U=', mimeType: 'image/png' }, fetcher)).resolves.toEqual({
    bytes: new Uint8Array(Buffer.from('aW1hZ2U=', 'base64')),
    mimeType: 'image/png',
  });
  expect(fetcher).not.toHaveBeenCalled();
});
