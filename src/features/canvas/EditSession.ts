import { getRevisionStore, type RevisionStore } from '../revisions/commit-revision';

export type EditSessionOptions = {
  projectId: string;
  documentId: string;
  sceneAssetId: string;
  baseRevisionId?: string | null;
  assetIds?: string[];
  readOnly?: boolean;
  revisionStore?: RevisionStore;
  storageKey?: string;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
};

export type EditSession<T> = {
  getDraft: () => T;
  getCommittedRevisionId: () => string | null;
  getHistory: () => T[];
  update: (patch: Partial<T> | ((current: T) => T)) => T;
  beginBatch: (batchId?: string) => void;
  endBatch: () => T;
  commitBatch: (operationId?: string) => Promise<{ revisionId: string }>;
  undo: () => T;
  redo: () => T;
  persistDraft: () => T;
  recover: () => T;
  applyAiResult: (result: T, token: string) => boolean;
  startAiRequest: () => string;
  cancel: () => T;
  clear: () => T;
  isReadOnly: () => boolean;
  hasUnsavedChanges: () => boolean;
};

const clone = <T>(value: T): T => structuredClone(value);

const makeToken = (): string => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const createEditSession = <T>(initial: T, options: EditSessionOptions): EditSession<T> => {
  const revisionStore = options.revisionStore ?? getRevisionStore();
  const storage = options.storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
  const storageKey = options.storageKey ?? `designhub.canvas.draft.${encodeURIComponent(options.projectId)}.${encodeURIComponent(options.documentId)}`;
  let draft = clone(initial);
  let persisted = clone(initial);
  let committedRevisionId = options.baseRevisionId ?? null;
  let history: T[] = [clone(initial)];
  let historyIndex = 0;
  let batchStart: T | null = null;
  let aiToken = '';
  let aiBaseline = '';
  const assertWritable = (): void => { if (options.readOnly) throw new Error('READ_ONLY'); };
  const record = (next: T): T => {
    draft = clone(next);
    if (batchStart === null) {
      history = [...history.slice(0, historyIndex + 1), clone(draft)];
      historyIndex = history.length - 1;
    }
    return clone(draft);
  };
  const getDraft = (): T => clone(draft);
  const getCommittedRevisionId = (): string | null => committedRevisionId;
  const getHistory = (): T[] => history.map(clone);
  const update = (patch: Partial<T> | ((current: T) => T)): T => {
    assertWritable();
    const next = typeof patch === 'function' ? patch(clone(draft)) : { ...draft, ...patch };
    return record(next);
  };
  const beginBatch = (): void => { assertWritable(); if (batchStart === null) batchStart = clone(draft); };
  const endBatch = (): T => {
    if (batchStart !== null) {
      history = [...history.slice(0, historyIndex + 1), clone(draft)];
      historyIndex = history.length - 1;
      batchStart = null;
    }
    return clone(draft);
  };
  const commitBatch = async (operationId = `canvas-${Date.now()}`): Promise<{ revisionId: string }> => {
    assertWritable();
    endBatch();
    const result = await revisionStore.commitRevision({
      projectId: options.projectId,
      documentId: options.documentId,
      baseRevisionId: committedRevisionId,
      operationId,
      sceneAssetId: options.sceneAssetId,
      assetIds: [...(options.assetIds ?? [])],
      contributions: [],
    });
    committedRevisionId = result.revisionId;
    persistDraft();
    return result;
  };
  const undo = (): T => {
    assertWritable();
    if (historyIndex > 0) historyIndex -= 1;
    draft = clone(history[historyIndex]);
    return clone(draft);
  };
  const redo = (): T => {
    assertWritable();
    if (historyIndex < history.length - 1) historyIndex += 1;
    draft = clone(history[historyIndex]);
    return clone(draft);
  };
  const persistDraft = (): T => {
    assertWritable();
    persisted = clone(draft);
    if (storage) storage.setItem(storageKey, JSON.stringify(persisted));
    return clone(persisted);
  };
  const recover = (): T => {
    const stored = storage?.getItem(storageKey);
    if (stored) {
      try { persisted = clone(JSON.parse(stored) as T); } catch { /* keep last valid draft */ }
    }
    draft = clone(persisted);
    history = [clone(draft)];
    historyIndex = 0;
    return clone(draft);
  };
  const startAiRequest = (): string => { aiToken = makeToken(); aiBaseline = JSON.stringify(draft); return aiToken; };
  const applyAiResult = (result: T, token: string): boolean => {
    if (options.readOnly || !token || token !== aiToken || JSON.stringify(draft) !== aiBaseline) return false;
    record(result);
    return true;
  };
  const cancel = (): T => { if (batchStart !== null) { draft = clone(batchStart); batchStart = null; } return clone(draft); };
  const clear = (): T => { assertWritable(); return record(initial); };
  const isReadOnly = (): boolean => options.readOnly === true;
  const hasUnsavedChanges = (): boolean => JSON.stringify(draft) !== JSON.stringify(persisted);
  return { getDraft, getCommittedRevisionId, getHistory, update, beginBatch, endBatch, commitBatch, undo, redo, persistDraft, recover, applyAiResult, startAiRequest, cancel, clear, isReadOnly, hasUnsavedChanges };
};
