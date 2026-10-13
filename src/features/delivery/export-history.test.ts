import { expect, it } from 'vitest';

import { appendExportHistory, type ExportHistoryRecord } from './export-history';

const record: ExportHistoryRecord = {
  id: 'export-1',
  projectId: 'project-1',
  designId: 'design-1',
  revisionId: 'revision-1',
  format: 'png',
  targetPath: '/exports/poster.png',
  sha256: 'a'.repeat(64),
  status: 'success',
  archived: true,
  createdAt: '2026-09-13T00:00:00.000Z',
};

it('appends export records newest first without mutating the previous list', () => {
  const previous = [record];
  const next = appendExportHistory(previous, { ...record, id: 'export-2', createdAt: '2026-09-13T00:01:00.000Z' });
  expect(next[0]?.id).toBe('export-2');
  expect(next[1]?.id).toBe('export-1');
  expect(previous).toEqual([record]);
});

it('rejects malformed export history records', () => {
  expect(() => appendExportHistory([], { ...record, targetPath: '' })).toThrow('INVALID_EXPORT_HISTORY');
});
