import type { Page } from 'playwright/test';

import type { DesktopApi, ImageToolJobSnapshot } from '../../src/platform/contracts';
import { aggregateImageToolJobState } from '../../src/features/image-tools/jobs';

type BridgeCall = { method: string; input: unknown };
type FixtureWindow = Window & {
  imageToolFixture: { calls: BridgeCall[]; jobs: ImageToolJobSnapshot[] };
};

export const imageToolPaths = {
  source: '/tmp/batch-browser-source',
  output: '/tmp/batch-browser-output',
  folder: 'browser-results',
};

/** Installs only the desktop boundary; all navigation and rendering stay in the app. */
export const installImageToolBridge = async (
  page: Page,
  created: ImageToolJobSnapshot,
  initial: ImageToolJobSnapshot[] = [],
): Promise<void> => {
  await page.evaluate(({ snapshot, jobs, paths }) => {
    const state = { calls: [] as BridgeCall[], jobs };
    (window as unknown as FixtureWindow).imageToolFixture = state;
    const record = (method: string, input: unknown = null): void => {
      state.calls.push({ method, input: structuredClone(input) });
    };
    const find = (jobId: string): ImageToolJobSnapshot => {
      const found = state.jobs.find(({ job }) => job.id === jobId);
      if (!found) throw new Error('IMAGE_TOOL_JOB_NOT_FOUND');
      return found;
    };
    const aggregate = (entry: ImageToolJobSnapshot): void => {
      const states = entry.items.map((item) => item.state);
      entry.job.state = states.includes('running') ? 'running'
        : states.includes('unknown') ? 'unknown'
          : states.includes('queued') ? 'queued'
            : states.every((value) => value === 'cancelled') ? 'cancelled'
              : states.includes('failed') ? 'failed' : 'completed';
      entry.job.updatedAt = new Date().toISOString();
    };
    const bridge: Partial<DesktopApi> = {
      chooseImageToolInput: async () => {
        record('chooseInput');
        return { kind: 'directory', path: paths.source, displayName: 'Browser source' };
      },
      chooseImageToolOutput: async () => {
        record('chooseOutput');
        return { kind: 'directory', path: paths.output, displayName: 'Browser output' };
      },
      scanImageToolSources: async (input) => {
        record('scan', input);
        return {
          sourceRoot: paths.source,
          source: 'directory',
          accepted: snapshot.items.map((item) => ({
            absolutePath: `${paths.source}/${item.relativePath}`,
            relativePath: item.relativePath,
            bytes: 1024,
          })),
          rejected: [{ path: 'notes.txt', code: 'UNSUPPORTED_FORMAT', detail: 'Unsupported image format' }],
          outputPaths: snapshot.items.map((item) => `${snapshot.job.outputRoot}/${item.relativePath}`),
        };
      },
      createImageToolJob: async (input) => {
        record('create', input);
        state.jobs.push(structuredClone(snapshot));
        return structuredClone(snapshot);
      },
      listImageToolJobs: async (libraryId) => {
        record('list', libraryId);
        return structuredClone(state.jobs);
      },
      pauseImageToolJob: async (input) => {
        record('pause', input);
        const entry = find(input.jobId);
        entry.job.state = 'paused';
        entry.job.updatedAt = new Date().toISOString();
        return structuredClone(entry);
      },
      resumeImageToolJob: async (input) => {
        record('resume', input);
        const entry = find(input.jobId);
        aggregate(entry);
        return structuredClone(entry);
      },
      cancelImageToolJob: async (input) => {
        record('cancel', input);
        const entry = find(input.jobId);
        entry.items = entry.items.map((item) => item.state === 'queued'
          ? { ...item, state: 'cancelled', errorCode: 'CANCELLED', updatedAt: new Date().toISOString() }
          : item);
        aggregate(entry);
        return structuredClone(entry);
      },
      retryImageToolItem: async (input) => {
        record('retry', input);
        const entry = find(input.jobId);
        entry.items = entry.items.map((item) => item.id === input.itemId ? {
          ...item, state: 'queued', attempt: item.attempt + 1,
          errorCode: undefined, resultPath: undefined,
          outputRoot: `${entry.job.outputRoot}/retry-${item.id}-${item.attempt + 1}`,
          updatedAt: new Date().toISOString(),
        } : item);
        aggregate(entry);
        return structuredClone(entry);
      },
      readImageToolResult: async (input) => {
        record('read', input);
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw2X7wAAAABJRU5ErkJggg==';
      },
      openImageToolResult: async (input) => { record('open', input); return true; },
      revealImageToolResult: async (input) => { record('reveal', input); return true; },
      openImageToolOutput: async (input) => { record('openOutput', input); return true; },
      importImageToolResult: async (input) => {
        record('import', input);
        return { id: 'asset-batch-result', name: 'result.png', format: 'PNG', mimeType: 'image/png', contentHash: 'a'.repeat(64), managed: true };
      },
    };
    Object.assign(window.designhub, bridge);
  }, { snapshot: created, jobs: initial, paths: imageToolPaths });
};

export const readImageToolCalls = async (page: Page): Promise<BridgeCall[]> =>
  page.evaluate(() => (window as unknown as FixtureWindow).imageToolFixture.calls);

/** Represents a worker/store update; the real one-second renderer refresh consumes it. */
export const publishImageToolSnapshot = async (page: Page, snapshot: ImageToolJobSnapshot): Promise<void> => {
  const updated = { ...snapshot, job: { ...snapshot.job, state: aggregateImageToolJobState(snapshot.items) } };
  await page.evaluate((entry) => {
    const state = (window as unknown as FixtureWindow).imageToolFixture;
    const index = state.jobs.findIndex(({ job }) => job.id === entry.job.id);
    if (index < 0) throw new Error('IMAGE_TOOL_JOB_NOT_FOUND');
    state.jobs[index] = entry;
  }, updated);
};
