import type { TaskRecord, TaskState } from '../../features/tasks/state';

export type ForegroundPresenceTask = {
  taskId: string;
  capability: string;
  mode: 'thinking' | 'working';
  state: 'queued' | 'running';
};

const isActive = (task: TaskRecord): task is TaskRecord & { state: 'queued' | 'running' } => (
  task.state === 'queued' || task.state === 'running'
);

const belongsToThread = (task: TaskRecord, threadId: string | undefined): boolean => (
  task.capability === 'conversation'
    ? Boolean(threadId && task.analysisThreadId === threadId)
    : task.capability === 'design-generation' || task.capability === 'image-editing' || task.capability === 'local-transform'
);

export const getForegroundPresenceTask = (
  tasks: readonly TaskRecord[],
  threadId: string | undefined,
): ForegroundPresenceTask | null => {
  const active = tasks
    .filter((task): task is TaskRecord & { state: 'queued' | 'running' } => isActive(task) && belongsToThread(task, threadId))
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? '')
      || (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''));
  const task = active[0];
  if (!task?.capability) return null;
  return {
    taskId: task.id,
    capability: task.capability,
    mode: task.capability === 'conversation' ? 'thinking' : 'working',
    state: task.state,
  };
};

export const getTerminalPresenceOutcome = (state: TaskState): 'success' | 'failure' | null => (
  state === 'completed' ? 'success' : state === 'failed' ? 'failure' : null
);

export const getObservedTerminalOutcome = (
  previous: TaskState | undefined,
  current: TaskState,
): 'success' | 'failure' | null => (
  (previous === 'queued' || previous === 'running') ? getTerminalPresenceOutcome(current) : null
);
