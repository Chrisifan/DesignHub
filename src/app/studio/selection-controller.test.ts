import { describe, expect, it } from 'vitest';

import { createScene, type ImageLayer } from '../../features/canvas/scene';
import { findSelectedImageLayer } from './selection-controller';

const scene = createScene({
  id: 'selection-scene',
  width: 100,
  height: 100,
  layers: [
    { id: 'image-a', type: 'image', assetId: 'asset-a', x: 0, y: 0, width: 40, height: 40, rotation: 0, opacity: 1, visible: true, locked: false },
    { id: 'image-b', type: 'image', assetId: 'asset-b', x: 40, y: 0, width: 40, height: 40, rotation: 0, opacity: 1, visible: true, locked: false },
  ],
});

describe('selection controller', () => {
  it('returns the actual selected image layer when more than one image exists', () => {
    expect(findSelectedImageLayer(scene, { layerId: 'image-b', type: 'image' })?.assetId).toBe('asset-b');
  });

  it('rejects placeholder image layers as tool targets', () => {
    const placeholderScene = createScene({ ...scene, layers: [{ ...(scene.layers[0] as ImageLayer), assetId: 'placeholder' }] });
    expect(findSelectedImageLayer(placeholderScene, { layerId: 'image-a', type: 'image' })).toBeUndefined();
  });
});
