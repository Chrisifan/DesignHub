import { matchesDesigner, matchesSearch, type SearchableItem } from './filter';

export type SearchRecord = SearchableItem & {
  libraryId: string;
  projectId: string;
  documentId: string;
  finalized?: boolean;
  contributorIds: string[];
};

export type SearchIndexItem = SearchRecord;
export type SearchQuery = {
  libraryId: string;
  query?: string;
  designerId?: string;
  finalized?: boolean;
  tag?: string;
};

const allowedKeys = ['libraryId', 'projectId', 'documentId', 'title', 'brief', 'brand', 'size', 'finalized', 'tags', 'updatedAt', 'contributorIds'] as const;

export const buildSearchIndex = (records: readonly SearchRecord[]): SearchIndexItem[] => {
  const seen = new Set<string>();
  return records.flatMap((record) => {
    const key = `${record.libraryId}:${record.projectId}:${record.documentId}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const clean = Object.fromEntries(allowedKeys.flatMap((field) => {
      const value = record[field];
      return value === undefined ? [] : [[field, Array.isArray(value) ? [...value] : value]];
    })) as SearchIndexItem;
    clean.contributorIds = [...record.contributorIds];
    return [clean];
  });
};

export const searchIndex = (index: readonly SearchIndexItem[], options: SearchQuery): SearchIndexItem[] => {
  const tagNeedle = options.tag?.trim().toLocaleLowerCase();
  return index.filter((item) => item.libraryId === options.libraryId
    && matchesSearch(item, options.query ?? '')
    && (!options.designerId || matchesDesigner(item, options.designerId))
    && (options.finalized === undefined || item.finalized === options.finalized)
    && (!tagNeedle || (item.tags ?? []).some((tag) => tag.toLocaleLowerCase() === tagNeedle)));
};

export const rebuildSearchIndex = (records: readonly SearchRecord[]): SearchIndexItem[] => buildSearchIndex(records);
