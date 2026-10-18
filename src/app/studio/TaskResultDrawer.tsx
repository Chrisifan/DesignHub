import { useEffect, useMemo, useState } from 'react';

import type { Locale } from '../i18n';
import type { DesignGenerationSlotId, DesignGenerationSlotState, TaskCandidate, TaskRecord } from '../../features/tasks/state';
import { getDesktopApi } from '../../platform/runtime';
import { Drawer } from './Drawer';
import { Badge, Icon, IconButton, t, type BadgeTone } from './ui';

type ResultItem = {
  key: string;
  label: string;
  state: DesignGenerationSlotState;
  assetId?: string;
  slotId?: DesignGenerationSlotId;
  errorCode?: string;
};

export type TaskResultDrawerProps = {
  locale: Locale;
  libraryId?: string;
  task: TaskRecord | null;
  onClose: () => void;
  onRetrySlot: (taskId: string, slotId: DesignGenerationSlotId) => void;
};

const imageUrl = (bytes: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + 0x8000, bytes.length)));
  }
  return `data:image/png;base64,${btoa(binary)}`;
};

const candidateAssetId = (candidate?: TaskCandidate): string | undefined => (
  candidate?.sceneAssetId ?? candidate?.assetIds[0]
);

const buildResultItems = (task: TaskRecord | null, locale: Locale): ResultItem[] => {
  if (!task) return [];
  const slotLabel = (slotId: DesignGenerationSlotId): string => ({
    primary: t(locale, '主方案', 'Primary'),
    composition: t(locale, '构图探索', 'Composition'),
    expressive: t(locale, '视觉突破', 'Expressive'),
  })[slotId];
  if (task.generationSlots?.length) {
    const candidates = new Map((task.result?.candidates ?? []).map((candidate) => [candidate.id, candidate]));
    return task.generationSlots.map((slot) => ({
      key: slot.id,
      label: slotLabel(slot.id),
      state: slot.state,
      slotId: slot.id,
      errorCode: slot.errorCode,
      assetId: candidateAssetId(slot.candidateId ? candidates.get(slot.candidateId) : undefined) ?? slot.assetId,
    }));
  }

  const candidates = task.result?.candidates?.length
    ? task.result.candidates
    : task.result?.candidate
      ? [task.result.candidate]
      : [];
  if (candidates.length) return candidates.map((candidate, index) => ({
    key: candidate.id,
    label: t(locale, `候选 ${index + 1}`, `Candidate ${index + 1}`),
    state: 'completed',
    assetId: candidateAssetId(candidate),
  }));

  const assetIds = [
    ...(task.result?.assetIds ?? []),
    task.result?.sceneAssetId,
    task.result?.toolCandidate?.resultAssetId,
  ].filter((assetId): assetId is string => Boolean(assetId));
  return [...new Set(assetIds)].map((assetId, index) => ({
    key: assetId,
    label: t(locale, `结果 ${index + 1}`, `Result ${index + 1}`),
    state: 'completed',
    assetId,
  }));
};

const stateLabel = (locale: Locale, state: DesignGenerationSlotState): string => ({
  queued: t(locale, '排队', 'Queued'),
  running: t(locale, '处理中', 'Running'),
  completed: t(locale, '已完成', 'Completed'),
  failed: t(locale, '失败', 'Failed'),
  cancelled: t(locale, '已取消', 'Cancelled'),
})[state];

const stateTone = (state: DesignGenerationSlotState): BadgeTone => (
  state === 'completed' ? 'success' : state === 'failed' ? 'error' : state === 'cancelled' ? 'warning' : ''
);

export const TaskResultDrawer = ({ locale, libraryId, task, onClose, onRetrySlot }: TaskResultDrawerProps) => {
  const items = useMemo(() => buildResultItems(task, locale), [locale, task]);
  const assetKey = items.map((item) => item.assetId).filter(Boolean).join('|');
  const projectId = task?.source?.kind === 'project' ? task.source.id : undefined;
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const batchActive = task?.generationSlots?.some((slot) => slot.state === 'queued' || slot.state === 'running') ?? false;

  useEffect(() => {
    let cancelled = false;
    const assetIds = assetKey ? assetKey.split('|') : [];
    setPreviews({});
    if (!assetIds.length) return () => { cancelled = true; };
    if (!libraryId || !projectId || !getDesktopApi().readAsset) {
      setPreviews(Object.fromEntries(assetIds.map((assetId) => [assetId, null])));
      return () => { cancelled = true; };
    }
    const load = async (): Promise<void> => {
      const entries = await Promise.all(assetIds.map(async (assetId) => {
        try {
          const bytes = await getDesktopApi().readAsset?.({ libraryId, projectId, assetId });
          return [assetId, bytes ? imageUrl(bytes) : null] as const;
        } catch {
          return [assetId, null] as const;
        }
      }));
      if (!cancelled) setPreviews(Object.fromEntries(entries));
    };
    void load();
    return () => { cancelled = true; };
  }, [assetKey, libraryId, projectId, task?.id]);

  return <Drawer
    open={Boolean(task)}
    title={t(locale, '任务结果', 'Task results')}
    className="task-result-drawer"
    contentScrollKey={task?.id}
    locale={locale}
    onClose={onClose}
  >
    <div className="task-result-grid">
      {items.map((item) => {
        const preview = item.assetId ? previews[item.assetId] : null;
        const loading = Boolean(item.assetId) && preview === undefined;
        return <article className="task-result-card" key={item.key}>
          <div className={`task-result-card__preview is-${item.state}`}>
            {preview
              ? <img src={preview} alt={t(locale, '生成候选稿', 'Generated candidate')} />
              : <div className="task-result-card__placeholder">
                  <Icon name={item.state === 'failed' || item.state === 'cancelled' ? 'circle-alert' : 'image'} size={22} />
                  <span>{loading
                    ? t(locale, '正在加载', 'Loading')
                    : item.state === 'queued'
                      ? t(locale, '等待生成', 'Waiting to generate')
                      : item.state === 'running'
                        ? t(locale, '正在生成', 'Generating')
                        : t(locale, '预览不可用', 'Preview unavailable')}</span>
                </div>}
          </div>
          <div className="task-result-card__meta">
            <strong>{item.label}</strong>
            <Badge tone={stateTone(item.state)}>{stateLabel(locale, item.state)}</Badge>
            {item.errorCode ? <small title={item.errorCode}>{item.errorCode}</small> : null}
            {!batchActive && item.slotId && (item.state === 'failed' || item.state === 'cancelled') ? <IconButton
              name="rotate-ccw"
              label={t(locale, `重试${item.label}`, `Retry ${item.label}`)}
              onClick={() => onRetrySlot(task!.id, item.slotId!)}
            /> : null}
          </div>
        </article>;
      })}
      {task && items.length === 0 ? <p className="task-result-drawer__empty">{t(locale, '当前任务没有可预览的图片结果。', 'This task has no image result to preview.')}</p> : null}
    </div>
  </Drawer>;
};
