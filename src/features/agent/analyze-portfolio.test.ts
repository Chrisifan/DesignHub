import { expect, it } from 'vitest';
import { analyzePortfolio } from './analyze-portfolio';

it('creates a designer analysis task with explicit sources and connection', async () => {
  await expect(analyzePortfolio({ sourceIds: ['source-1'], designerDraftId: 'draft-1', connectionId: 'provider-1' })).resolves.toEqual({
    taskId: expect.any(String),
    designerDraftId: 'draft-1',
  });
});
