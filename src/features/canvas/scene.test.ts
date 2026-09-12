import { expect, it } from 'vitest';

import {
  createScene,
  applyAssetToScene,
  isLayerInteractive,
  parseScene,
  reorderLayers,
  resizeLayer,
  selectLayerIds,
  serializeScene,
  setLayerLock,
  setLayerVisibility,
} from './scene';

const imageLayer = {
  id: 'image-1',
  type: 'image' as const,
  assetId: 'asset-1',
  x: 10,
  y: 20,
  width: 400,
  height: 300,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
};

it('resizes a layer immutably and rejects invalid dimensions', () => {
  const resized = resizeLayer(imageLayer, { width: 200, height: 150 });

  expect(resized).toMatchObject({ id: 'image-1', width: 200, height: 150 });
  expect(imageLayer).toMatchObject({ width: 400, height: 300 });
  expect(() => resizeLayer(imageLayer, { width: 0, height: 150 })).toThrow('INVALID_SIZE');
  expect(() => resizeLayer(imageLayer, { width: Number.NaN, height: 150 })).toThrow('INVALID_SIZE');
});

it('round trips a finite scene without viewport or canvas-library state', () => {
  const scene = createScene({
    id: 'scene-1',
    width: 1080,
    height: 1440,
    layers: [imageLayer, {
      id: 'text-1', type: 'text', text: '春间市集', fontFamily: 'sans-serif', fontSize: 72,
      fontWeight: '600', align: 'left', color: '#111111', x: 80, y: 96, width: 800, height: 120,
      rotation: 0, opacity: 1, visible: true, locked: false,
    }],
  });

  const serialized = serializeScene(scene);
  expect(serialized).not.toContain('Konva');
  expect(parseScene(serialized)).toEqual(scene);
  expect(() => parseScene(JSON.stringify({ ...scene, layers: [{ ...imageLayer, runtimeNode: {} }] }))).toThrow('INVALID_SCENE');
});

it('keeps visibility, lock state, and layer order distinct', () => {
  const hidden = setLayerVisibility(imageLayer, false);
  const locked = setLayerLock(hidden, true);

  expect(locked).toMatchObject({ visible: false, locked: true });
  expect(isLayerInteractive(imageLayer)).toBe(true);
  expect(isLayerInteractive(locked)).toBe(false);
  expect(reorderLayers([imageLayer, { ...imageLayer, id: 'text-1' }], ['text-1', 'image-1']).map((layer) => layer.id))
    .toEqual(['text-1', 'image-1']);
  expect(() => reorderLayers([imageLayer], ['missing'])).toThrow('INVALID_LAYER_ORDER');
});

it('keeps multi-selection scoped to existing unique layer ids', () => {
  const scene = createScene({ id: 'scene-2', width: 800, height: 600, layers: [imageLayer, { ...imageLayer, id: 'image-2' }] });

  expect(selectLayerIds(scene, ['image-2', 'image-1', 'image-2', 'missing'])).toEqual(['image-2', 'image-1']);
});

it('places, references, and replaces image assets without mutating the source scene', () => {
  const scene = createScene({ id: 'scene-assets', width: 1000, height: 800, layers: [{ ...imageLayer, id: 'image-existing', assetId: 'old-asset', width: 400, height: 300 }] });

  const placed = applyAssetToScene(scene, { assetId: 'asset-new', mode: 'place', selectedIds: [] });
  expect(placed.scene.layers).toHaveLength(2);
  expect(placed.scene.layers.at(-1)).toMatchObject({ type: 'image', assetId: 'asset-new', role: 'content' });
  expect(placed.selectedIds).toEqual([expect.any(String)]);

  const referenced = applyAssetToScene(scene, { assetId: 'asset-reference', mode: 'reference', selectedIds: [] });
  expect(referenced.scene.layers.at(-1)).toMatchObject({ type: 'image', assetId: 'asset-reference', role: 'reference', locked: true });

  const replaced = applyAssetToScene(scene, { assetId: 'asset-replacement', mode: 'replace', selectedIds: ['image-existing'] });
  expect(replaced.scene.layers).toHaveLength(1);
  expect(replaced.scene.layers[0]).toMatchObject({ id: 'image-existing', assetId: 'asset-replacement', role: 'content' });
  expect(scene.layers[0]).toMatchObject({ assetId: 'old-asset' });
});
