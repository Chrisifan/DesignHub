export type Region = { x: number; y: number; width: number; height: number };
export type ImageSize = { width: number; height: number };

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const isRegionInside = (region: Region, image: ImageSize): boolean => (
  [region.x, region.y, region.width, region.height, image.width, image.height].every(finite)
  && image.width > 0 && image.height > 0
  && region.x >= 0 && region.y >= 0 && region.width > 0 && region.height > 0
  && region.x + region.width <= image.width
  && region.y + region.height <= image.height
);

export const normalizeRegion = (start: { x: number; y: number }, end: { x: number; y: number }): Region => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
});

