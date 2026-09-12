import { expect, it } from 'vitest';

import { selectContextAssets } from './context';

it('does not implicitly read another project in the workspace', () => {
  const assets = [{ id: 'a', projectId: 'p1' }, { id: 'b', projectId: 'p2' }];

  expect(selectContextAssets(assets, 'p1', ['a', 'b'], [])).toEqual(['a']);
  expect(selectContextAssets(assets, 'p1', [], ['b'])).toEqual(['b']);
});
it('does not upload unrequested project assets', () => {
  const assets = [
    { id: 'a', projectId: 'p1' },
    { id: 'b', projectId: 'p1' },
    { id: 'c', projectId: 'p2' },
  ];

  expect(selectContextAssets(assets, 'p1', [], [])).toEqual([]);
  expect(selectContextAssets(assets, 'p1', ['a'], [])).toEqual(['a']);
});
