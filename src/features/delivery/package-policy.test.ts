import { expect, it } from 'vitest';
import { isSafePackagePath } from './package-policy';

it('rejects traversal and absolute package paths', () => {
  expect(isSafePackagePath('../key.txt')).toBe(false);
  expect(isSafePackagePath('/tmp/key.txt')).toBe(false);
  expect(isSafePackagePath('assets/poster.png')).toBe(true);
  expect(isSafePackagePath('assets//poster.png')).toBe(false);
  expect(isSafePackagePath('C:/Users/name/poster.png')).toBe(false);
  expect(isSafePackagePath('assets/poster.png/')).toBe(false);
});
