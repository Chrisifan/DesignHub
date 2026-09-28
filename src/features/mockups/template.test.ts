import { describe, expect, it } from 'vitest';
import { builtInMockupTemplates, resolveMockupPlacement, validateMockupRenderInput } from './template';

describe('built-in mockup templates', () => {
  it('ships the three controlled V1 categories', () => {
    expect(builtInMockupTemplates.map((template) => template.category)).toEqual(['phone-screen', 'poster-frame', 'packaging-bag']);
    expect(builtInMockupTemplates.every((template) => template.source && template.license && template.previewAsset)).toBe(true);
  });

  it('rejects undersized assets and unsupported colors before rendering', () => {
    expect(validateMockupRenderInput({ templateId: 'builtin-phone-screen', sourceWidth: 100, sourceHeight: 100, color: 'black' })).toEqual({ ok: false, reason: 'SOURCE_TOO_SMALL' });
    expect(validateMockupRenderInput({ templateId: 'builtin-phone-screen', sourceWidth: 1000, sourceHeight: 1000, color: 'pink' })).toEqual({ ok: false, reason: 'COLOR_UNSUPPORTED' });
    expect(validateMockupRenderInput({ templateId: 'missing', sourceWidth: 1000, sourceHeight: 1000, color: 'black' })).toEqual({ ok: false, reason: 'TEMPLATE_NOT_FOUND' });
  });

  it('resolves a bounded placement for the local renderer', () => {
    const placement = resolveMockupPlacement(builtInMockupTemplates[0]);
    expect(placement.left + placement.width).toBeLessThanOrEqual(builtInMockupTemplates[0].output.width);
    expect(placement.top + placement.height).toBeLessThanOrEqual(builtInMockupTemplates[0].output.height);
  });
});
