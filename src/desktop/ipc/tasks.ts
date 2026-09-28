import { isPortfolioAnalysisDiagnostic, isSafeProviderCode, taskRecordKeys, type TaskRecord } from '../../features/tasks/state';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { isTrustedProjectLibraryRequest } from './workspace';

export const taskListChannel = 'task:list';
export const taskSaveChannel = 'task:save';

type TaskSender = { mainFrame: { url: string }; getURL: () => string };
type TaskRequest = { sender: TaskSender; senderFrame: { url: string } | null };
type TaskWindow = { webContents: TaskSender };

const isWorkspaceId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isTaskState = (value: unknown): value is TaskRecord['state'] => value === 'queued' || value === 'running' || value === 'completed' || value === 'failed' || value === 'cancelled' || value === 'unknown';
const isTaskProviderFailure = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  const failure = value as Record<string, unknown>;
  return Object.keys(failure).every((key) => ['kind', 'status', 'providerCode', 'retryAfterSeconds'].includes(key))
    && (failure.kind === 'http' || failure.kind === 'rate_limited' || failure.kind === 'invalid_response' || failure.kind === 'cancelled')
    && (failure.status === undefined || (Number.isInteger(failure.status) && Number(failure.status) >= 100 && Number(failure.status) <= 599))
    && (failure.providerCode === undefined || isSafeProviderCode(failure.providerCode))
    && (failure.retryAfterSeconds === undefined || (Number.isInteger(failure.retryAfterSeconds) && Number(failure.retryAfterSeconds) >= 0 && Number(failure.retryAfterSeconds) <= 86_400));
};
const isTaskRecord = (value: unknown): value is TaskRecord => {
  if (typeof value !== 'object' || value === null) return false;
  const task = value as Record<string, unknown>;
  return Object.keys(task).every((key) => taskRecordKeys.has(key as keyof TaskRecord))
    && typeof task.id === 'string' && task.id.trim().length > 0
    && typeof task.requestId === 'string' && task.requestId.trim().length > 0
    && isTaskState(task.state)
    && typeof task.cancelRequested === 'boolean'
    && Number.isInteger(task.attempt) && Number(task.attempt) > 0
    && (task.remoteRequestId === undefined || (typeof task.remoteRequestId === 'string' && task.remoteRequestId.trim().length > 0))
    && (task.remoteSupportsCancellation === undefined || typeof task.remoteSupportsCancellation === 'boolean')
    && (task.remoteSupportsStatusQuery === undefined || typeof task.remoteSupportsStatusQuery === 'boolean')
    && (task.providerFailure === undefined || isTaskProviderFailure(task.providerFailure))
    && (task.analysisDiagnostic === undefined || isPortfolioAnalysisDiagnostic(task.analysisDiagnostic));
};
const isTaskList = (value: unknown): value is TaskRecord[] => Array.isArray(value) && value.every(isTaskRecord);

export const listTasksHandler = (
  window: TaskWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  load: (workspace: ProjectLibraryHandle, libraryId: string) => Promise<TaskRecord[]>,
) => async (event: TaskRequest, libraryId: unknown): Promise<TaskRecord[] | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isWorkspaceId(libraryId)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== libraryId) return null;
  return load(workspace, libraryId);
};

export const saveTasksHandler = (
  window: TaskWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  save: (workspace: ProjectLibraryHandle, libraryId: string, tasks: TaskRecord[]) => Promise<boolean>,
) => async (event: TaskRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return false;
  const value = input as Record<string, unknown>;
  if (!isWorkspaceId(value.libraryId) || !isTaskList(value.tasks)) return false;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== value.libraryId) return false;
  return save(workspace, value.libraryId, value.tasks);
};
