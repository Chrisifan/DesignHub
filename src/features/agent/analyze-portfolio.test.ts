import { expect, it, vi } from 'vitest';
import { analyzePortfolio } from './analyze-portfolio';

it('turns explicit image sources and a vision response into reviewable profile drafts', async () => {
  const analyzeVision = vi.fn(async () => ({
    text: JSON.stringify({ candidates: [{ name: { zh: '纸感', en: 'Paper' }, summary: { zh: '克制', en: 'Restrained' }, artworkUrl: 'https://cdn.test/paper.png' }] }), cost: null,
  }));
  const result = await analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter: { analyzeVision },
    sources: [{ id: 'source-1', description: 'A poster with paper texture', image: { url: 'https://img.test/a.png' } }],
  });
  expect(analyzeVision).toHaveBeenCalledWith(expect.objectContaining({ image: { url: 'https://img.test/a.png' }, prompt: expect.stringContaining('source-1') }));
  expect(result).toMatchObject({ taskId: expect.any(String), designerDraftId: 'draft-1', sourceIds: ['source-1'] });
  expect(result.candidates[0]).toMatchObject({ status: 'draft', name: { zh: '纸感' }, artworkUrl: 'https://cdn.test/paper.png' });
});

it('fails honestly when no vision adapter is connected', async () => {
  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1',
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).rejects.toThrow('VISION_ANALYSIS_UNAVAILABLE');
});

it('rejects a non-structured provider response instead of fabricating candidates', async () => {
  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter: { analyzeVision: async () => ({ text: 'not json', cost: null }) },
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).rejects.toThrow('VISION_ANALYSIS_INVALID_RESPONSE');
});
