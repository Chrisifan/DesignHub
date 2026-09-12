import { expect, it } from 'vitest';

import { isRegionInside } from './selection';

it('requires a finite non-empty region inside the target image', () => {
  expect(isRegionInside({ x: 10, y: 20, width: 50, height: 30 }, { width: 100, height: 100 })).toBe(true);
  expect(isRegionInside({ x: 90, y: 0, width: 20, height: 20 }, { width: 100, height: 100 })).toBe(false);
  expect(isRegionInside({ x: 0, y: 0, width: 0, height: 1 }, { width: 100, height: 100 })).toBe(false);
  expect(isRegionInside({ x: Number.NaN, y: 0, width: 1, height: 1 }, { width: 100, height: 100 })).toBe(false);
});
