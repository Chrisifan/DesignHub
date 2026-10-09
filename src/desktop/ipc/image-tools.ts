import type { BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import type { ManagedAsset } from '../../features/assets/import-assets';
import { batchImageTools, createImageToolJob, recoverImageToolSnapshot, type BatchImageTool, type ImageToolItem, type ToolExecutor, type ToolParams } from '../../features/image-tools/jobs';
import { createImageToolJobStore, type ImageToolJobSnapshot } from '../../features/image-tools/job-store';
import { scanImageSources } from '../../features/image-tools/scanner';
import { createImageToolScheduler } from '../../features/image-tools/scheduler';
import type { ProviderBatchRequest } from '../../features/image-tools/worker';
import { isTrustedProjectLibraryRequest } from './workspace';
export * from './image-tools-channels';

type Sender = { mainFrame: { url: string }; getURL: () => string };
type Request = { sender: Sender; senderFrame: { url: string } | null };
type Window = { webContents: Sender };
type DirectoryDialog = (window: BrowserWindow, properties: string[]) => Promise<{ canceled: boolean; filePaths: string[] }>;
type OpenPath = (path: string) => Promise<string>;
type RevealPath = (path: string) => void;
type ImportAsset = (library: ProjectLibraryHandle, input: { libraryId: string; projectId: string; items: Array<{ name: string; mimeType: string; data: Uint8Array }> }) => Promise<ManagedAsset | null>;

const id = (): string => `image-job-${randomUUID()}`;
const itemId = (): string => `image-item-${randomUUID()}`;
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isTool = (value: unknown): value is BatchImageTool => typeof value === 'string' && (batchImageTools as readonly string[]).includes(value);
const isParams = (value: unknown): value is ToolParams => typeof value === 'object' && value !== null && !Array.isArray(value);
const isLibraryInput = (value: unknown): value is { libraryId: string } => typeof value === 'object' && value !== null && nonEmpty((value as Record<string, unknown>).libraryId);
const isJobInput = (value: unknown): value is { libraryId: string; tool: BatchImageTool; params: ToolParams; sourcePath: string; outputRoot: string; resultFolderName?: string; connectionId?: string } => {
  if (!isLibraryInput(value)) return false;
  const input = value as Record<string, unknown>;
  return isTool(input.tool) && isParams(input.params) && nonEmpty(input.sourcePath) && nonEmpty(input.outputRoot)
    && (input.resultFolderName === undefined || /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(input.resultFolderName as string))
    && (input.connectionId === undefined || nonEmpty(input.connectionId));
};
const isJobRef = (value: unknown): value is { libraryId: string; jobId: string } => isLibraryInput(value) && nonEmpty((value as Record<string, unknown>).jobId);
const isItemRef = (value: unknown): value is { libraryId: string; jobId: string; itemId: string } => isJobRef(value) && nonEmpty((value as Record<string, unknown>).itemId);
const isPathRef = (value: unknown): value is { libraryId: string; jobId: string; path: string } => isJobRef(value) && nonEmpty((value as Record<string, unknown>).path);
const isImportRef = (value: unknown): value is { libraryId: string; projectId: string; jobId: string; path: string } => isPathRef(value) && nonEmpty((value as Record<string, unknown>).projectId);

export type ImageToolIpcDeps = {
  window: Window;
  trustedUrl: string;
  getLibrary: () => ProjectLibraryHandle | null;
  showDialog: DirectoryDialog;
  openPath?: OpenPath;
  revealPath?: RevealPath;
  importAsset?: ImportAsset;
  executeProvider?: (request: ProviderBatchRequest) => Promise<Uint8Array | { bytes: Uint8Array; remoteRequestId?: string }>;
};

const rootFor = (library: ProjectLibraryHandle): string => join(library.library.directory, '.designhub');
const storeFor = (library: ProjectLibraryHandle) => createImageToolJobStore(rootFor(library));
const active = (deps: ImageToolIpcDeps, libraryId: string): ProjectLibraryHandle | null => {
  const library = deps.getLibrary();
  return library?.library.libraryId === libraryId ? library : null;
};
const isWithin = (parent: string, child: string): boolean => {
  const relativePath = relative(resolve(parent), resolve(child));
  return relativePath === '' || (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath));
};
const outputRootFor = (input: { outputRoot: string; resultFolderName?: string; tool: BatchImageTool }): { outputRoot: string; resultFolderName: string } => {
  const resultFolderName = input.resultFolderName ?? `${input.tool}-${randomUUID().slice(0, 8)}`;
  return { resultFolderName, outputRoot: join(resolve(input.outputRoot), resultFolderName) };
};

export const createImageToolIpcHandlers = (deps: ImageToolIpcDeps) => {
  const schedulers = new Map<string, ReturnType<typeof createImageToolScheduler>>();
  const hydratedJobs = new Map<string, Set<string>>();
  const hydratingJobs = new Map<string, Promise<ImageToolJobSnapshot | null>>();
  const saveQueues = new Map<string, Promise<void>>();
  const saveSnapshot = async (library: ProjectLibraryHandle, snapshot: ImageToolJobSnapshot): Promise<void> => {
    const key = `${library.library.libraryId}:${snapshot.job.id}`;
    const previous = saveQueues.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => storeFor(library).save(snapshot.job, snapshot.items));
    saveQueues.set(key, next);
    try {
      await next;
    } finally {
      if (saveQueues.get(key) === next) saveQueues.delete(key);
    }
  };
  const queueSnapshotSave = (library: ProjectLibraryHandle, snapshot: ImageToolJobSnapshot): void => {
    void saveSnapshot(library, snapshot).catch(() => undefined);
  };
  const getScheduler = (library: ProjectLibraryHandle) => {
    const key = library.library.libraryId;
    const existing = schedulers.get(key);
    if (existing) return existing;
    const scheduler = createImageToolScheduler({ executeProvider: deps.executeProvider, onUpdate: (snapshot) => { queueSnapshotSave(library, snapshot); } });
    schedulers.set(key, scheduler);
    hydratedJobs.set(key, new Set());
    return scheduler;
  };
  const hydrateJob = async (library: ProjectLibraryHandle, jobId: string): Promise<ImageToolJobSnapshot | null> => {
    const scheduler = getScheduler(library);
    const libraryId = library.library.libraryId;
    const hydrated = hydratedJobs.get(libraryId)!;
    const existing = scheduler.get(jobId);
    if (existing) {
      hydrated.add(jobId);
      return existing;
    }
    const key = `${libraryId}:${jobId}`;
    const pending = hydratingJobs.get(key);
    if (pending) return pending;
    const hydration = (async (): Promise<ImageToolJobSnapshot | null> => {
      const stored = await storeFor(library).load(jobId);
      if (!stored) return null;
      const alreadyEnqueued = scheduler.get(jobId);
      if (alreadyEnqueued) {
        hydrated.add(jobId);
        return alreadyEnqueued;
      }
      const recovered = recoverImageToolSnapshot(stored.job, stored.items);
      scheduler.enqueue(recovered.job, recovered.items);
      hydrated.add(jobId);
      if (JSON.stringify(recovered) !== JSON.stringify(stored)) await saveSnapshot(library, recovered);
      return scheduler.get(jobId);
    })();
    hydratingJobs.set(key, hydration);
    try {
      return await hydration;
    } finally {
      if (hydratingJobs.get(key) === hydration) hydratingJobs.delete(key);
    }
  };
  const list = async (library: ProjectLibraryHandle): Promise<ImageToolJobSnapshot[]> => {
    const { readdir } = await import('node:fs/promises');
    const directory = join(rootFor(library), 'image-tool-jobs');
    const names = await readdir(directory).catch(() => [] as string[]);
    const snapshots = await Promise.all(names.filter((name) => name.endsWith('.json')).map((name) => storeFor(library).load(name.slice(0, -5))));
    return snapshots.filter((snapshot): snapshot is ImageToolJobSnapshot => Boolean(snapshot));
  };
  const choose = async (event: Request, window: BrowserWindow, properties: string[]): Promise<{ path: string; kind: 'file' | 'directory'; displayName: string } | null> => {
    if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl)) return null;
    const result = await deps.showDialog(window, properties);
    const path = result.canceled ? undefined : result.filePaths[0];
    if (!path) return null;
    const { basename } = await import('node:path');
    return { path, kind: properties.includes('openFile') ? 'file' : 'directory', displayName: basename(path) };
  };
  const requireWritable = (library: ProjectLibraryHandle): void => {
    if (library.library.openMode !== 'writable') throw new Error('PROJECT_LIBRARY_READ_ONLY');
  };
  return {
    chooseInput: (event: Request, window: BrowserWindow) => choose(event, window, ['openFile', 'openDirectory', 'createDirectory']),
    chooseOutput: (event: Request, window: BrowserWindow) => choose(event, window, ['openDirectory', 'createDirectory']),
    scan: async (event: Request, input: unknown) => {
      if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl) || !isJobInput(input)) return null;
      const library = active(deps, input.libraryId);
      if (!library) return null;
      const output = outputRootFor(input);
      return scanImageSources({ sourcePath: input.sourcePath, outputRoot: output.outputRoot, tool: input.tool, outputFormat: typeof input.params.format === 'string' ? input.params.format as 'png' | 'jpeg' | 'webp' : undefined });
    },
    create: async (event: Request, input: unknown): Promise<ImageToolJobSnapshot | null> => {
      if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl) || !isJobInput(input)) return null;
      const library = active(deps, input.libraryId);
      if (!library) return null;
      requireWritable(library);
      const output = outputRootFor(input);
      const scan = await scanImageSources({ sourcePath: input.sourcePath, outputRoot: output.outputRoot, tool: input.tool, outputFormat: typeof input.params.format === 'string' ? input.params.format as 'png' | 'jpeg' | 'webp' : undefined });
      if (!scan.accepted.length) throw new Error('IMAGE_TOOL_NO_INPUTS');
      if ((input.tool === 'remove-background' || input.tool === 'upscale') && !input.connectionId) throw new Error('CONNECTION_REQUIRED');
      const job = createImageToolJob({ id: id(), libraryId: input.libraryId, tool: input.tool, params: input.params, sourceRoot: scan.sourceRoot, outputRoot: output.outputRoot, resultFolderName: output.resultFolderName, createdFrom: scan.source, itemIds: scan.accepted.map(() => itemId()), executor: input.tool === 'resize' || input.tool === 'format-convert' ? { kind: 'local', engine: 'image-codec' } : { kind: 'provider', connectionId: input.connectionId ?? '', modelId: '' } satisfies ToolExecutor });
      const items: ImageToolItem[] = scan.accepted.map((item, index) => ({ id: job.itemIds[index], jobId: job.id, relativePath: item.relativePath, state: 'queued', attempt: 1, ...(job.executor?.kind === 'provider' ? { modelTaskId: `model-task-${randomUUID()}` } : {}), updatedAt: job.createdAt }));
      const snapshot = { job, items };
      await saveSnapshot(library, snapshot);
      const scheduler = getScheduler(library);
      scheduler.enqueue(job, items);
      hydratedJobs.get(input.libraryId)?.add(job.id);
      return snapshot;
    },
    list: async (event: Request, libraryId: unknown) => {
      if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl) || !nonEmpty(libraryId)) return null;
      const library = active(deps, libraryId);
      if (!library) return null;
      const snapshots = await list(library);
      return Promise.all(snapshots.map(async (snapshot) => (await hydrateJob(library, snapshot.job.id)) ?? snapshot));
    },
    get: async (event: Request, input: unknown) => {
      if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl) || !isJobRef(input)) return null;
      const library = active(deps, input.libraryId);
      return library ? hydrateJob(library, input.jobId) : null;
    },
    pause: async (event: Request, input: unknown) => {
      if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl) || !isJobRef(input)) return null;
      const library = active(deps, input.libraryId); if (!library) return null; requireWritable(library);
      await hydrateJob(library, input.jobId); const snapshot = getScheduler(library).pauseJob(input.jobId); await saveSnapshot(library, snapshot); return snapshot;
    },
    resume: async (event: Request, input: unknown) => {
      if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl) || !isJobRef(input)) return null;
      const library = active(deps, input.libraryId); if (!library) return null; requireWritable(library);
      await hydrateJob(library, input.jobId); const snapshot = getScheduler(library).resumeJob(input.jobId); await saveSnapshot(library, snapshot); return snapshot;
    },
    cancel: async (event: Request, input: unknown) => {
      if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl) || !isJobRef(input)) return null;
      const library = active(deps, input.libraryId); if (!library) return null; requireWritable(library);
      await hydrateJob(library, input.jobId); const snapshot = getScheduler(library).cancelJob(input.jobId); await saveSnapshot(library, snapshot); return snapshot;
    },
    retry: async (event: Request, input: unknown) => {
      if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl) || !isItemRef(input)) return null;
      const library = active(deps, input.libraryId); if (!library) return null; requireWritable(library);
      await hydrateJob(library, input.jobId); const snapshot = getScheduler(library).retryItem(input.jobId, input.itemId); await saveSnapshot(library, snapshot); return snapshot;
    },
    queryItem: async (event: Request, input: unknown): Promise<ImageToolItem | null> => {
      if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl) || !isItemRef(input)) return null;
      const library = active(deps, input.libraryId); if (!library) return null;
      const snapshot = await hydrateJob(library, input.jobId);
      return snapshot?.items.find((item) => item.id === input.itemId) ?? null;
    },
    cancelItem: async (event: Request, input: unknown): Promise<ImageToolJobSnapshot | null> => {
      if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl) || !isItemRef(input)) return null;
      const library = active(deps, input.libraryId); if (!library) return null; requireWritable(library);
      await hydrateJob(library, input.jobId); const snapshot = getScheduler(library).cancelItem(input.jobId, input.itemId); await saveSnapshot(library, snapshot); return snapshot;
    },
    readResult: async (event: Request, input: unknown): Promise<string | null> => {
      if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl) || !isPathRef(input)) return null;
      const library = active(deps, input.libraryId); if (!library) return null;
      const stored = await storeFor(library).load(input.jobId);
      if (!stored || !isWithin(stored.job.outputRoot, input.path) || !stored.items.some((item) => item.resultPath === input.path)) return null;
      const extension = extname(input.path).toLowerCase();
      const mimeType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : null;
      if (!mimeType) return null;
      try {
        const { readFile } = await import('node:fs/promises');
        const bytes = await readFile(input.path);
        return `data:${mimeType};base64,${bytes.toString('base64')}`;
      } catch {
        return null;
      }
    },
    openResult: async (event: Request, input: unknown) => {
      if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl) || !isPathRef(input) || !deps.openPath) return false;
      const library = active(deps, input.libraryId); if (!library) return false;
      const snapshot = await storeFor(library).load(input.jobId); const path = input.path;
      if (!snapshot || !isWithin(snapshot.job.outputRoot, path) || !snapshot.items.some((item) => item.resultPath === path)) return false;
      return (await deps.openPath(path)) === '';
    },
    revealResult: async (event: Request, input: unknown) => {
      if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl) || !isPathRef(input) || !deps.revealPath) return false;
      const library = active(deps, input.libraryId); if (!library) return false;
      const snapshot = await storeFor(library).load(input.jobId); const path = input.path;
      if (!snapshot || !isWithin(snapshot.job.outputRoot, path)) return false;
      deps.revealPath(path); return true;
    },
    openOutput: async (event: Request, input: unknown) => {
      if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl) || !isPathRef(input) || !deps.openPath) return false;
      const library = active(deps, input.libraryId); if (!library) return false;
      const snapshot = await storeFor(library).load(input.jobId); const path = input.path;
      if (!snapshot || !isWithin(snapshot.job.outputRoot, path)) return false;
      return (await deps.openPath(path)) === '';
    },
    importResult: async (event: Request, input: unknown): Promise<ManagedAsset | null> => {
      if (!isTrustedProjectLibraryRequest(event, deps.window, deps.trustedUrl) || !isImportRef(input) || !deps.importAsset) return null;
      const library = active(deps, input.libraryId); if (!library) return null;
      requireWritable(library);
      const stored = await storeFor(library).load(input.jobId);
      if (!stored || !isWithin(stored.job.outputRoot, input.path) || !stored.items.some((item) => item.resultPath === input.path)) return null;
      const { readFile } = await import('node:fs/promises');
      const { basename, extname } = await import('node:path');
      const bytes = new Uint8Array(await readFile(input.path));
      const extension = extname(input.path).toLowerCase();
      const mimeType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
      return deps.importAsset(library, { libraryId: input.libraryId, projectId: input.projectId, items: [{ name: basename(input.path), mimeType, data: bytes }] });
    },
  };
};
