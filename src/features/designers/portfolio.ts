export type PortfolioSource = {
  id: string;
  selected: boolean;
};

const validatePortfolioSourceIds = (sources: PortfolioSource[]): void => {
  const seenIds = new Set<string>();

  for (const source of sources) {
    if (!source.id.trim()) throw new Error('SOURCE_ID_REQUIRED');
    if (seenIds.has(source.id)) throw new Error('DUPLICATE_SOURCE_ID');
    seenIds.add(source.id);
  }
};

export const selectPortfolioSources = (
  sources: PortfolioSource[],
  rightsConfirmed: boolean,
): string[] => {
  if (!rightsConfirmed) throw new Error('RIGHTS_REQUIRED');
  validatePortfolioSourceIds(sources);
  return sources.filter((source) => source.selected).map((source) => source.id);
};
