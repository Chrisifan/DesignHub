import { expect, it } from 'vitest';
import { needsBackground } from './export-policy';

it('JPEG 透明合成要求可见的背景选择', () => {
  expect(needsBackground('jpeg', true)).toBe(true);
  expect(needsBackground('png', true)).toBe(false);
});
