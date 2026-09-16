import { expect, it, vi } from 'vitest';
import { analyzePortfolio } from './analyze-portfolio';

const completeCandidate = (overrides: Record<string, unknown> = {}) => ({
  name: { zh: '纸感', en: 'Paper' },
  signature: { zh: '纸张与秩序', en: 'Paper and order' },
  summary: { zh: '克制的纸感排版', en: 'Restrained paper typography' },
  principle: { zh: '保留留白', en: 'Preserve generous whitespace' },
  tags: [{ zh: '编辑感', en: 'Editorial' }],
  styleDna: {
    palette: ['#F5F0E6', '#242424'],
    typography: { zh: '高对比衬线体', en: 'High-contrast serif' },
    composition: { zh: '对称网格', en: 'Symmetrical grid' },
    texture: { zh: '粗粝纸张', en: 'Rough paper' },
  },
  negativeRules: [{ zh: '避免霓虹渐变', en: 'Avoid neon gradients' }],
  ...overrides,
});

it('turns explicit image sources and a vision response into reviewable profile drafts', async () => {
  const analyzeVision = vi.fn(async () => ({
    text: JSON.stringify({ candidates: [completeCandidate({ artworkUrl: 'https://cdn.test/paper.png' })] }), cost: null,
  }));
  const result = await analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter: { analyzeVision },
    sources: [{ id: 'source-1', description: 'A poster with paper texture', image: { url: 'https://img.test/a.png' } }],
  });
  expect(analyzeVision).toHaveBeenCalledWith(expect.objectContaining({ image: { url: 'https://img.test/a.png' }, prompt: expect.stringContaining('styleDna') }));
  expect(result).toMatchObject({ taskId: expect.any(String), designerDraftId: 'draft-1', sourceIds: ['source-1'] });
  expect(result.candidates[0]).toMatchObject({ status: 'draft', name: { zh: '纸感' }, artworkUrl: 'https://cdn.test/paper.png' });
});

it('rejects a candidate without style characteristics instead of creating defaults', async () => {
  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1',
    adapter: { analyzeVision: async () => ({ text: JSON.stringify({ candidates: [{ name: { zh: '未完成', en: 'Incomplete' } }] }), cost: null }) },
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).rejects.toThrow('VISION_ANALYSIS_INVALID_RESPONSE');
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

it('extracts a structured response when the provider wraps JSON in a short explanation', async () => {
  const result = await analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1',
    adapter: { analyzeVision: async () => ({ text: `Here is the analysis:\n\`\`\`json\n${JSON.stringify({ candidates: [completeCandidate()] })}\n\`\`\`\n`, cost: null }) },
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  });

  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0]?.name).toEqual({ zh: '纸感', en: 'Paper' });
});

it('retries transient vision gateway failures once before failing', async () => {
  let attempts = 0;
  const analyzeVision = vi.fn(async () => {
    attempts += 1;
    if (attempts === 1) throw Object.assign(new Error('gateway timeout'), { status: 524 });
    return { text: JSON.stringify({ candidates: [completeCandidate({ name: { zh: '已恢复', en: 'Recovered' } })] }), cost: null };
  });

  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter: { analyzeVision },
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).resolves.toMatchObject({ candidates: [expect.objectContaining({ name: { zh: '已恢复', en: 'Recovered' } })] });
  expect(analyzeVision).toHaveBeenCalledTimes(2);
});

it('does not retry non-transient vision failures', async () => {
  const analyzeVision = vi.fn(async () => {
    throw Object.assign(new Error('invalid credentials'), { status: 401 });
  });

  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter: { analyzeVision },
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).rejects.toMatchObject({ status: 401 });
  expect(analyzeVision).toHaveBeenCalledTimes(1);
});
