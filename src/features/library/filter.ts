export type SearchableItem = {
  title?: string;
  brief?: string;
  brand?: string;
  size?: string;
  tags?: string[];
  contributorIds?: string[];
  updatedAt?: string;
  [key: string]: unknown;
};

const normalize = (value: string): string => value.trim().toLocaleLowerCase();

export const matchesDesigner = (
  item: { contributorIds: string[] },
  designerId: string,
): boolean => item.contributorIds.includes(designerId);

export const matchesSearch = (item: SearchableItem, query: string): boolean => {
  const needle = normalize(query);
  if (!needle) return true;
  const haystack = [item.title, item.brief, item.brand, item.size, ...(item.tags ?? []), ...(item.contributorIds ?? []), item.updatedAt]
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
  return normalize(haystack).includes(needle);
};
