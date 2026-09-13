import { zipSync } from 'fflate';
import { expect, it, vi } from 'vitest';

import { createPortfolioSourceInspector } from './portfolio-source-inspector';

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const response = (status: number, headers: Record<string, string>, body = png) => ({
  status,
  headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
});

it('rejects ZIP entries that escape the explicitly selected archive', async () => {
  const inspector = createPortfolioSourceInspector({
    readFile: async () => zipSync({ '../outside.png': png }),
    resolvePublicAddresses: async () => ['8.8.8.8'],
    fetch: vi.fn(),
  });

  await expect(inspector.inspectZip('/chosen/references.zip')).rejects.toThrow('PORTFOLIO_ARCHIVE_PATH_INVALID');
});

it('rejects a ZIP archive with more inspectable images than the portfolio source limit', async () => {
  const inspector = createPortfolioSourceInspector({
    readFile: async () => zipSync(Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`sheet-${index}.png`, png]))),
    resolvePublicAddresses: async () => ['8.8.8.8'],
    fetch: vi.fn(),
  });

  await expect(inspector.inspectZip('/chosen/references.zip')).rejects.toThrow('PORTFOLIO_SOURCE_LIMIT');
});

it('rejects private remote addresses before fetch and after a redirect', async () => {
  const privateFetch = vi.fn();
  const privateInspector = createPortfolioSourceInspector({
    readFile: vi.fn(),
    resolvePublicAddresses: async () => ['127.0.0.1'],
    fetch: privateFetch,
  });
  await expect(privateInspector.inspectRemoteImage('https://private.test/cover.png')).rejects.toThrow('PORTFOLIO_REMOTE_ADDRESS_FORBIDDEN');
  expect(privateFetch).not.toHaveBeenCalled();

  const redirectFetch = vi.fn(async () => response(302, { location: 'https://internal.test/cover.png' }));
  const redirectInspector = createPortfolioSourceInspector({
    readFile: vi.fn(),
    resolvePublicAddresses: async (hostname) => hostname === 'public.test' ? ['8.8.8.8'] : ['127.0.0.1'],
    fetch: redirectFetch,
  });
  await expect(redirectInspector.inspectRemoteImage('https://public.test/cover.png')).rejects.toThrow('PORTFOLIO_REMOTE_ADDRESS_FORBIDDEN');
  expect(redirectFetch).toHaveBeenCalledTimes(1);
});

it('rejects non-public IPv6 DNS answers before fetch and after redirects', async () => {
  for (const address of ['fea0::1', 'ff02::1', '::ffff:10.0.0.1']) {
    const fetch = vi.fn();
    const inspector = createPortfolioSourceInspector({
      readFile: vi.fn(),
      resolvePublicAddresses: async () => [address],
      fetch,
    });
    await expect(inspector.inspectRemoteImage('https://blocked.test/cover.png')).rejects.toThrow('PORTFOLIO_REMOTE_ADDRESS_FORBIDDEN');
    expect(fetch).not.toHaveBeenCalled();
  }

  const fetch = vi.fn(async () => response(302, { location: 'https://redirect-blocked.test/cover.png' }));
  const inspector = createPortfolioSourceInspector({
    readFile: vi.fn(),
    resolvePublicAddresses: async (hostname) => hostname === 'public.test' ? ['2001:4860:4860::8888'] : ['ff01::1'],
    fetch,
  });
  await expect(inspector.inspectRemoteImage('https://public.test/cover.png')).rejects.toThrow('PORTFOLIO_REMOTE_ADDRESS_FORBIDDEN');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('offers only statically visible page image candidates', async () => {
  const html = [
    '<!-- <img src="/comment.png" alt="Comment"> -->',
    '<script>const markup = \'<img src="/script.png" alt="Script">\';</script>',
    '<style>.preview::before { content: \'<img src="/style.png" alt="Style">\'; }</style>',
    '<template><img src="/template.png" alt="Template"></template>',
    '<section hidden><img src="/hidden.png" alt="Hidden"></section>',
    '<div aria-hidden="true"><span><img src="/aria-hidden.png" alt="Aria hidden"></span></div>',
    '<aside style="display: none"><img src="/display-none.png" alt="Display none"></aside>',
    '<div style="visibility: hidden"><img src="/visibility-hidden.png" alt="Visibility hidden"></div>',
    '<img src="/zero-style.png" alt="Zero style" style="width: 0px">',
    '<img src="/zero-attribute.png" alt="Zero attribute" height="0">',
    '<input hidden name="csrf">',
    '<img src="/visible.png" alt="Visible work">',
  ].join('');
  const inspector = createPortfolioSourceInspector({
    readFile: vi.fn(),
    resolvePublicAddresses: async () => ['8.8.8.8'],
    fetch: async () => response(200, { 'content-type': 'text/html' }, new TextEncoder().encode(html)),
  });

  const inspection = await inspector.inspectRemotePage('https://public.test/work');
  expect(inspection.candidates).toEqual([expect.objectContaining({
    label: 'Visible work',
    origin: 'page-image',
  })]);
});

it('defers page image downloads until an explicitly selected candidate is submitted', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response(200, { 'content-type': 'text/html' }, new TextEncoder().encode('<img src="https://images.test/cover.png" alt="Cover">')))
    .mockResolvedValueOnce(response(200, { 'content-type': 'image/png' }));
  const inspector = createPortfolioSourceInspector({
    readFile: vi.fn(),
    resolvePublicAddresses: async () => ['8.8.8.8'],
    fetch,
  });

  const inspection = await inspector.inspectRemotePage('https://public.test/work');
  expect(inspection.candidates).toMatchObject([{ label: 'Cover', origin: 'page-image' }]);
  expect(fetch).toHaveBeenCalledTimes(1);
  await expect(inspector.selectedSources(inspection.id, [inspection.candidates[0]!.id])).resolves.toMatchObject([
    { image: { base64: expect.any(String), mimeType: 'image/png' } },
  ]);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('rejects remote bytes that do not match their declared image content type', async () => {
  const inspector = createPortfolioSourceInspector({
    readFile: vi.fn(),
    resolvePublicAddresses: async () => ['8.8.8.8'],
    fetch: async () => response(200, { 'content-type': 'image/png' }, new TextEncoder().encode('not an image')),
  });

  await expect(inspector.inspectRemoteImage('https://public.test/cover.png')).rejects.toThrow('PORTFOLIO_IMAGE_BYTES_INVALID');
});

it('returns only explicitly selected sources and clears their transient session on cancellation', async () => {
  const inspector = createPortfolioSourceInspector({
    readFile: async () => png,
    resolvePublicAddresses: async () => ['8.8.8.8'],
    fetch: vi.fn(),
  });
  const inspection = await inspector.inspectLocalImages(['/chosen/cover.png', '/chosen/detail.png']);

  await expect(inspector.selectedSources(inspection.id, [inspection.candidates[1]!.id])).resolves.toMatchObject([
    { id: inspection.candidates[1]!.id, image: { base64: expect.any(String), mimeType: 'image/png' } },
  ]);
  inspector.discard(inspection.id);
  await expect(inspector.selectedSources(inspection.id, [inspection.candidates[0]!.id])).rejects.toThrow('PORTFOLIO_INSPECTION_NOT_FOUND');
});
