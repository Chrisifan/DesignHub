import { expect, it } from 'vitest';

import { assessFontAvailability, applyFontReplacement } from './font-availability';

it('marks a missing font as preview-only until replacement is explicitly applied', () => {
  const availability = assessFontAvailability('Brand Sans', ['Arial', 'Noto Sans CJK']);

  expect(availability).toEqual({ requested: 'Brand Sans', available: false, previewFamily: 'Arial' });
  expect(applyFontReplacement('Brand Sans', availability, false)).toBe('Brand Sans');
  expect(applyFontReplacement('Brand Sans', availability, true)).toBe('Arial');
});
