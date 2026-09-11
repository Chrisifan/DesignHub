import { expect, it } from 'vitest';

import { selectPortfolioSources } from './portfolio';

it('returns selected source IDs in their original order', () => {
  const sources = [
    { id: 'cover', selected: false },
    { id: 'detail', selected: true },
    { id: 'editorial', selected: true },
  ];

  expect(selectPortfolioSources(sources, true)).toEqual(['detail', 'editorial']);
});

it('requires explicit rights confirmation before selecting sources', () => {
  expect(() => selectPortfolioSources([{ id: 'cover', selected: true }], false))
    .toThrow('RIGHTS_REQUIRED');
});

it('rejects blank or whitespace-only source IDs', () => {
  expect(() => selectPortfolioSources([{ id: '   ', selected: true }], true))
    .toThrow('SOURCE_ID_REQUIRED');
});

it('rejects duplicate source IDs even when only one duplicate is selected', () => {
  const sources = [
    { id: 'cover', selected: true },
    { id: 'cover', selected: false },
  ];

  expect(() => selectPortfolioSources(sources, true)).toThrow('DUPLICATE_SOURCE_ID');
});
