import type { TaskRecord } from './state';

export type TaskDetailsProps = {
  task: TaskRecord;
  onCancel?: () => void;
  onRetry?: () => void;
  onViewCandidate?: (candidateId: string) => void;
  onCompareCandidate?: (candidateId: string) => void;
  onContinueCandidate?: (candidateId: string) => void;
  onFinalizeCandidate?: (candidateId: string) => void;
};

export const TaskDetails = ({ task, onCancel, onRetry, onViewCandidate, onCompareCandidate, onContinueCandidate, onFinalizeCandidate }: TaskDetailsProps) => (
  <section aria-label="Task details" className="task-details">
    <strong>{task.state}</strong>
    <span>{task.cancelRequested ? 'Cancellation requested' : `Attempt ${task.attempt}`}</span>
    {task.result?.imageCount !== undefined ? <span>{task.result.imageCount} images</span> : null}
    {task.result?.cost !== undefined && task.result.cost !== null ? <span>${task.result.cost.toFixed(2)}</span> : null}
    {task.result?.candidate ? <div className="task-details__candidate" aria-label="Candidate result">
      <strong>Candidate</strong>
      {onViewCandidate && <button type="button" onClick={() => onViewCandidate(task.result!.candidate!.id)}>View</button>}
      {onCompareCandidate && <button type="button" onClick={() => onCompareCandidate(task.result!.candidate!.id)}>Compare</button>}
      {onContinueCandidate && <button type="button" onClick={() => onContinueCandidate(task.result!.candidate!.id)}>Continue</button>}
      {onFinalizeCandidate && <button type="button" onClick={() => onFinalizeCandidate(task.result!.candidate!.id)}>Finalize</button>}
    </div> : null}
    {task.cancelRequested && onCancel ? <button type="button" onClick={onCancel}>Stop</button> : null}
    {task.state === 'unknown' ? <span>Result status is unknown; retry only if the provider was not charged.</span> : null}
    {(task.state === 'failed' || task.state === 'unknown') && onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}
  </section>
);
