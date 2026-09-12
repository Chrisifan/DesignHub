import { expect, it } from 'vitest';

import { createScene } from '../canvas/scene';
import { resizeScene } from './local-transform';

it('resizes the scene and scales layer geometry proportionally', () => {
  const scene = createScene({ id: 'scene-1', width: 1000, height: 500, layers: [{ id: 'layer-1', type: 'shape', kind: 'rect', x: 100, y: 50, width: 200, height: 100, rotation: 0, opacity: 1, visible: true, locked: false, fill: '#fff', stroke: '#000', strokeWidth: 0 }] });
  const resized = resizeScene(scene, { width: 500, height: 500 });
  expect(resized.width).toBe(500);
  expect(resized.height).toBe(500);
  expect(resized.layers[0]).toMatchObject({ x: 50, y: 50, width: 100, height: 100 });
  expect(scene.width).toBe(1000);
});

it('rejects non-positive target dimensions', () => {
  const scene = createScene({ id: 'scene-1', width: 100, height: 100, layers: [] });
  expect(() => resizeScene(scene, { width: 0, height: 100 })).toThrow('INVALID_SIZE');
});
