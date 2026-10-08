import { applyToolResult } from '../image-tools/result-application';
import type { RevisionRecord, RevisionStore } from '../revisions/model';
import type { TaskRuntime } from '../tasks/runtime';
import type { TaskRecord, ToolCandidate } from '../tasks/state';
import type { DesignSceneCandidate } from '../composition/design-scene-candidate';

export type TaskCandidateService = {
  publishCandidate: (taskId: string) => ToolCandidate;
  confirm: (taskId: string, operationId: string) => Promise<RevisionRecord>;
  discard: (taskId: string) => Promise<void>;
  publishCompositionCandidate: (input: { projectId: string; documentId: string; candidate: DesignSceneCandidate }) => Promise<TaskRecord>;
  resolveCompositionCandidate: (taskId: string, resolution: 'confirmed' | 'discarded') => Promise<TaskRecord>;
};

export type TaskCandidateServiceOptions = {
  runtime: TaskRuntime;
  revisionStore?: RevisionStore;
};

const candidateFor = (runtime: TaskRuntime, taskId: string): ToolCandidate => {
  const task = runtime.get(taskId);
  const candidate = task?.result?.toolCandidate;
  if (!task || task.state !== 'completed' || !candidate) throw new Error('TOOL_CANDIDATE_REQUIRED');
  return structuredClone(candidate);
};

/** Applies tool results only after explicit user confirmation. */
export const createTaskCandidateService = (options: TaskCandidateServiceOptions): TaskCandidateService => {
  const discarded = new Set<string>();
  const confirmed = new Map<string, RevisionRecord>();
  const confirmedTasks = new Set<string>();

  const publishCandidate = (taskId: string): ToolCandidate => {
    if (discarded.has(taskId)) throw new Error('CANDIDATE_DISCARDED');
    return candidateFor(options.runtime, taskId);
  };

  const confirm = async (taskId: string, operationId: string): Promise<RevisionRecord> => {
    const existing = confirmed.get(operationId);
    if (existing) return structuredClone(existing);
    if (discarded.has(taskId)) throw new Error('CANDIDATE_DISCARDED');
    const task = options.runtime.get(taskId);
    const candidate = candidateFor(options.runtime, taskId);
    if (!task?.source?.id || !task.documentId) throw new Error('TOOL_RESULT_BINDING_REQUIRED');
    if (!options.revisionStore) throw new Error('REVISION_STORE_REQUIRED');
    const applied = await applyToolResult({
      status: 'completed',
      projectId: task.source.id,
      documentId: task.documentId,
      baseRevisionId: candidate.baseRevisionId,
      operationId,
      sceneAssetId: candidate.resultAssetId,
      assetIds: task.result?.assetIds ?? [candidate.resultAssetId],
      revisionStore: options.revisionStore,
      candidate,
    });
    if (!applied) throw new Error('TOOL_RESULT_NOT_APPLIED');
    const revision = options.revisionStore.getRevision(applied.revisionId);
    if (!revision) throw new Error('REVISION_NOT_FOUND');
    confirmed.set(operationId, revision);
    confirmedTasks.add(taskId);
    return structuredClone(revision);
  };

  const discard = async (taskId: string): Promise<void> => {
    if (confirmedTasks.has(taskId)) return;
    discarded.add(taskId);
  };

  const publishCompositionCandidate = (input: { projectId: string; documentId: string; candidate: DesignSceneCandidate }): Promise<TaskRecord> => options.runtime.publishCompositionCandidate({
    id: input.candidate.sourceTaskId,
    requestId: input.candidate.sourceTaskId,
    source: { kind: 'project', id: input.projectId },
    documentId: input.documentId,
    capability: 'local-composition',
    result: { compositionCandidate: input.candidate },
    createdAt: input.candidate.createdAt,
  });

  const resolveCompositionCandidate = (taskId: string, resolution: 'confirmed' | 'discarded') => options.runtime.resolveCompositionCandidate(taskId, resolution);

  return { publishCandidate, confirm, discard, publishCompositionCandidate, resolveCompositionCandidate };
};
