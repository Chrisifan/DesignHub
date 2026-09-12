import { expect, it } from 'vitest';

import { createScene, parseScene, resizeLayer, serializeScene } from '../../src/features/canvas/scene';

it('preserves document pixels while edits and view state remain separate', () => {
  const scene = createScene({
    id: 'poster',
    width: 1080,
    height: 1440,
    layers: [{
      id: 'shape-1', type: 'shape', kind: 'rect', fill: '#111111', stroke: '#000000', strokeWidth: 0,
      x: 0, y: 0, width: 1080, height: 1440, rotation: 0, opacity: 1, visible: true, locked: false,
    }],
  });
  const edited = { ...scene, layers: [resizeLayer(scene.layers[0]!, { width: 1000, height: 1400 })] };
  const viewport = { zoom: 0.5, offsetX: 120, offsetY: 60 };

  expect(viewport.zoom).toBe(0.5);
  expect(parseScene(serializeScene(edited))).toEqual(edited);
  expect(parseScene(serializeScene(edited))).not.toHaveProperty('viewport');
  expect(edited).toMatchObject({ width: 1080, height: 1440 });
});
