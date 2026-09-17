import { isPortfolioAnalysisDiagnostic, isSafeProviderCode, taskRecordKeys, type TaskRecord } from '../../features/tasks/state';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { isTrustedWorkspaceRequest } from './workspace';

export const taskListChannel = 'task:list';
export const taskSaveChannel = 'task:save';

type TaskSender = { mainFrame: { url: string }; getURL: () => string };
type TaskRequest = { sender: TaskSender; senderFrame: { url: string } | null };
type TaskWindow = { webContents: TaskSender };

const isWorkspaceId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isTaskState = (value: unknown): value is TaskRecord['state'] => value === 'queued' || value === 'running' || value === 'completed' || value === 'failed' || value === 'cancelled';
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
    && (task.providerFailure === undefined || isTaskProviderFailure(task.providerFailure))
    && (task.analysisDiagnostic === undefined || isPortfolioAnalysisDiagnostic(task.analysisDiagnostic));
};
const isTaskList = (value: unknown): value is TaskRecord[] => Array.isArray(value) && value.every(isTaskRecord);

export const listTasksHandler = (
  window: TaskWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  load: (workspace: WorkspaceHandle, workspaceId: string) => Promise<TaskRecord[]>,
) => async (event: TaskRequest, workspaceId: unknown): Promise<TaskRecord[] | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isWorkspaceId(workspaceId)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== workspaceId) return null;
  return load(workspace, workspaceId);
};

export const saveTasksHandler = (
  window: TaskWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  save: (workspace: WorkspaceHandle, workspaceId: string, tasks: TaskRecord[]) => Promise<boolean>,
) => async (event: TaskRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return false;
  const value = input as Record<string, unknown>;
  if (!isWorkspaceId(value.workspaceId) || !isTaskList(value.tasks)) return false;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== value.workspaceId) return false;
  return save(workspace, value.workspaceId, value.tasks);
};
