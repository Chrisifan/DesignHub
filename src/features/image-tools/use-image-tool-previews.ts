import { useEffect, useRef, useState } from 'react';

import type { ImageToolItem, ImageToolJob } from './jobs';
import { imageToolPreviewKey } from './view-model';

type ImageToolPreviewJob = { job: ImageToolJob; items: ImageToolItem[] };

export type ReadImageToolResult = (path: string, jobId: string) => Promise<string | null>;

/** Loads completed batch results once while protecting the page from late renderer updates. */
export const useImageToolPreviews = (
  jobs: readonly ImageToolPreviewJob[],
  onReadResult?: ReadImageToolResult,
): Readonly<Record<string, string>> => {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const loadedPaths = useRef(new Map<string, string>());
  const pendingKeys = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    const pending = jobs.flatMap(({ job, items }) => items.flatMap((item) => {
      if (!item.resultPath) return [];
      const key = imageToolPreviewKey(job.id, item.id);
      if (loadedPaths.current.get(key) === item.resultPath || pendingKeys.current.has(key)) return [];
      if (!onReadResult) {
        loadedPaths.current.set(key, item.resultPath);
        return [];
      }
      pendingKeys.current.add(key);
      return [onReadResult(item.resultPath, job.id).then((dataUrl) => {
        pendingKeys.current.delete(key);
        if (!cancelled && dataUrl) {
          loadedPaths.current.set(key, item.resultPath!);
          setPreviews((current) => ({ ...current, [key]: dataUrl }));
        }
      }).catch(() => {
        pendingKeys.current.delete(key);
      })];
    }));
    void Promise.all(pending);
    return () => {
      cancelled = true;
    };
  }, [jobs, onReadResult]);

  return previews;
};
