import { describe, expect, it } from 'vitest';
import { createScene } from '../canvas/scene';
import { markRasterFallbackCandidate, parseStructuredDesignSceneCandidate, validateDesignSceneCandidate, type DesignSceneCandidate } from './design-scene-candidate';

const candidate = (overrides: Partial<DesignSceneCandidate> = {}): DesignSceneCandidate => ({
  id: 'candidate-1',
  sourceTaskId: 'task-1',
  mode: 'structured',
  editable: true,
  scene: createScene({ id: 'scene-1', width: 100, height: 100, layers: [] }),
  assets: [{ assetId: 'asset-core', role: 'core' }],
  createdAt: '2026-09-28T00:00:00.000Z',
  ...overrides,
});

describe('design scene candidates', () => {
  it('requires a core asset and valid scene dimensions', () => {
    expect(validateDesignSceneCandidate(candidate({ assets: [] }))).toEqual({ ok: false, reason: 'CORE_ASSET_MISSING' });
    expect(validateDesignSceneCandidate(candidate({ scene: { id: 'bad', width: 0, height: 100, layers: [] } as never }))).toEqual({ ok: false, reason: 'SCENE_INVALID' });
  });

  it('does not expose raster fallback as editable structure', () => {
    const result = markRasterFallbackCandidate(candidate({ mode: 'structured', editable: true }));
    expect(result).toMatchObject({ mode: 'raster-fallback', editable: false });
    expect(validateDesignSceneCandidate(result)).toMatchObject({ ok: true });
    expect(validateDesignSceneCandidate({ ...result, editable: true })).toEqual({ ok: false, reason: 'INVALID_CANDIDATE' });
  });

  it('parses provider JSON without accepting malformed or unvalidated scenes', () => {
    expect(parseStructuredDesignSceneCandidate(JSON.stringify(candidate()))).toMatchObject({ ok: true });
    expect(parseStructuredDesignSceneCandidate('{not-json')).toEqual({ ok: false, reason: 'INVALID_CANDIDATE' });
  });
});
