import {
  completeTask,
  createTaskState,
  retryTask,
  transitionTask,
  type TaskRecord,
  type TaskState,
} from '../tasks/state';

export type NewTaskRecord = Omit<TaskRecord, 'state' | 'cancelRequested' | 'attempt'>;

export const createRunningTask = (input: NewTaskRecord): TaskRecord => createTaskState(input);

export const transitionTaskRecord = (task: TaskRecord, next: TaskState): TaskRecord => transitionTask(task, next);

export const completeTaskRecord = (task: TaskRecord): TaskRecord => completeTask(task);

export const failTaskRecord = (task: TaskRecord, errorCode: string): TaskRecord => transitionTask({ ...task, errorCode }, 'failed');

export const retryTaskRecord = (task: TaskRecord, id: string): TaskRecord => retryTask(task, id);
