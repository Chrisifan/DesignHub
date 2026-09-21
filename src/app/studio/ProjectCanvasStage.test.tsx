import { describe, expect, it } from 'vitest';
import { centerNodeInViewport, layoutProjectDesigns, panViewport, zoomAroundPointer } from './ProjectCanvasStage';

const designs = [
  { id: 'a', width: 400, height: 300 },
  { id: 'b', width: 400, height: 300 },
  { id: 'c', width: 400, height: 300 },
];

describe('project canvas math', () => {
  it('lays designs left to right and wraps at the maximum width', () => {
    const positions = layoutProjectDesigns(designs, { maxWidth: 900, gap: 24 });
    expect(positions).toEqual({
      a: { x: 0, y: 0 },
      b: { x: 424, y: 0 },
      c: { x: 0, y: 324 },
    });
  });

  it('zooms around the pointer without moving the content under the pointer', () => {
    expect(zoomAroundPointer({ zoom: 1, offsetX: 0, offsetY: 0 }, { x: 200, y: 100 }, 2)).toEqual({ zoom: 2, offsetX: -200, offsetY: -100 });
  });

  it('pans the viewport and centers a node in the stage', () => {
    expect(panViewport({ zoom: 1, offsetX: 10, offsetY: 20 }, { x: 5, y: -10 })).toEqual({ zoom: 1, offsetX: 15, offsetY: 10 });
    expect(centerNodeInViewport({ x: 400, y: 300, width: 200, height: 100 }, { width: 1000, height: 700 }, 1)).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
  });
});
