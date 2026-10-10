import { describe, expect, it } from 'vitest';

import { createScene } from '../../features/canvas/scene';
import { validateToolSubmission } from './tool-submit-controller';

const scene = createScene({
  id: 'submit-scene',
  width: 100,
  height: 100,
  layers: [{ id: 'image-a', type: 'image', assetId: 'asset-a', x: 0, y: 0, width: 40, height: 40, rotation: 0, opacity: 1, visible: true, locked: false }],
});

describe('tool submit controller', () => {
  it('accepts a managed image target without a document', () => {
    expect(validateToolSubmission({
      tool: 'remove-background',
      params: { edgeRefinement: 50 },
      scene,
      selection: null,
      libraryId: 'library',
    })).toEqual({ ok: true, targetLayerId: 'image-a' });
  });

  it('returns the selected layer id instead of selecting the first image', () => {
    expect(validateToolSubmission({ tool: 'remove-background', params: { edgeRefinement: 50 }, scene, selection: { layerId: 'image-a', type: 'image' }, libraryId: 'library', documentId: 'document' })).toEqual({ ok: true, targetLayerId: 'image-a' });
  });

  it('rejects a missing image selection and read-only submissions', () => {
    expect(validateToolSubmission({ tool: 'remove-background', params: { edgeRefinement: 50 }, scene, selection: null, libraryId: 'library', documentId: 'document' })).toEqual({ ok: false, code: 'IMAGE_LAYER_REQUIRED' });
    expect(validateToolSubmission({ tool: 'remove-background', params: { edgeRefinement: 50 }, scene, selection: { layerId: 'image-a', type: 'image' }, libraryId: 'library', documentId: 'document', readOnly: true })).toEqual({ ok: false, code: 'READ_ONLY' });
  });
});
