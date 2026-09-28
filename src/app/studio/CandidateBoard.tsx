import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { Locale } from '../i18n';
import type { DesignGenerationSlotId, DesignGenerationSlotState, TaskCandidate, TaskRecord } from '../../features/tasks/state';
import { getDesktopApi } from '../../platform/runtime';
import { Icon } from './ui';

export type CandidateBoardProps = {
  locale: Locale;
  tasks: TaskRecord[];
  libraryId?: string;
  projectId: string;
  analysisThreadId?: string;
  width: number;
  height: number;
  displayWidth?: number;
  selectedCandidateId: string | null;
  onSelect: (candidateId: string, assetId: string) => void;
  onRetrySlot?: (taskId: string, slotId: DesignGenerationSlotId) => void;
  onRequestFocus?: (element: HTMLElement) => void;
};

type DraftItem = {
  key: string;
  taskId: string;
  slotId?: DesignGenerationSlotId;
  state: DesignGenerationSlotState;
  candidate?: TaskCandidate;
};

type CandidateOffset = { x: number; y: number };
type DragState = {
  candidateId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

const imageUrl = (bytes: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + 0x8000, bytes.length)));
  return `data:image/png;base64,${btoa(binary)}`;
};

const taskDrafts = (task: TaskRecord): DraftItem[] => {
  if (task.generationSlots?.length) {
    const candidates = new Map((task.result?.candidates ?? []).map((candidate) => [candidate.id, candidate]));
    return task.generationSlots.map((slot) => ({
      key: `${task.id}:${slot.id}`,
      taskId: task.id,
      slotId: slot.id,
      state: slot.state,
      ...(slot.candidateId && candidates.has(slot.candidateId) ? { candidate: candidates.get(slot.candidateId) } : {}),
    }));
  }
  if (task.result?.candidate) return [{ key: task.result.candidate.id, taskId: task.id, state: 'completed', candidate: task.result.candidate }];
  if (task.state === 'queued' || task.state === 'running') return [{ key: task.id, taskId: task.id, state: task.state }];
  return [];
};

const slotLabel = (locale: Locale, slotId: DesignGenerationSlotId): string => ({
  primary: locale === 'zh-CN' ? '主方案' : 'Primary',
  composition: locale === 'zh-CN' ? '构图探索' : 'Composition',
  expressive: locale === 'zh-CN' ? '视觉突破' : 'Expressive',
})[slotId];

export const CandidateBoard = ({ locale, tasks, libraryId, projectId, analysisThreadId, width, height, displayWidth = 280, selectedCandidateId, onSelect, onRetrySlot, onRequestFocus }: CandidateBoardProps) => {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [offsets, setOffsets] = useState<Record<string, CandidateOffset>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const latestDraftRef = useRef<HTMLElement>(null);
  const threadTasks = tasks.filter((task) => !analysisThreadId || task.analysisThreadId === analysisThreadId);
  const designTasks = threadTasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.capability === 'design-generation' && taskDrafts(task).length > 0)
    .sort((left, right) => {
      const leftTime = left.task.createdAt ?? left.task.result?.candidate?.createdAt ?? left.task.result?.candidates?.[0]?.createdAt ?? '';
      const rightTime = right.task.createdAt ?? right.task.result?.candidate?.createdAt ?? right.task.result?.candidates?.[0]?.createdAt ?? '';
      return leftTime.localeCompare(rightTime) || left.index - right.index;
    })
    .map(({ task }) => task);
  const candidates = designTasks.flatMap((task) => taskDrafts(task).flatMap((draft) => draft.candidate ? [draft.candidate] : []));
  const latestDesignTaskId = designTasks.at(-1)?.id;
  const draftAspectRatio = `${Math.max(1, width)} / ${Math.max(1, height)}`;

  useLayoutEffect(() => {
    if (!latestDesignTaskId) return;
    const draft = latestDraftRef.current;
    if (draft) onRequestFocus?.(draft);
  }, [latestDesignTaskId, onRequestFocus]);
  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      if (!libraryId) return;
      const entries = await Promise.all(candidates.flatMap((candidate) => {
        const assetId = candidate.sceneAssetId ?? candidate.assetIds[0];
        if (!assetId || previews[assetId]) return [];
        return [getDesktopApi().readAsset?.({ libraryId, projectId, assetId }).then((bytes) => bytes ? [assetId, imageUrl(bytes)] as const : null).catch(() => null)];
      }));
      if (cancelled) return;
      const next = Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry)));
      if (Object.keys(next).length) setPreviews((current) => ({ ...current, ...next }));
    };
    void load();
    return () => { cancelled = true; };
  }, [candidates, previews, projectId, libraryId]);
  if (!analysisThreadId || designTasks.length === 0) return null;
  const renderDraft = (draft: DraftItem, isLatestLegacy: boolean) => {
    const batch = designTasks.find((task) => task.id === draft.taskId);
    const batchSettled = !batch?.generationSlots?.some((slot) => slot.state === 'queued' || slot.state === 'running');
    if (draft.state === 'queued' || draft.state === 'running') return <div
      key={draft.key}
      ref={isLatestLegacy ? (element) => { latestDraftRef.current = element; } : undefined}
      className="workbench-candidate-card workbench-candidate-card--skeleton"
      data-task-id={draft.taskId}
      data-testid={`generation-slot-${draft.slotId ?? 'legacy'}`}
      style={{ width: displayWidth, flexBasis: displayWidth }}
    >
      <div data-task-id={draft.taskId} aria-label={locale === 'zh-CN' ? '正在生成设计稿' : 'Generating design draft'} style={{ aspectRatio: draftAspectRatio }} />
      <span>{locale === 'zh-CN' ? '正在生成…' : 'Generating…'}</span>
    </div>;
    if ((draft.state === 'failed' || draft.state === 'cancelled') && draft.slotId) return <div
      key={draft.key}
      className="workbench-candidate-card workbench-candidate-card--failed"
      data-testid={`generation-slot-${draft.slotId}`}
      style={{ width: displayWidth, flexBasis: displayWidth }}
    >
      <div className="workbench-candidate-card__placeholder" style={{ aspectRatio: draftAspectRatio }}><Icon name="circle-alert" size={22} /></div>
      <span>{locale === 'zh-CN' ? '生成失败' : 'Generation failed'}</span>
      {batchSettled && <button type="button" onClick={() => onRetrySlot?.(draft.taskId, draft.slotId!)}>
        {locale === 'zh-CN' ? `重新生成${slotLabel(locale, draft.slotId)}` : `Regenerate ${slotLabel(locale, draft.slotId)}`}
      </button>}
    </div>;
    const candidate = draft.candidate;
    if (!candidate) return null;
    const assetId = candidate.sceneAssetId ?? candidate.assetIds[0];
    const preview = assetId ? previews[assetId] : undefined;
    const offset = offsets[candidate.id] ?? { x: 0, y: 0 };
    const beginDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
      dragRef.current = { candidateId: candidate.id, startX: event.clientX, startY: event.clientY, originX: offset.x, originY: offset.y, moved: false };
      setDraggingId(candidate.id);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    };
    const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.candidateId !== candidate.id) return;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(deltaX, deltaY) > 3) drag.moved = true;
      if (drag.moved) setOffsets((current) => ({ ...current, [candidate.id]: { x: drag.originX + deltaX, y: drag.originY + deltaY } }));
    };
    const endDrag = () => {
      const drag = dragRef.current;
      if (drag?.candidateId === candidate.id && drag.moved) suppressClickRef.current = candidate.id;
      dragRef.current = null;
      setDraggingId(null);
    };
    const select = () => {
      if (suppressClickRef.current === candidate.id) {
        suppressClickRef.current = null;
        return;
      }
      if (assetId) onSelect(candidate.id, assetId);
    };
    return <button
      ref={isLatestLegacy ? (element) => { latestDraftRef.current = element; } : undefined}
      type="button"
      className={`workbench-candidate-card${selectedCandidateId === candidate.id ? ' is-selected' : ''}`}
      key={draft.key}
      onClick={select}
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      data-testid={`generation-slot-${draft.slotId ?? 'legacy'}`}
      data-candidate-id={candidate.id}
      data-dragging={draggingId === candidate.id || undefined}
      style={{ width: displayWidth, flexBasis: displayWidth, transform: `translate(${offset.x}px, ${offset.y}px)` }}
      aria-pressed={selectedCandidateId === candidate.id}
    >
      {preview ? <img style={{ aspectRatio: draftAspectRatio }} src={preview} alt={locale === 'zh-CN' ? '生成候选稿' : 'Generated candidate'} /> : <div className="workbench-candidate-card__placeholder" style={{ aspectRatio: draftAspectRatio }}><Icon name="image" size={22} /></div>}
      <span>{draft.slotId ? slotLabel(locale, draft.slotId) : locale === 'zh-CN' ? '候选设计稿' : 'Candidate draft'}</span>
    </button>;
  };
  return (
    <div className="workbench-candidate-board" aria-label={locale === 'zh-CN' ? '候选设计稿' : 'Candidate drafts'}>
      {designTasks.map((task) => {
        const drafts = taskDrafts(task);
        if (!task.generationSlots?.length) return drafts.map((draft) => renderDraft(draft, task.id === latestDesignTaskId));
        return <div
          className="workbench-candidate-batch"
          data-generation-batch-id={task.id}
          key={task.id}
          ref={task.id === latestDesignTaskId ? (element) => { latestDraftRef.current = element; } : undefined}
        >
          {drafts.map((draft) => renderDraft(draft, false))}
        </div>;
      })}
    </div>
  );
};
