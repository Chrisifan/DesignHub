import { expect, it } from 'vitest';

import { isProjectGenerationRatio, parseDocumentSize, resolveGenerationRatioSize } from './size';

it('parses supported document size presets', () => {
  expect(parseDocumentSize('1080 × 1440')).toEqual({ width: 1080, height: 1440 });
  expect(parseDocumentSize('1080 × 1080')).toEqual({ width: 1080, height: 1080 });
  expect(parseDocumentSize('1920 × 1080')).toEqual({ width: 1920, height: 1080 });
});

it('rejects malformed or oversized document sizes', () => {
  expect(() => parseDocumentSize('1080x1440')).toThrow('INVALID_SIZE');
  expect(() => parseDocumentSize('0 × 1080')).toThrow('INVALID_SIZE');
  expect(() => parseDocumentSize('20001 × 1080')).toThrow('INVALID_SIZE');
});

it('resolves the supported project generation ratios to stable pixel sizes', () => {
  expect(resolveGenerationRatioSize('3:4')).toEqual({ width: 1080, height: 1440 });
  expect(resolveGenerationRatioSize('1:1')).toEqual({ width: 1080, height: 1080 });
  expect(resolveGenerationRatioSize('16:9')).toEqual({ width: 1920, height: 1080 });
  expect(isProjectGenerationRatio('3:4')).toBe(true);
  expect(isProjectGenerationRatio('4:5')).toBe(false);
});
