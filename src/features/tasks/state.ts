export type TaskState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type TaskSource = { kind: 'project' | 'creation-draft' | 'designer-draft'; id: string };

export type TaskRecord = {
  id: string;
  requestId: string;
  requestText?: string;
  state: TaskState;
  cancelRequested: boolean;
  attempt: number;
  source?: TaskSource;
  documentId?: string;
  baseRevisionId?: string | null;
  designerVersionId?: string;
  providerId?: string;
  capability?: string;
  createdAt?: string;
  updatedAt?: string;
  errorCode?: string;
  result?: {
    text?: string;
    assetIds?: string[];
    sceneAssetId?: string;
  };
};

const transitions: Record<TaskState, TaskState[]> = {
  queued: ['running', 'cancelled', 'failed'],
  running: ['completed', 'cancelled', 'failed'],
  completed: [],
  failed: [],
  cancelled: [],
};

export const mayTransition = (from: TaskState, to: TaskState): boolean => transitions[from].includes(to);

export const createTaskState = (input: Omit<TaskRecord, 'state' | 'cancelRequested' | 'attempt'>): TaskRecord => ({
  ...input,
  state: 'running',
  cancelRequested: false,
  attempt: 1,
});

export const transitionTask = (task: TaskRecord, next: TaskState): TaskRecord => {
  if (!mayTransition(task.state, next)) return { ...task };
  return { ...task, state: next };
};

export const requestCancellation = (task: TaskRecord): TaskRecord => (
  task.state === 'completed' || task.state === 'failed' || task.state === 'cancelled'
    ? { ...task }
    : { ...task, cancelRequested: true }
);

export const completeTask = (task: TaskRecord): TaskRecord => (
  task.cancelRequested ? transitionTask(task, 'cancelled') : transitionTask(task, 'completed')
);

export const retryTask = (task: TaskRecord, id: string): TaskRecord => {
  if (task.state !== 'failed' && task.state !== 'cancelled') throw new Error('TASK_NOT_RETRYABLE');
  return { ...task, id, state: 'queued', cancelRequested: false, attempt: task.attempt + 1, errorCode: undefined };
};
