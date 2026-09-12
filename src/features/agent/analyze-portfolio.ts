export type AnalyzePortfolioInput = {
  sourceIds: string[];
  designerDraftId: string;
  connectionId: string;
};

const createTaskId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;

export const analyzePortfolio = async (input: AnalyzePortfolioInput): Promise<{ taskId: string; designerDraftId: string }> => {
  if (!input.designerDraftId.trim() || !input.connectionId.trim()) throw new Error('ANALYSIS_BINDING_REQUIRED');
  const sourceIds = [...new Set(input.sourceIds.map((id) => id.trim()).filter(Boolean))];
  if (sourceIds.length === 0) throw new Error('PORTFOLIO_SOURCE_REQUIRED');
  return { taskId: createTaskId('portfolio-analysis'), designerDraftId: input.designerDraftId };
};
