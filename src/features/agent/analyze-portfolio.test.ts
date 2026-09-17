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
    signals: {
      contrast: 68,
      darkAiriness: 82,
      whitespace: 38,
      grain: 15,
      diffuseLight: 92,
      typeFamily: { zh: '宋体倾向', en: 'Serif tendency' },
      typeWeight: { zh: '半粗体', en: 'Semibold' },
      tracking: { zh: '紧凑', en: 'Compact' },
      compositionTopology: { zh: '非对称垂直流', en: 'Asymmetric vertical flow' },
      rendering: { zh: '柔和纸张漫反射', en: 'Soft paper diffusion' },
    },
  },
  negativeRules: [{ zh: '避免霓虹渐变', en: 'Avoid neon gradients' }],
  ...overrides,
});

it('synthesizes all explicit image sources into one named reviewable profile draft', async () => {
  const analyzeVision = vi.fn(async () => ({
    text: JSON.stringify({ candidates: [completeCandidate({ artworkUrl: 'https://cdn.test/paper.png' })] }), cost: null,
  }));
  const result = await analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter: { analyzeVision },
    sources: [
      { id: 'source-1', description: 'A poster with paper texture', image: { url: 'https://img.test/a.png' } },
      { id: 'source-2', description: 'A matching editorial detail', image: { url: 'https://img.test/b.png' } },
    ],
  });
  expect(analyzeVision).toHaveBeenCalledTimes(1);
  expect(analyzeVision).toHaveBeenCalledWith(expect.objectContaining({
    images: [{ url: 'https://img.test/a.png' }, { url: 'https://img.test/b.png' }],
    prompt: expect.stringContaining('original designer name'),
  }));
  expect(analyzeVision).toHaveBeenCalledWith(expect.objectContaining({
    prompt: expect.stringMatching(/darkAiriness[\s\S]*compositionTopology/u),
  }));
  expect(result).toMatchObject({ taskId: expect.any(String), designerDraftId: 'draft-1', sourceIds: ['source-1', 'source-2'] });
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0]).toMatchObject({
    status: 'draft',
    name: { zh: '纸感' },
    artworkUrl: 'https://cdn.test/paper.png',
    styleDna: {
      signals: {
        contrast: 68,
        whitespace: 38,
        typeFamily: { zh: '宋体倾向', en: 'Serif tendency' },
        rendering: { zh: '柔和纸张漫反射', en: 'Soft paper diffusion' },
      },
    },
  });
});

it('normalizes numeric percentage strings without weakening the signal contract', async () => {
  const candidate = completeCandidate();
  candidate.styleDna.signals.contrast = '68%' as unknown as number;
  candidate.styleDna.signals.whitespace = ' 38 ' as unknown as number;
  const result = await analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1',
    adapter: { analyzeVision: async () => ({ text: JSON.stringify({ candidates: [candidate] }), cost: null }) },
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  });
  expect(result.candidates[0]?.styleDna.signals).toMatchObject({ contrast: 68, whitespace: 38 });
});

it('requests one complete replacement when the first model result is invalid', async () => {
  const analyzeVision = vi.fn()
    .mockResolvedValueOnce({ text: '{bad json', cost: null })
    .mockResolvedValueOnce({ text: JSON.stringify({ candidates: [completeCandidate()] }), cost: null });
  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter: { analyzeVision },
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).resolves.toMatchObject({ candidates: [expect.objectContaining({ name: { zh: '纸感', en: 'Paper' } })] });
  expect(analyzeVision).toHaveBeenCalledTimes(2);
  expect(analyzeVision.mock.calls[1]?.[0]).toMatchObject({
    images: [{ url: 'https://img.test/a.png' }],
    prompt: expect.stringContaining('payload.invalid_json'),
  });
});

it('rejects malformed structured visual signals instead of passing invalid metrics to the UI', async () => {
  const candidate = completeCandidate();
  candidate.styleDna.signals.contrast = 140;
  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1',
    adapter: { analyzeVision: async () => ({ text: JSON.stringify({ candidates: [candidate] }), cost: null }) },
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).rejects.toThrow('VISION_ANALYSIS_INVALID_RESPONSE');
});

it('reports a safe field diagnostic after one unsuccessful repair', async () => {
  const candidate = completeCandidate();
  candidate.styleDna.signals.contrast = 140;
  const analyzeVision = vi.fn(async () => ({ text: JSON.stringify({ candidates: [candidate] }), cost: null }));
  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter: { analyzeVision },
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).rejects.toMatchObject({
    message: 'VISION_ANALYSIS_INVALID_RESPONSE',
    analysisDiagnostic: 'candidate.styleDna.signals.contrast.invalid_percentage',
  });
  expect(analyzeVision).toHaveBeenCalledTimes(2);
});

it('does not continue repair after cancellation', async () => {
  const controller = new AbortController();
  const analyzeVision = vi.fn(async () => {
    controller.abort();
    return { text: '{bad json', cost: null };
  });
  await expect(analyzePortfolio({
    designerDraftId: 'draft-1', connectionId: 'provider-1', adapter: { analyzeVision }, signal: controller.signal,
    sources: [{ id: 'source-1', description: 'poster', image: { url: 'https://img.test/a.png' } }],
  })).rejects.toMatchObject({ kind: 'cancelled' });
  expect(analyzeVision).toHaveBeenCalledTimes(1);
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
