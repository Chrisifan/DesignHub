import { describe, expect, it } from 'vitest';
import { builtInMockupTemplates } from '../mockups/template';
import { createCompositionEntryCandidate, createMockupEntryCandidate } from './studio-entry';

const identity = { id: 'candidate-1', sourceTaskId: 'local-task-1', createdAt: '2026-09-28T00:00:00.000Z' };

describe('Studio entry candidates', () => {
  it('keeps core, optional and reference roles in a validated editable composition scene', () => {
    const result = createCompositionEntryCandidate({
      ...identity, width: 1080, height: 1440,
      assets: [
        { assetId: 'hero', role: 'core' },
        { assetId: 'badge', role: 'optional' },
        { assetId: 'mood', role: 'reference' },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.assets.map(({ role }) => role)).toEqual(['core', 'optional', 'reference']);
    expect(result.candidate.scene.layers.filter((layer) => layer.type === 'image').map((layer) => layer.assetId)).toEqual(['hero', 'badge', 'mood']);
    expect(result.candidate).toMatchObject({ mode: 'structured', editable: true });
  });

  it('rejects a composition without a core asset', () => {
    expect(createCompositionEntryCandidate({ ...identity, width: 1080, height: 1440, assets: [{ assetId: 'mood', role: 'reference' }] })).toEqual({ ok: false, reason: 'CORE_ASSET_MISSING' });
  });

  it('builds a mockup candidate from a valid source without changing a built-in template', () => {
    const templateBefore = structuredClone(builtInMockupTemplates[0]);
    const result = createMockupEntryCandidate({ ...identity, sourceAssetId: 'artwork', sourceWidth: 1080, sourceHeight: 1440, templateId: 'builtin-phone-screen', color: 'black' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.scene).toMatchObject({ width: 1600, height: 2000 });
    expect(result.candidate.scene.layers.some((layer) => layer.type === 'image' && layer.assetId === 'artwork')).toBe(true);
    expect(result.candidate.assets).toEqual([{ assetId: 'artwork', role: 'core' }]);
    expect(builtInMockupTemplates[0]).toEqual(templateBefore);
  });

  it('rejects undersized sources and unsupported colors before a mockup candidate exists', () => {
    expect(createMockupEntryCandidate({ ...identity, sourceAssetId: 'artwork', sourceWidth: 100, sourceHeight: 100, templateId: 'builtin-phone-screen', color: 'black' })).toEqual({ ok: false, reason: 'SOURCE_TOO_SMALL' });
    expect(createMockupEntryCandidate({ ...identity, sourceAssetId: 'artwork', sourceWidth: 1080, sourceHeight: 1440, templateId: 'builtin-phone-screen', color: 'pink' })).toEqual({ ok: false, reason: 'COLOR_UNSUPPORTED' });
  });
});
