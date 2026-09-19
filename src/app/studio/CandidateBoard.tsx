import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { Locale } from '../i18n';
import type { TaskRecord } from '../../features/tasks/state';
import { getDesktopApi } from '../../platform/runtime';
import { Icon } from './ui';

export type CandidateBoardProps = {
  locale: Locale;
  tasks: TaskRecord[];
  workspaceId?: string;
  projectId: string;
  analysisThreadId?: string;
  width: number;
  height: number;
  displayWidth?: number;
  selectedCandidateId: string | null;
  onSelect: (candidateId: string, assetId: string) => void;
  onRequestFocus?: (element: HTMLElement) => void;
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

export const CandidateBoard = ({ locale, tasks, workspaceId, projectId, analysisThreadId, width, height, displayWidth = 280, selectedCandidateId, onSelect, onRequestFocus }: CandidateBoardProps) => {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [offsets, setOffsets] = useState<Record<string, CandidateOffset>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const latestDraftRef = useRef<HTMLElement>(null);
  const threadTasks = tasks.filter((task) => !analysisThreadId || task.analysisThreadId === analysisThreadId);
  const designTasks = threadTasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.capability === 'design-generation' && (task.result?.candidate || task.state === 'queued' || task.state === 'running'))
    .sort((left, right) => {
      const leftTime = left.task.createdAt ?? left.task.result?.candidate?.createdAt ?? '';
      const rightTime = right.task.createdAt ?? right.task.result?.candidate?.createdAt ?? '';
      return leftTime.localeCompare(rightTime) || left.index - right.index;
    })
    .map(({ task }) => task);
  const candidates = designTasks.filter((task) => task.result?.candidate);
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
      if (!workspaceId) return;
      const entries = await Promise.all(candidates.flatMap((task) => {
        const assetId = task.result?.candidate?.sceneAssetId ?? task.result?.candidate?.assetIds[0];
        if (!assetId || previews[assetId]) return [];
        return [getDesktopApi().readAsset?.({ workspaceId, projectId, assetId }).then((bytes) => bytes ? [assetId, imageUrl(bytes)] as const : null).catch(() => null)];
      }));
      if (cancelled) return;
      const next = Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry)));
      if (Object.keys(next).length) setPreviews((current) => ({ ...current, ...next }));
    };
    void load();
    return () => { cancelled = true; };
  }, [candidates, previews, projectId, workspaceId]);
  if (!analysisThreadId || designTasks.length === 0) return null;
  return (
    <div className="workbench-candidate-board" aria-label={locale === 'zh-CN' ? '候选设计稿' : 'Candidate drafts'}>
      {designTasks.map((task) => {
        if (task.state === 'queued' || task.state === 'running') {
          return <div
            key={task.id}
            ref={task.id === latestDesignTaskId ? (element) => { latestDraftRef.current = element; } : undefined}
            className="workbench-candidate-card workbench-candidate-card--skeleton"
            data-task-id={task.id}
            style={{ width: displayWidth, flexBasis: displayWidth }}
          >
            <div data-task-id={task.id} aria-label={locale === 'zh-CN' ? '正在生成设计稿' : 'Generating design draft'} style={{ aspectRatio: draftAspectRatio }} />
            <span>{locale === 'zh-CN' ? '正在生成…' : 'Generating…'}</span>
          </div>;
        }
        const candidate = task.result!.candidate!;
        const assetId = candidate.sceneAssetId ?? candidate.assetIds[0];
        const preview = assetId ? previews[assetId] : undefined;
        const offset = offsets[candidate.id] ?? { x: 0, y: 0 };
        const beginDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
          const current = offsets[candidate.id] ?? { x: 0, y: 0 };
          dragRef.current = { candidateId: candidate.id, startX: event.clientX, startY: event.clientY, originX: current.x, originY: current.y, moved: false };
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
        return <button ref={task.id === latestDesignTaskId ? (element) => { latestDraftRef.current = element; } : undefined} type="button" className={`workbench-candidate-card${selectedCandidateId === candidate.id ? ' is-selected' : ''}`} key={candidate.id} onClick={select} onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} data-candidate-id={candidate.id} data-dragging={draggingId === candidate.id || undefined} style={{ width: displayWidth, flexBasis: displayWidth, transform: `translate(${offset.x}px, ${offset.y}px)` }} aria-pressed={selectedCandidateId === candidate.id}>
          {preview ? <img style={{ aspectRatio: draftAspectRatio }} src={preview} alt={locale === 'zh-CN' ? '生成候选稿' : 'Generated candidate'} /> : <div className="workbench-candidate-card__placeholder" style={{ aspectRatio: draftAspectRatio }}><Icon name="image" size={22} /></div>}
          <span>{locale === 'zh-CN' ? '候选设计稿' : 'Candidate draft'}</span>
        </button>;
      })}
    </div>
  );
};
