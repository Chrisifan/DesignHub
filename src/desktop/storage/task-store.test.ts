// @vitest-environment node

import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
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

it('round-trips a three-slot generation batch and plural candidates', async () => {
  const workspace = await createTemporaryWorkspace();
  const batch: TaskRecord = {
    ...task,
    capability: 'design-generation',
    generationSlots: [
      { id: 'primary', direction: 'primary direction', state: 'completed', attempt: 1, assetId: 'asset-a', candidateId: 'candidate-a', cost: 0.1 },
      { id: 'composition', direction: 'composition direction', state: 'failed', attempt: 1, errorCode: 'IMAGE_RESULT_EMPTY' },
      { id: 'expressive', direction: 'expressive direction', state: 'running', attempt: 1 },
    ],
    result: {
      candidates: [{ id: 'candidate-a', baseRevisionId: null, assetIds: ['asset-a'], createdAt: '2026-09-20T00:00:00.000Z' }],
    },
  };

  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [batch])).resolves.toBe(true);
  await expect(loadTaskState(workspace, workspace.workspace.workspaceId)).resolves.toEqual([batch]);
  workspace.close();
});

it('rejects duplicate or unknown generation slots', async () => {
  const workspace = await createTemporaryWorkspace();
  const duplicate = {
    ...task,
    generationSlots: [
      { id: 'primary', direction: 'a', state: 'queued', attempt: 1 },
      { id: 'primary', direction: 'b', state: 'queued', attempt: 1 },
      { id: 'expressive', direction: 'c', state: 'queued', attempt: 1 },
    ],
  } as unknown as TaskRecord;
  const unknown = {
    ...task,
    generationSlots: [
      { id: 'primary', direction: 'a', state: 'queued', attempt: 1 },
      { id: 'composition', direction: 'b', state: 'queued', attempt: 1 },
      { id: 'other', direction: 'c', state: 'queued', attempt: 1 },
    ],
  } as unknown as TaskRecord;

  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [duplicate])).rejects.toThrow('INVALID_TASK_STATE');
  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [unknown])).rejects.toThrow('INVALID_TASK_STATE');
  workspace.close();
});

it('rejects malformed generation slot diagnostics and plural candidates', async () => {
  const workspace = await createTemporaryWorkspace();
  const baseBatch = {
    ...task,
    generationSlots: [
      { id: 'primary', direction: 'a', state: 'queued', attempt: 1 },
      { id: 'composition', direction: 'b', state: 'queued', attempt: 1 },
      { id: 'expressive', direction: 'c', state: 'queued', attempt: 1 },
    ],
  } as TaskRecord;

  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [{
    ...baseBatch,
    generationSlots: baseBatch.generationSlots?.map((slot) => slot.id === 'primary'
      ? { ...slot, providerFailure: { kind: 'http', status: 400, message: 'private' } as never }
      : slot),
  }])).rejects.toThrow('INVALID_TASK_STATE');
  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [{
    ...baseBatch,
    result: { candidates: [{ id: '', baseRevisionId: null, assetIds: ['asset-a'], createdAt: 'bad' }] },
  }])).rejects.toThrow('INVALID_TASK_STATE');
  workspace.close();
});

it('persists the managed source asset binding used for image retries', async () => {
  const workspace = await createTemporaryWorkspace();
  const imageTask: TaskRecord = {
    ...task,
    capability: 'image-editing',
    sourceAssetId: 'asset-source',
    requestText: 'remove object',
    tool: 'remove-object',
    toolParams: { feather: 10 },
  };
  await saveTaskState(workspace, workspace.workspace.workspaceId, [imageTask]);
  workspace.close();

  const reopened = await openWorkspace(join(temporaryDirectories[0]!, 'workspace'));
  try {
    await expect(loadTaskState(reopened, reopened.workspace.workspaceId)).resolves.toEqual([imageTask]);
  } finally {
    reopened.close();
  }
});

it('accepts only selected portfolio IDs and a rights acknowledgement in task state', async () => {
  const workspace = await createTemporaryWorkspace();
  const portfolioTask: TaskRecord = {
    ...task,
    capability: 'vision-analysis',
    portfolio: { sourceIds: ['portfolio-source-1'], rightsConfirmed: true },
  };
  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [portfolioTask])).resolves.toBe(true);
  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [{
    ...portfolioTask,
    portfolio: { sourceIds: ['portfolio-source-1'], rightsConfirmed: true, rawBytes: 'not-allowed' },
  } as unknown as TaskRecord])).rejects.toThrow('INVALID_TASK_STATE');
  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [{
    ...portfolioTask,
    portfolio: { sourceIds: [], rightsConfirmed: true },
  }])).rejects.toThrow('INVALID_TASK_STATE');
  workspace.close();
});

it('persists only validated safe provider failure diagnostics', async () => {
  const workspace = await createTemporaryWorkspace();
  const failedTask: TaskRecord = {
    ...task,
    state: 'failed',
    errorCode: 'http',
    providerFailure: { kind: 'http', status: 400, providerCode: 'invalid_image_format', retryAfterSeconds: 12 },
  };
  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [failedTask])).resolves.toBe(true);
  await expect(loadTaskState(workspace, workspace.workspace.workspaceId)).resolves.toEqual([failedTask]);
  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [{
    ...failedTask,
    providerFailure: { kind: 'http', status: 400, providerCode: 'invalid_image_format', message: 'private provider error' },
  } as unknown as TaskRecord])).rejects.toThrow('INVALID_TASK_STATE');
  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [{
    ...failedTask,
    providerMessage: 'private provider error',
  } as unknown as TaskRecord])).rejects.toThrow('INVALID_TASK_STATE');
  workspace.close();
});

it('persists only known portfolio analysis diagnostics and accepts historical records without one', async () => {
  const workspace = await createTemporaryWorkspace();
  const failedTask: TaskRecord = {
    ...task,
    state: 'failed',
    errorCode: 'VISION_ANALYSIS_INVALID_RESPONSE',
    analysisDiagnostic: 'payload.invalid_json',
  };
  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [failedTask])).resolves.toBe(true);
  await expect(loadTaskState(workspace, workspace.workspace.workspaceId)).resolves.toEqual([failedTask]);
  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [{
    ...failedTask,
    analysisDiagnostic: 'private response text',
  } as unknown as TaskRecord])).rejects.toThrow('INVALID_TASK_STATE');
  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [{
    ...failedTask,
    analysisDiagnostic: undefined,
  }])).resolves.toBe(true);
  workspace.close();
});

it('rejects invalid persisted image-tool parameters', async () => {
  const workspace = await createTemporaryWorkspace();
  const invalidTask = {
    ...task,
    capability: 'image-editing',
    tool: 'smart-crop',
    toolParams: { width: -1, height: 640, focus: 'subject' },
  } as unknown as TaskRecord;
  await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [invalidTask])).rejects.toThrow('INVALID_TASK_STATE');
  workspace.close();
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

it('rejects task state symlinks instead of reading or replacing external files', async () => {
  const workspace = await createTemporaryWorkspace();
  const externalRoot = await mkdtemp(join(tmpdir(), 'designhub-task-external-'));
  try {
    const path = join(workspace.workspace.directory, '.designhub', tasksFileName);
    const externalPath = join(externalRoot, 'tasks.json');
    await writeFile(externalPath, `${JSON.stringify([task])}\n`);
    await symlink(externalPath, path);
    await expect(loadTaskState(workspace, workspace.workspace.workspaceId)).rejects.toThrow('INVALID_TASK_STATE');
    await expect(saveTaskState(workspace, workspace.workspace.workspaceId, [task])).rejects.toThrow('INVALID_TASK_STATE');
    await expect(readFile(externalPath, 'utf8')).resolves.toContain('task-1');
  } finally {
    workspace.close();
    await rm(externalRoot, { recursive: true, force: true });
  }
});
