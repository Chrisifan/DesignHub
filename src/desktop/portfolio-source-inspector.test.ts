import { zipSync } from 'fflate';
import sharp from 'sharp';
import { expect, it, vi } from 'vitest';

import { createPortfolioSourceInspector } from './portfolio-source-inspector';

const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64'));

it('rejects ZIP entries that escape the explicitly selected archive', async () => {
  const inspector = createPortfolioSourceInspector({
    readFile: async () => zipSync({ '../outside.png': png }),
  });

  await expect(inspector.inspectZip('/chosen/references.zip')).rejects.toThrow('PORTFOLIO_ARCHIVE_PATH_INVALID');
});

it('rejects a ZIP archive with more inspectable images than the portfolio source limit', async () => {
  const inspector = createPortfolioSourceInspector({
    readFile: async () => zipSync(Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`sheet-${index}.png`, png]))),
  });

  await expect(inspector.inspectZip('/chosen/references.zip')).rejects.toThrow('PORTFOLIO_SOURCE_LIMIT');
});

it('returns only explicitly selected sources and clears their transient session on cancellation', async () => {
  const inspector = createPortfolioSourceInspector({
    readFile: async () => png,
  });
  const inspection = await inspector.inspectLocalImages(['/chosen/cover.png', '/chosen/detail.png']);

  await expect(inspector.selectedSources(inspection.id, [inspection.candidates[1]!.id])).resolves.toMatchObject([
    { id: inspection.candidates[1]!.id, image: { base64: expect.any(String), mimeType: 'image/jpeg' } },
  ]);
  inspector.discard(inspection.id);
  await expect(inspector.selectedSources(inspection.id, [inspection.candidates[0]!.id])).rejects.toThrow('PORTFOLIO_INSPECTION_NOT_FOUND');
});

it('normalizes selected images through the vision-image hook before returning them', async () => {
  const normalizeImage = vi.fn(async ({ mimeType }: { bytes: Uint8Array; mimeType: string }) => ({
    bytes: new Uint8Array([255, 216, 255, 217]),
    mimeType: mimeType === 'image/png' ? 'image/jpeg' : mimeType,
  }));
  const inspector = createPortfolioSourceInspector({
    readFile: async () => png,
    normalizeImage,
  });
  const inspection = await inspector.inspectLocalImages(['/chosen/cover.png']);

  await expect(inspector.selectedSources(inspection.id, [inspection.candidates[0]!.id])).resolves.toEqual([{
    id: inspection.candidates[0]!.id,
    description: 'cover.png',
    image: { base64: '/9j/2Q==', mimeType: 'image/jpeg' },
  }]);
  expect(normalizeImage).toHaveBeenCalledWith({ bytes: png, mimeType: 'image/png' });
});

it('resizes large selected images to a bounded JPEG for vision analysis', async () => {
  const largePng = new Uint8Array(await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: '#d83a2f' },
  }).png().toBuffer());
  const inspector = createPortfolioSourceInspector({
    readFile: async () => largePng,
  });
  const inspection = await inspector.inspectLocalImages(['/chosen/large.png']);

  const [source] = await inspector.selectedSources(inspection.id, [inspection.candidates[0]!.id]);
  expect(source?.image).toMatchObject({ base64: expect.any(String), mimeType: 'image/jpeg' });
  if (!source || 'url' in source.image) throw new Error('Expected a normalized inline image');
  await expect(sharp(Buffer.from(source.image.base64, 'base64')).metadata()).resolves.toMatchObject({
    width: 1600,
    height: 800,
    format: 'jpeg',
  });
});
