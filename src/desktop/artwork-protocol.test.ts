import { expect, it, vi } from 'vitest';

import { createDesignerArtworkProtocolHandler } from './artwork-protocol';

const workspace = {
  workspace: { workspaceId: 'workspace-1' },
} as never;

it('serves active-workspace artwork bytes without exposing its storage path', async () => {
  const readArtwork = vi.fn(async () => ({
    artworkId: 'artwork-portrait-1',
    dataUrl: 'data:image/png;base64,AQID',
  }));
  const handler = createDesignerArtworkProtocolHandler(
    () => workspace,
    readArtwork,
  );

  const response = await handler({
    url: 'designhub-artwork://artwork-portrait-1',
  });

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('image/png');
  expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
  expect(readArtwork).toHaveBeenCalledWith(
    workspace,
    'workspace-1',
    'artwork-portrait-1',
  );
});

it('serves artwork when Electron normalizes the standard URL to a root path', async () => {
  const readArtwork = vi.fn(async () => ({
    artworkId: 'artwork-portrait-1',
    dataUrl: 'data:image/png;base64,AQID',
  }));
  const handler = createDesignerArtworkProtocolHandler(
    () => workspace,
    readArtwork,
  );

  const response = await handler({
    url: 'designhub-artwork://artwork-portrait-1/',
  });

  expect(response.status).toBe(200);
  expect(readArtwork).toHaveBeenCalledWith(
    workspace,
    'workspace-1',
    'artwork-portrait-1',
  );
});

it('does not read a valid artwork URL before a workspace is active', async () => {
  const readArtwork = vi.fn();
  const handler = createDesignerArtworkProtocolHandler(() => null, readArtwork);

  const response = await handler({
    url: 'designhub-artwork://artwork-portrait-1',
  });

  expect(response.status).toBe(404);
  expect(readArtwork).not.toHaveBeenCalled();
});

it('rejects malformed artwork URLs before storage access', async () => {
  const readArtwork = vi.fn();
  const handler = createDesignerArtworkProtocolHandler(() => workspace, readArtwork);

  const response = await handler({
    url: 'designhub-artwork://artwork-portrait-1/other.png',
  });

  expect(response.status).toBe(404);
  expect(readArtwork).not.toHaveBeenCalled();
});
