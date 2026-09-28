import { describe, expect, it } from 'vitest';

import { rasterizeMask, type MaskShape } from './mask-rasterizer';

describe('mask rasterizer', () => {
  it('rasterizes a rectangle into an opaque PNG mask', () => {
    const result = rasterizeMask({
      width: 4,
      height: 3,
      shapes: [{ kind: 'rectangle', region: { x: 1, y: 1, width: 2, height: 1 } }],
    });

    expect(Array.from(result.pixels)).toEqual([
      0, 0, 0, 0,
      0, 255, 255, 0,
      0, 0, 0, 0,
    ]);
    expect(Array.from(result.bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(result.mimeType).toBe('image/png');
  });

  it('rasterizes a brush stroke and clips it to image bounds', () => {
    const shape: MaskShape = { kind: 'brush', points: [{ x: -1, y: 1 }, { x: 2, y: 1 }], radius: 1.5 };
    const result = rasterizeMask({ width: 3, height: 3, shapes: [shape] });

    expect(Array.from(result.pixels)).toEqual([
      255, 255, 255,
      255, 255, 255,
      255, 255, 0,
    ]);
  });

  it('supports a single brush point as a filled dab', () => {
    const result = rasterizeMask({ width: 3, height: 3, shapes: [{ kind: 'brush', points: [{ x: 1.5, y: 1.5 }], radius: 0.6 }] });
    expect(Array.from(result.pixels)).toEqual([
      0, 0, 0,
      0, 255, 0,
      0, 0, 0,
    ]);
  });

  it('rejects empty, invalid and out-of-bounds shapes', () => {
    expect(() => rasterizeMask({ width: 2, height: 2, shapes: [] })).toThrow('MASK_EMPTY');
    expect(() => rasterizeMask({ width: 2, height: 2, shapes: [{ kind: 'rectangle', region: { x: 0, y: 0, width: 0, height: 1 } }] })).toThrow('MASK_EMPTY');
    expect(() => rasterizeMask({ width: 2, height: 2, shapes: [{ kind: 'brush', points: [], radius: 2 }] })).toThrow('MASK_EMPTY');
    expect(() => rasterizeMask({ width: 0, height: 2, shapes: [] })).toThrow('MASK_DIMENSIONS_INVALID');
  });
});
