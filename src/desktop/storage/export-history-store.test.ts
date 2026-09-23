// @vitest-environment node

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { initializeProjectLibrary, openProjectLibrary } from './project-library-store';
import { appendWorkspaceExportHistory, loadWorkspaceExportHistory } from './export-history-store';
import type { ExportHistoryRecord } from '../../features/delivery/export-history';

const directories: string[] = [];
const record: ExportHistoryRecord = {
  id: 'export-1', projectId: 'project-1', documentId: 'document-1', revisionId: 'revision-1', format: 'png',
  targetPath: '/tmp/poster.png', sha256: 'a'.repeat(64), status: 'success', archived: false, createdAt: '2026-09-13T00:00:00.000Z',
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

it('persists workspace export history and filters it by project', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'designhub-export-history-'));
  directories.push(parent);
  const workspace = await initializeProjectLibrary(parent);
  await appendWorkspaceExportHistory(workspace, workspace.library.libraryId, record);
  await appendWorkspaceExportHistory(workspace, workspace.library.libraryId, { ...record, id: 'export-2', projectId: 'project-2' });
  workspace.close();
  const reopened = await openProjectLibrary(parent);
  try {
    await expect(loadWorkspaceExportHistory(reopened, reopened.library.libraryId, 'project-1')).resolves.toEqual([record]);
  } finally {
    reopened.close();
  }
});
