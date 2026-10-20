import { randomUUID } from 'node:crypto';
import { access, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants, lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

import {
  designGenerationSlotIds,
  isPortfolioAnalysisDiagnostic,
  isSafeProviderCode,
  taskRecordKeys,
  type DesignGenerationSlot,
  type DesignGenerationSlotId,
  type TaskCandidate,
  type ToolCandidate,
  type TaskProviderFailure,
  type TaskRecord,
  type TaskSource,
  type TaskState,
} from '../../features/tasks/state';
import { isVisualContextPlan } from '../../features/agent/visual-context';
import { imageTools, validateToolParams } from '../../features/image-tools/target';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { assertNoRemovedDocumentSchema } from '../../features/projects/metadata';
import { getWritableProjectLibraryLease } from './project-library-store';
import { isScene } from '../../features/canvas/scene';

export const tasksFileName = 'tasks.json';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isTaskState = (value: unknown): value is TaskState => value === 'queued' || value === 'running' || value === 'completed' || value === 'failed' || value === 'cancelled' || value === 'unknown';
const isTaskSource = (value: unknown): value is TaskSource => isRecord(value)
  && (value.kind === 'project' || value.kind === 'creation-draft' || value.kind === 'designer-draft')
  && typeof value.id === 'string'
  && value.id.trim().length > 0;
const isPortfolioSourceId = (value: unknown): value is string => typeof value === 'string'
  && value.trim().length > 0 && value.length <= 128 && !/[\u0000-\u001F/\\]/u.test(value);
const isPortfolioMetadata = (value: unknown): boolean => isRecord(value)
  && Object.keys(value).length === 2
  && Object.hasOwn(value, 'sourceIds')
  && Object.hasOwn(value, 'rightsConfirmed')
  && value.rightsConfirmed === true
  && Array.isArray(value.sourceIds)
  && value.sourceIds.length > 0
  && value.sourceIds.length <= 8
  && value.sourceIds.every(isPortfolioSourceId)
  && new Set(value.sourceIds).size === value.sourceIds.length;
const isProviderFailure = (value: unknown): value is TaskProviderFailure => isRecord(value)
  && Object.keys(value).every((key) => ['kind', 'status', 'providerCode', 'retryAfterSeconds'].includes(key))
  && (value.kind === 'http' || value.kind === 'rate_limited' || value.kind === 'invalid_response' || value.kind === 'cancelled')
  && (value.status === undefined || (Number.isInteger(value.status) && Number(value.status) >= 100 && Number(value.status) <= 599))
  && (value.providerCode === undefined || isSafeProviderCode(value.providerCode))
  && (value.retryAfterSeconds === undefined || (Number.isInteger(value.retryAfterSeconds) && Number(value.retryAfterSeconds) >= 0 && Number(value.retryAfterSeconds) <= 86_400));
const isTaskDiagnostic = (value: unknown): boolean => isRecord(value)
  && Object.keys(value).every((key) => ['host', 'causeName', 'causeCode'].includes(key))
  && (value.host === undefined || (typeof value.host === 'string' && value.host.length <= 253 && /^[a-z0-9.-]+$/iu.test(value.host)))
  && (value.causeName === undefined || (typeof value.causeName === 'string' && /^[A-Z0-9_-]{1,64}$/u.test(value.causeName)))
  && (value.causeCode === undefined || (typeof value.causeCode === 'string' && /^[A-Z0-9_-]{1,64}$/u.test(value.causeCode)));
const isTaskCandidate = (value: unknown): value is TaskCandidate => isRecord(value)
  && Object.keys(value).every((key) => ['id', 'baseRevisionId', 'assetIds', 'sceneAssetId', 'analysisThreadId', 'parentConversationTaskId', 'designerVersionId', 'createdAt'].includes(key))
  && typeof value.id === 'string' && value.id.trim().length > 0
  && (value.baseRevisionId === null || typeof value.baseRevisionId === 'string')
  && Array.isArray(value.assetIds) && value.assetIds.every((id) => typeof id === 'string')
  && (value.sceneAssetId === undefined || typeof value.sceneAssetId === 'string')
  && (value.analysisThreadId === undefined || typeof value.analysisThreadId === 'string')
  && (value.parentConversationTaskId === undefined || typeof value.parentConversationTaskId === 'string')
  && (value.designerVersionId === undefined || typeof value.designerVersionId === 'string')
  && typeof value.createdAt === 'string';
const isLegacyNoopExpandParams = (tool: unknown, value: unknown): boolean => tool === 'expand'
  && isRecord(value)
  && Object.keys(value).every((key) => ['mode', 'top', 'right', 'bottom', 'left'].includes(key))
  && (value.mode === undefined || value.mode === 'original-scene' || value.mode === 'atmospheric')
  && ['top', 'right', 'bottom', 'left'].every((key) => Object.hasOwn(value, key) && value[key] === 0);
const hasValidPersistedToolParams = (tool: unknown, value: unknown): boolean => imageTools.includes(tool as typeof imageTools[number])
  && (validateToolParams(tool as typeof imageTools[number], value).ok || isLegacyNoopExpandParams(tool, value));
const isToolCandidate = (value: unknown): value is ToolCandidate => isRecord(value)
  && Object.keys(value).every((key) => ['taskId', 'tool', 'sourceAssetId', 'baseRevisionId', 'resultAssetId', 'beforeScene', 'candidateScene', 'toolParams', 'providerId', 'model', 'remoteRequestId'].includes(key))
  && typeof value.taskId === 'string' && value.taskId.trim().length > 0
  && imageTools.includes(value.tool as typeof imageTools[number])
  && typeof value.sourceAssetId === 'string' && value.sourceAssetId.trim().length > 0
  && (value.baseRevisionId === null || typeof value.baseRevisionId === 'string')
  && typeof value.resultAssetId === 'string' && value.resultAssetId.trim().length > 0
  && isScene(value.beforeScene) && isScene(value.candidateScene)
  && (value.toolParams === undefined || hasValidPersistedToolParams(value.tool, value.toolParams))
  && (value.providerId === undefined || typeof value.providerId === 'string')
  && (value.model === undefined || typeof value.model === 'string')
  && (value.remoteRequestId === undefined || typeof value.remoteRequestId === 'string');
const isGenerationSlot = (value: unknown): value is DesignGenerationSlot => isRecord(value)
  && Object.keys(value).every((key) => ['id', 'direction', 'state', 'attempt', 'remoteRequestId', 'assetId', 'candidateId', 'errorCode', 'diagnostic', 'providerFailure', 'cost'].includes(key))
  && designGenerationSlotIds.includes(value.id as DesignGenerationSlotId)
  && typeof value.direction === 'string' && value.direction.trim().length > 0
  && (value.state === 'queued' || value.state === 'running' || value.state === 'completed' || value.state === 'failed' || value.state === 'cancelled')
  && Number.isInteger(value.attempt) && Number(value.attempt) > 0
  && (value.remoteRequestId === undefined || (typeof value.remoteRequestId === 'string' && value.remoteRequestId.trim().length > 0))
  && (value.remoteSupportsCancellation === undefined || typeof value.remoteSupportsCancellation === 'boolean')
  && (value.remoteSupportsStatusQuery === undefined || typeof value.remoteSupportsStatusQuery === 'boolean')
  && (value.assetId === undefined || typeof value.assetId === 'string')
  && (value.candidateId === undefined || typeof value.candidateId === 'string')
  && (value.errorCode === undefined || typeof value.errorCode === 'string')
  && (value.diagnostic === undefined || isTaskDiagnostic(value.diagnostic))
  && (value.providerFailure === undefined || isProviderFailure(value.providerFailure))
  && (value.cost === undefined || value.cost === null || (typeof value.cost === 'number' && Number.isFinite(value.cost) && value.cost >= 0));
const isGenerationSlots = (value: unknown): value is DesignGenerationSlot[] => Array.isArray(value)
  && (value.length === 1 || value.length === designGenerationSlotIds.length)
  && value.every(isGenerationSlot)
  && new Set(value.map((slot) => slot.id)).size === value.length
  && value.every((slot, index) => slot.id === designGenerationSlotIds[index]);
const isRegion = (value: unknown): boolean => isRecord(value)
  && ['x', 'y', 'width', 'height'].every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0)
  && Number(value.width) > 0 && Number(value.height) > 0;
const isProjectDesignOutput = (value: unknown): boolean => isRecord(value)
  && Object.keys(value).every((key) => ['sourceConversationTaskId', 'width', 'height', 'title'].includes(key))
  && (value.sourceConversationTaskId === undefined || (typeof value.sourceConversationTaskId === 'string' && value.sourceConversationTaskId.trim().length > 0))
  && typeof value.width === 'number' && Number.isFinite(value.width) && value.width > 0
  && typeof value.height === 'number' && Number.isFinite(value.height) && value.height > 0
  && typeof value.title === 'string' && value.title.trim().length > 0;
const isDesignContext = (value: unknown): boolean => isRecord(value)
  && value.version === 1
  && ((typeof value.libraryId === 'string' && value.libraryId.trim().length > 0) || (typeof value.workspaceId === 'string' && value.workspaceId.trim().length > 0))
  && typeof value.projectId === 'string' && value.projectId.trim().length > 0
  && typeof value.brief === 'string'
  && isRecord(value.canvas)
  && Number.isInteger(value.canvas.width) && Number(value.canvas.width) > 0
  && Number.isInteger(value.canvas.height) && Number(value.canvas.height) > 0
  && Array.isArray(value.canvas.currentImageAssetIds) && value.canvas.currentImageAssetIds.every((id) => typeof id === 'string')
  && Array.isArray(value.attachmentAssetIds) && value.attachmentAssetIds.every((id) => typeof id === 'string')
  && typeof value.userMessage === 'string'
  && (value.assistantBrief === undefined || typeof value.assistantBrief === 'string')
  && (value.designerSnapshot === undefined || isRecord(value.designerSnapshot))
  && (value.baseRevisionId === null || typeof value.baseRevisionId === 'string');
const isResult = (value: unknown): value is NonNullable<TaskRecord['result']> => {
  if (!isRecord(value)) return false;
  const candidatesValid = value.candidates === undefined || (Array.isArray(value.candidates)
    && value.candidates.every(isTaskCandidate)
    && new Set(value.candidates.map((candidate) => candidate.id)).size === value.candidates.length);
  return Object.keys(value).every((key) => ['text', 'sceneAssetId', 'assetIds', 'imageCount', 'cost', 'candidate', 'candidates', 'toolCandidate'].includes(key))
    && (value.text === undefined || typeof value.text === 'string')
    && (value.sceneAssetId === undefined || typeof value.sceneAssetId === 'string')
    && (value.assetIds === undefined || (Array.isArray(value.assetIds) && value.assetIds.every((id) => typeof id === 'string')))
    && (value.imageCount === undefined || (Number.isInteger(value.imageCount) && Number(value.imageCount) >= 0))
    && (value.cost === undefined || value.cost === null || (typeof value.cost === 'number' && Number.isFinite(value.cost) && value.cost >= 0))
    && (value.candidate === undefined || isTaskCandidate(value.candidate))
    && (value.toolCandidate === undefined || isToolCandidate(value.toolCandidate))
    && candidatesValid;
};
const isTaskRecord = (value: unknown): value is TaskRecord => isRecord(value)
  && Object.keys(value).every((key) => taskRecordKeys.has(key as keyof TaskRecord))
  && typeof value.id === 'string' && value.id.trim().length > 0
  && typeof value.requestId === 'string' && value.requestId.trim().length > 0
  && (value.requestText === undefined || typeof value.requestText === 'string')
  && isTaskState(value.state)
  && typeof value.cancelRequested === 'boolean'
  && Number.isInteger(value.attempt) && Number(value.attempt) > 0
  && (value.source === undefined || isTaskSource(value.source))
  && (value.parentConversationTaskId === undefined || typeof value.parentConversationTaskId === 'string')
  && (value.analysisThreadId === undefined || typeof value.analysisThreadId === 'string')
  && (value.conversationParentTaskId === undefined || typeof value.conversationParentTaskId === 'string')
  && (value.progressText === undefined || typeof value.progressText === 'string')
  && (value.generationSlots === undefined || isGenerationSlots(value.generationSlots))
  && (value.contextAssetIds === undefined || (Array.isArray(value.contextAssetIds) && value.contextAssetIds.every((id) => typeof id === 'string')))
  && (value.contextVersion === undefined || value.contextVersion === 1)
  && (value.designContext === undefined || isDesignContext(value.designContext))
  && (value.visualContextPlan === undefined || isVisualContextPlan(value.visualContextPlan))
  && (value.sourceAssetId === undefined || typeof value.sourceAssetId === 'string')
  && (value.sourceDesignId === undefined || typeof value.sourceDesignId === 'string')
  && (value.maskAssetId === undefined || typeof value.maskAssetId === 'string')
  && (value.hasMask === undefined || typeof value.hasMask === 'boolean')
  && (value.baseRevisionId === undefined || value.baseRevisionId === null || typeof value.baseRevisionId === 'string')
  && (value.designerVersionId === undefined || typeof value.designerVersionId === 'string')
  && (value.providerId === undefined || typeof value.providerId === 'string')
  && (value.capability === undefined || typeof value.capability === 'string')
  && (value.remoteRequestId === undefined || (typeof value.remoteRequestId === 'string' && value.remoteRequestId.trim().length > 0))
  && (value.remoteSupportsCancellation === undefined || typeof value.remoteSupportsCancellation === 'boolean')
  && (value.remoteSupportsStatusQuery === undefined || typeof value.remoteSupportsStatusQuery === 'boolean')
  && (value.portfolio === undefined || isPortfolioMetadata(value.portfolio))
  && (value.model === undefined || typeof value.model === 'string')
  && (value.size === undefined || typeof value.size === 'string')
  && (value.count === undefined || (Number.isInteger(value.count) && Number(value.count) > 0))
  && (value.tool === undefined || imageTools.includes(value.tool as typeof imageTools[number]))
  && (value.tool === undefined
    ? value.toolParams === undefined
    : hasValidPersistedToolParams(value.tool, value.toolParams))
  && (value.projectDesignOutput === undefined || isProjectDesignOutput(value.projectDesignOutput))
  && (value.region === undefined || isRegion(value.region))
  && (value.createdAt === undefined || typeof value.createdAt === 'string')
  && (value.updatedAt === undefined || typeof value.updatedAt === 'string')
  && (value.errorCode === undefined || typeof value.errorCode === 'string')
  && (value.providerFailure === undefined || isProviderFailure(value.providerFailure))
  && (value.analysisDiagnostic === undefined || isPortfolioAnalysisDiagnostic(value.analysisDiagnostic))
  && (value.result === undefined || isResult(value.result));

const normalizeLoadedTaskRecord = (value: unknown, libraryId: string): TaskRecord | null => {
  if (!isRecord(value)) return null;
  if (value.designContext === undefined) return isTaskRecord(value) ? value : null;
  if (!isRecord(value.designContext)) return null;

  const persistedLibraryIds = [value.designContext.libraryId, value.designContext.workspaceId]
    .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0);
  if (persistedLibraryIds.some((candidate) => candidate !== libraryId)) return null;

  const context = { ...value.designContext };
  delete context.libraryId;
  delete context.workspaceId;
  const normalized = { ...value, designContext: { ...context, libraryId } };
  return isTaskRecord(normalized) ? normalized : null;
};

const validateWorkspace = (handle: ProjectLibraryHandle, workspaceId: string, writable: boolean): string => {
  if (handle.library.libraryId !== workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');
  if (writable && !getWritableProjectLibraryLease(handle)) throw new Error('WORKSPACE_NOT_WRITABLE');
  const directory = realpathSync(handle.library.directory);
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

export const loadTaskState = async (handle: ProjectLibraryHandle, workspaceId: string): Promise<TaskRecord[]> => {
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
  assertNoRemovedDocumentSchema(parsed);
  if (!Array.isArray(parsed)) throw new Error('INVALID_TASK_STATE');
  const tasks: TaskRecord[] = [];
  for (const value of parsed) {
    const task = normalizeLoadedTaskRecord(value, workspaceId);
    if (!task) throw new Error('INVALID_TASK_STATE');
    tasks.push(task);
  }
  return structuredClone(tasks);
};

export const saveTaskState = async (handle: ProjectLibraryHandle, workspaceId: string, tasks: readonly TaskRecord[]): Promise<boolean> => {
  const path = validateWorkspace(handle, workspaceId, true);
  if (!tasks.every(isTaskRecord)) throw new Error('INVALID_TASK_STATE');
  assertRegularTaskFile(path, true);
  const temporary = join(join(path, '..'), `.${tasksFileName}.tmp-${randomUUID()}`);
  try {
    const persisted = tasks.map((task) => task.designContext
      ? { ...task, designContext: { ...task.designContext, workspaceId: task.designContext.libraryId, libraryId: undefined } }
      : task);
    await writeFile(temporary, `${JSON.stringify(persisted, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return true;
};
