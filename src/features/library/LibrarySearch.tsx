import { useMemo, useState } from 'react';

import { searchIndex, type SearchIndexItem, type SearchQuery } from './indexer';

type LibrarySearchProps = {
  index: readonly SearchIndexItem[];
  workspaceId: string;
  indexing?: boolean;
  onOpen?: (item: SearchIndexItem) => void;
};

export const LibrarySearch = ({ index, workspaceId, indexing = false, onOpen }: LibrarySearchProps) => {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchIndex(index, { workspaceId, query } satisfies SearchQuery), [index, query, workspaceId]);
  return <section aria-label="Library search" className="library-search">
    <label>
      <span>Search library</span>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects and documents" />
    </label>
    {indexing ? <p role="status">Indexing library…</p> : results.length === 0 ? <p role="status">No results</p> : <ul>
      {results.map((item) => <li key={`${item.projectId}:${item.documentId}`}>
        <button type="button" onClick={() => onOpen?.(item)}>{item.title ?? item.documentId}</button>
        <small>{item.projectId} / {item.documentId}</small>
      </li>)}
    </ul>}
  </section>;
};
