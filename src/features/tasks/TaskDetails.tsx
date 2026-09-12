import type { TaskRecord } from './state';

export type TaskDetailsProps = {
  task: TaskRecord;
  onCancel?: () => void;
  onRetry?: () => void;
};

export const TaskDetails = ({ task, onCancel, onRetry }: TaskDetailsProps) => (
  <section aria-label="Task details" className="task-details">
    <strong>{task.state}</strong>
    <span>{task.cancelRequested ? 'Cancellation requested' : `Attempt ${task.attempt}`}</span>
    {task.cancelRequested && onCancel ? <button type="button" onClick={onCancel}>Stop</button> : null}
    {task.state === 'failed' && onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}
  </section>
);
