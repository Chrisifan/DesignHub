import { expect, it } from 'vitest';

import { isProjectGenerationRatio, parseProjectDesignSize, resolveGenerationRatioSize } from './size';

it('parses supported project design size presets', () => {
  expect(parseProjectDesignSize('1080 × 1440')).toEqual({ width: 1080, height: 1440 });
  expect(parseProjectDesignSize('1080 × 1080')).toEqual({ width: 1080, height: 1080 });
  expect(parseProjectDesignSize('1920 × 1080')).toEqual({ width: 1920, height: 1080 });
});

it('rejects malformed or oversized project design sizes', () => {
  expect(() => parseProjectDesignSize('1080x1440')).toThrow('INVALID_SIZE');
  expect(() => parseProjectDesignSize('0 × 1080')).toThrow('INVALID_SIZE');
  expect(() => parseProjectDesignSize('20001 × 1080')).toThrow('INVALID_SIZE');
});

it('resolves the supported project generation ratios to stable pixel sizes', () => {
  expect(resolveGenerationRatioSize('original', { width: 1350, height: 1800 })).toEqual({ width: 1350, height: 1800 });
  expect(resolveGenerationRatioSize('3:4')).toEqual({ width: 1080, height: 1440 });
  expect(resolveGenerationRatioSize('1:1')).toEqual({ width: 1080, height: 1080 });
  expect(resolveGenerationRatioSize('16:9')).toEqual({ width: 1920, height: 1080 });
  expect(isProjectGenerationRatio('original')).toBe(true);
  expect(isProjectGenerationRatio('3:4')).toBe(true);
  expect(isProjectGenerationRatio('4:5')).toBe(false);
});
