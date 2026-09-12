import { expect, it } from 'vitest';
import { getToolDefinition, needsRegion, validateToolParams } from './target';

it('local and regional target rules are explicit', () => {
  expect(needsRegion('remove-object')).toBe(true);
  expect(needsRegion('inpaint')).toBe(true);
  expect(needsRegion('remove-background')).toBe(false);
  expect(needsRegion('resize')).toBe(false);
});

it('exposes a schema and capability for every declared tool', () => {
  const tools = ['remove-background', 'replace-background', 'remove-object', 'inpaint', 'expand', 'smart-crop', 'upscale', 'resize'] as const;
  for (const tool of tools) {
    expect(getToolDefinition(tool).schema.length).toBeGreaterThan(0);
    expect(getToolDefinition(tool).capability).toBeTruthy();
  }
});

it('validates tool-specific parameters instead of accepting generic JSON', () => {
  expect(validateToolParams('resize', { width: 1200, height: 800, format: 'png' })).toEqual({ ok: true });
  expect(validateToolParams('resize', { width: -1, height: 800 })).toEqual({ ok: false, reason: 'INVALID_PARAMS' });
  expect(validateToolParams('replace-background', { prompt: '' })).toEqual({ ok: false, reason: 'INVALID_PARAMS' });
  expect(validateToolParams('expand', { top: 10, right: 10, bottom: 10, left: 10 })).toEqual({ ok: true });
});
