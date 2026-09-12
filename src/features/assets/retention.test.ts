import { expect, it } from 'vitest';

import { referencedAssetIds } from './retention';

it('retains every asset referenced by active and archived revisions in first-seen order', () => {
  expect(referencedAssetIds([{ assetIds: ['old', 'logo'] }, { assetIds: ['new', 'logo'] }]))
    .toEqual(['old', 'logo', 'new']);
});

it('ignores empty or malformed revision asset lists without changing closure order', () => {
  expect(referencedAssetIds([
    { assetIds: ['a', 'a'] },
    { assetIds: [] },
    { assetIds: ['b', 'a'] },
  ])).toEqual(['a', 'b']);
});
