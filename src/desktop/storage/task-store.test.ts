// @vitest-environment node

import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { createWorkspace, openWorkspace } from './workspace-store';
import { loadTaskState, saveTaskState, tasksFileName } from './task-store';
import type { TaskRecord } from '../../features/tasks/state';

const temporaryDirectories: string[] = [];

const createTemporaryWorkspace = async () => {
  const parentDirectory = await mkdtemp(join(tmpdir(), 'designhub-task-store-'));
  temporaryDirectories.push(parentDirectory);
  return createWorkspace({ parentDirectory, name: 'workspace' });
};

const task: TaskRecord = {
  id: 'task-1',
  requestId: 'request-1',
  state: 'running',
  cancelRequested: false,
  attempt: 1,
  source: { kind: 'project', id: 'project-1' },
  documentId: 'document-1',
  baseRevisionId: null,
  designerVersionId: 'designer-v1',
  providerId: 'provider-1',
  capability: 'conversation',
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

it('persists task state across workspace reopen without secret fields', async () => {
  const workspace = await createTemporaryWorkspace();
  await saveTaskState(workspace, workspace.workspace.workspaceId, [task]);
  const path = join(workspace.workspace.directory, '.designhub', tasksFileName);
  expect(existsSync(path)).toBe(true);
  const serialized = await readFile(path, 'utf8');
  expect(serialized).not.toContain('secret');
  workspace.close();

  const reopened = await openWorkspace(join(temporaryDirectories[0]!, 'workspace'));
  try {
    await expect(loadTaskState(reopened, reopened.workspace.workspaceId)).resolves.toEqual([task]);
  } finally {
    reopened.close();
  }
});

it('rejects malformed task state without treating it as an empty list', async () => {
  const workspace = await createTemporaryWorkspace();
  const path = join(workspace.workspace.directory, '.designhub', tasksFileName);
  await writeFile(path, '{bad json', 'utf8');
  await expect(loadTaskState(workspace, workspace.workspace.workspaceId)).rejects.toThrow('INVALID_TASK_STATE');
  workspace.close();
});

it('does not write task state in a read-only workspace', async () => {
  const workspace = await createTemporaryWorkspace();
  const readOnly = await openWorkspace(workspace.workspace.directory);
  try {
    await expect(saveTaskState(readOnly, readOnly.workspace.workspaceId, [task])).rejects.toThrow('WORKSPACE_NOT_WRITABLE');
  } finally {
    readOnly.close();
    workspace.close();
  }
});
