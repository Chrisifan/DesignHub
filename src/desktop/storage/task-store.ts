import { randomUUID } from 'node:crypto';
import { access, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants, lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

import type { TaskRecord, TaskSource, TaskState } from '../../features/tasks/state';
import { imageTools, validateToolParams } from '../../features/image-tools/target';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { getWritableWorkspaceLease } from './workspace-store';

export const tasksFileName = 'tasks.json';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isTaskState = (value: unknown): value is TaskState => value === 'queued' || value === 'running' || value === 'completed' || value === 'failed' || value === 'cancelled';
const isTaskSource = (value: unknown): value is TaskSource => isRecord(value)
  && (value.kind === 'project' || value.kind === 'creation-draft' || value.kind === 'designer-draft')
  && typeof value.id === 'string'
  && value.id.trim().length > 0;
const isRegion = (value: unknown): boolean => isRecord(value)
  && ['x', 'y', 'width', 'height'].every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0)
  && Number(value.width) > 0 && Number(value.height) > 0;
const isResult = (value: unknown): value is NonNullable<TaskRecord['result']> => {
  if (!isRecord(value)) return false;
  const candidate = value.candidate;
  const candidateValid = candidate === undefined || (isRecord(candidate)
    && typeof candidate.id === 'string' && candidate.id.trim().length > 0
    && (candidate.baseRevisionId === null || typeof candidate.baseRevisionId === 'string')
    && Array.isArray(candidate.assetIds) && candidate.assetIds.every((id) => typeof id === 'string')
    && (candidate.sceneAssetId === undefined || typeof candidate.sceneAssetId === 'string')
    && typeof candidate.createdAt === 'string');
  return (value.text === undefined || typeof value.text === 'string')
    && (value.sceneAssetId === undefined || typeof value.sceneAssetId === 'string')
    && (value.assetIds === undefined || (Array.isArray(value.assetIds) && value.assetIds.every((id) => typeof id === 'string')))
    && (value.imageCount === undefined || (Number.isInteger(value.imageCount) && Number(value.imageCount) >= 0))
    && (value.cost === undefined || value.cost === null || (typeof value.cost === 'number' && Number.isFinite(value.cost) && value.cost >= 0))
    && candidateValid;
};
const isTaskRecord = (value: unknown): value is TaskRecord => isRecord(value)
  && typeof value.id === 'string' && value.id.trim().length > 0
  && typeof value.requestId === 'string' && value.requestId.trim().length > 0
  && (value.requestText === undefined || typeof value.requestText === 'string')
  && isTaskState(value.state)
  && typeof value.cancelRequested === 'boolean'
  && Number.isInteger(value.attempt) && Number(value.attempt) > 0
  && (value.source === undefined || isTaskSource(value.source))
  && (value.documentId === undefined || typeof value.documentId === 'string')
  && (value.sourceAssetId === undefined || typeof value.sourceAssetId === 'string')
  && (value.hasMask === undefined || typeof value.hasMask === 'boolean')
  && (value.baseRevisionId === undefined || value.baseRevisionId === null || typeof value.baseRevisionId === 'string')
  && (value.designerVersionId === undefined || typeof value.designerVersionId === 'string')
  && (value.providerId === undefined || typeof value.providerId === 'string')
  && (value.capability === undefined || typeof value.capability === 'string')
  && (value.model === undefined || typeof value.model === 'string')
  && (value.size === undefined || typeof value.size === 'string')
  && (value.count === undefined || (Number.isInteger(value.count) && Number(value.count) > 0))
  && (value.tool === undefined || imageTools.includes(value.tool as typeof imageTools[number]))
  && (value.tool === undefined
    ? value.toolParams === undefined
    : validateToolParams(value.tool as typeof imageTools[number], value.toolParams).ok)
  && (value.region === undefined || isRegion(value.region))
  && (value.createdAt === undefined || typeof value.createdAt === 'string')
  && (value.updatedAt === undefined || typeof value.updatedAt === 'string')
  && (value.errorCode === undefined || typeof value.errorCode === 'string')
  && (value.result === undefined || isResult(value.result));

const validateWorkspace = (handle: WorkspaceHandle, workspaceId: string, writable: boolean): string => {
  if (handle.workspace.workspaceId !== workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');
  if (writable && !getWritableWorkspaceLease(handle)) throw new Error('WORKSPACE_NOT_WRITABLE');
  const directory = realpathSync(handle.workspace.directory);
  const internal = join(directory, '.designhub');
  const status = lstatSync(internal);
  if (!status.isDirectory() || status.isSymbolicLink() || realpathSync(internal) !== internal) throw new Error('INVALID_WORKSPACE_PATH');
  return join(internal, tasksFileName);
};

const assertRegularTaskFile = (path: string, allowMissing: boolean): void => {
  try {
    const status = lstatSync(path);
    if (!status.isFile() || status.isSymbolicLink()) throw new Error('INVALID_TASK_STATE');
  } catch (error) {
    if (allowMissing && isRecord(error) && error.code === 'ENOENT') return;
    if (error instanceof Error && error.message === 'INVALID_TASK_STATE') throw error;
    throw new Error('INVALID_TASK_STATE');
  }
};

export const loadTaskState = async (handle: WorkspaceHandle, workspaceId: string): Promise<TaskRecord[]> => {
  const path = validateWorkspace(handle, workspaceId, false);
  assertRegularTaskFile(path, true);
  try {
    await access(path, constants.R_OK);
  } catch (error) {
    const code = isRecord(error) && typeof error.code === 'string' ? error.code : '';
    if (code === 'ENOENT') return [];
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    throw new Error('INVALID_TASK_STATE');
  }
  if (!Array.isArray(parsed) || !parsed.every(isTaskRecord)) throw new Error('INVALID_TASK_STATE');
  return structuredClone(parsed);
};

export const saveTaskState = async (handle: WorkspaceHandle, workspaceId: string, tasks: readonly TaskRecord[]): Promise<boolean> => {
  const path = validateWorkspace(handle, workspaceId, true);
  if (!tasks.every(isTaskRecord)) throw new Error('INVALID_TASK_STATE');
  assertRegularTaskFile(path, true);
  const temporary = join(join(path, '..'), `.${tasksFileName}.tmp-${randomUUID()}`);
  try {
    await writeFile(temporary, `${JSON.stringify(tasks, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return true;
};
