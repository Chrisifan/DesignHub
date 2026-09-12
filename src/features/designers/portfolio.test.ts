import { expect, it } from 'vitest';

import { selectPortfolioSources } from './portfolio';
import { analyzePortfolio } from '../agent/analyze-portfolio';

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

it('rejects duplicate or invalid image sources before analysis', async () => {
  const adapter = { analyzeVision: async () => ({ text: JSON.stringify({ candidates: [{ name: 'Candidate' }] }), cost: null }) };
  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter,
    sources: [
      { id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } },
      { id: 'source-1', description: 'duplicate', image: { url: 'https://img.test/b.png' } },
    ],
  })).rejects.toThrow('DUPLICATE_SOURCE_ID');
  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter,
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'file:///private/a.png' } }],
  })).rejects.toThrow('INVALID_PORTFOLIO_IMAGE');
});

it('rejects mismatched source IDs and oversized source batches', async () => {
  const adapter = { analyzeVision: async () => ({ text: JSON.stringify({ candidates: [{ name: 'Candidate' }] }), cost: null }) };
  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter,
    sourceIds: ['source-other'],
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).rejects.toThrow('PORTFOLIO_SOURCE_MISMATCH');
  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter,
    sources: Array.from({ length: 9 }, (_, index) => ({ id: `source-${index}`, description: 'poster', image: { url: `https://img.test/${index}.png` } })),
  })).rejects.toThrow('PORTFOLIO_SOURCE_LIMIT');
});
