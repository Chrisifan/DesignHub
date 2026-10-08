import { validateDesignSceneCandidate, type DesignSceneCandidate } from '../../features/composition/design-scene-candidate';
import { createScene, type DesignScene } from '../../features/canvas/scene';
import type { TaskCandidate, TaskRecord, ToolCandidate } from '../../features/tasks/state';

export type CandidateEntry = { task: TaskRecord; candidate: TaskCandidate };
export type ToolCandidateEntry = { task: TaskRecord; candidate: ToolCandidate | TaskCandidate };

export const taskCandidates = (task: TaskRecord): TaskCandidate[] => task.result?.candidates
  ?? (task.result?.candidate ? [task.result.candidate] : []);

const candidateSlotRank = (task: TaskRecord, candidate: TaskCandidate): number => {
  const slot = task.generationSlots?.find((entry) => entry.candidateId === candidate.id)?.id;
  return slot === 'primary' ? 0 : slot === 'composition' ? 1 : slot === 'expressive' ? 2 : 3;
};

export const getCompletedCandidates = (tasks: TaskRecord[], activeBaseRevisionId: string | null): CandidateEntry[] => tasks
  .filter((task) => task.capability === 'design-generation' && task.state === 'completed')
  .flatMap((task) => taskCandidates(task).map((candidate) => ({ task, candidate })))
  .filter(({ candidate }) => activeBaseRevisionId === null || candidate.baseRevisionId === activeBaseRevisionId)
  .filter(({ candidate }) => Boolean(candidate.sceneAssetId ?? candidate.assetIds[0]))
  .sort((left, right) => {
    const leftTime = left.task.createdAt ?? left.candidate.createdAt;
    const rightTime = right.task.createdAt ?? right.candidate.createdAt;
    return rightTime.localeCompare(leftTime) || candidateSlotRank(left.task, left.candidate) - candidateSlotRank(right.task, right.candidate);
  });

export const createCandidateScene = (baseScene: DesignScene, candidate: TaskCandidate): DesignScene | null => {
  const assetId = candidate.sceneAssetId ?? candidate.assetIds[0];
  if (!assetId) return null;
  return createScene({
    id: `candidate-scene-${candidate.id}`,
    width: baseScene.width,
    height: baseScene.height,
    layers: [{
      id: `candidate-image-${candidate.id}`,
      type: 'image',
      role: 'content',
      assetId,
      x: 0,
      y: 0,
      width: baseScene.width,
      height: baseScene.height,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
    }],
  });
};

export const findCandidateById = (tasks: TaskRecord[], candidateId: string): CandidateEntry | undefined => {
  for (const task of tasks) {
    const candidate = taskCandidates(task).find((item) => item.id === candidateId);
    if (candidate) return { task, candidate };
  }
  return undefined;
};

export const findToolCandidate = (tasks: TaskRecord[], taskId: string): ToolCandidateEntry | undefined => {
  const task = tasks.find((item) => item.id === taskId);
  if (task?.result?.toolCandidate) return { task, candidate: task.result.toolCandidate };
  const candidate = task ? taskCandidates(task)[0] : undefined;
  return task && candidate ? { task, candidate } : undefined;
};

export const resolveCandidateScene = ({
  entryCandidate,
  selectedCandidateId,
  toolCandidateTaskId,
  tasks,
  baseScene,
}: {
  entryCandidate?: DesignSceneCandidate | null;
  selectedCandidateId: string | null;
  toolCandidateTaskId: string | null;
  tasks: TaskRecord[];
  baseScene: DesignScene;
}): DesignScene | null => {
  if (entryCandidate) return entryCandidate.scene;
  if (!selectedCandidateId && !toolCandidateTaskId) return null;
  const entry = selectedCandidateId
    ? findCandidateById(tasks, selectedCandidateId)
    : toolCandidateTaskId
      ? findToolCandidate(tasks, toolCandidateTaskId)
      : undefined;
  if (!entry || entry.task.state !== 'completed') return null;
  return 'candidateScene' in entry.candidate
    ? entry.candidate.candidateScene
    : createCandidateScene(baseScene, entry.candidate);
};

export const getUnresolvedEntryCandidate = (tasks: TaskRecord[], projectId: string, documentId?: string): { task: TaskRecord; candidate: DesignSceneCandidate } | undefined => {
  const unresolved = tasks
    .filter((task) => task.capability === 'local-composition'
      && task.state === 'completed'
      && task.source?.kind === 'project'
      && task.source.id === projectId
      && task.documentId === documentId
      && task.candidateResolution === undefined
      && task.result?.compositionCandidate)
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))[0];
  const validated = unresolved?.result?.compositionCandidate
    ? validateDesignSceneCandidate(unresolved.result.compositionCandidate)
    : null;
  return validated?.ok && unresolved ? { task: unresolved, candidate: validated.candidate } : undefined;
};
