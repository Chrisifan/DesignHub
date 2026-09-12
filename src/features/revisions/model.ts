import type { DesignScene } from '../canvas/scene';

export type CommitRevisionInput = {
  projectId: string;
  documentId: string;
  baseRevisionId: string | null;
  operationId: string;
  sceneAssetId: string;
  assetIds: string[];
  contributions: { designerVersionId: string; role: 'lead' | 'direction' | 'revision'; designerName?: string }[];
  operatorName?: string;
  scene?: DesignScene;
};

export type DesignerContributionInput = CommitRevisionInput['contributions'][number];

export type RevisionRecord = {
  revisionId: string;
  projectId: string;
  documentId: string;
  parentRevisionId: string | null;
  operationId: string;
  sceneAssetId: string;
  assetIds: string[];
  contributions: DesignerContributionInput[];
  operatorName?: string;
  createdAt: string;
  scene?: DesignScene;
};

export type RevisionTimelineEvent = {
  id: string;
  kind: 'revision' | 'finalized';
  label: string;
  documentId: string;
  revisionId: string;
  timestamp: string;
};

export type RevisionStore = {
  commitRevision: (input: CommitRevisionInput) => Promise<{ revisionId: string }>;
  getRevision: (revisionId: string) => RevisionRecord | undefined;
  setFinalRevision: (documentId: string, revisionId: string) => Promise<void>;
  getFinalRevision: (documentId: string) => string | null;
  listRevisions: (documentId: string) => RevisionRecord[];
  listTimeline: (documentId: string) => RevisionTimelineEvent[];
};

const clone = <T>(value: T): T => structuredClone(value);

let revisionSequence = 0;

const nextRevisionId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  revisionSequence += 1;
  return `revision-${revisionSequence}`;
};

const operationFingerprint = (input: CommitRevisionInput): string => JSON.stringify({
  projectId: input.projectId,
  documentId: input.documentId,
  baseRevisionId: input.baseRevisionId,
  sceneAssetId: input.sceneAssetId,
  assetIds: input.assetIds,
  contributions: input.contributions,
  operatorName: input.operatorName,
  scene: input.scene,
});

export const branchRevision = (base: { id: string; documentId: string }, id: string) => ({
  id,
  documentId: base.documentId,
  parentId: base.id,
});

export const createRevisionStore = (): RevisionStore => {
  const revisions = new Map<string, RevisionRecord>();
  const operations = new Map<string, { revisionId: string; fingerprint: string }>();
  const finalRevisions = new Map<string, string>();
  const timeline = new Map<string, RevisionTimelineEvent[]>();
  let finalizationSequence = 0;

  const commitRevision = async (input: CommitRevisionInput): Promise<{ revisionId: string }> => {
    if (!input.projectId || !input.documentId || !input.operationId || !input.sceneAssetId) {
      throw new Error('INVALID_REVISION');
    }
    const fingerprint = operationFingerprint(input);
    const existingOperation = operations.get(input.operationId);
    if (existingOperation) {
      if (existingOperation.fingerprint !== fingerprint) throw new Error('OPERATION_CONFLICT');
      return { revisionId: existingOperation.revisionId };
    }

    if (input.baseRevisionId) {
      const parent = revisions.get(input.baseRevisionId);
      if (!parent) throw new Error('REVISION_NOT_FOUND');
      if (parent.projectId !== input.projectId || parent.documentId !== input.documentId) {
        throw new Error('DOCUMENT_MISMATCH');
      }
    }

    const revisionId = nextRevisionId();
    const record: RevisionRecord = {
      revisionId,
      projectId: input.projectId,
      documentId: input.documentId,
      parentRevisionId: input.baseRevisionId,
      operationId: input.operationId,
      sceneAssetId: input.sceneAssetId,
      assetIds: [...input.assetIds],
      contributions: clone(input.contributions),
      ...(input.operatorName === undefined ? {} : { operatorName: input.operatorName }),
      ...(input.scene === undefined ? {} : { scene: clone(input.scene) }),
      createdAt: new Date().toISOString(),
    };
    revisions.set(revisionId, record);
    operations.set(input.operationId, { revisionId, fingerprint });
    const revisionEvent: RevisionTimelineEvent = {
      id: `event-${revisionId}`,
      kind: 'revision',
      label: `Revision ${revisionId}`,
      documentId: input.documentId,
      revisionId,
      timestamp: record.createdAt,
    };
    timeline.set(input.documentId, [...(timeline.get(input.documentId) ?? []), revisionEvent]);
    return { revisionId };
  };

  const getRevision = (revisionId: string): RevisionRecord | undefined => {
    const record = revisions.get(revisionId);
    return record ? clone(record) : undefined;
  };

  const setFinalRevision = async (documentId: string, revisionId: string): Promise<void> => {
    const record = revisions.get(revisionId);
    if (!record) throw new Error('REVISION_NOT_FOUND');
    if (record.documentId !== documentId) throw new Error('DOCUMENT_MISMATCH');
    finalRevisions.set(documentId, revisionId);
    finalizationSequence += 1;
    const event: RevisionTimelineEvent = {
      id: `finalized-${documentId}-${revisionId}-${finalizationSequence}`,
      kind: 'finalized',
      label: 'Final revision selected',
      documentId,
      revisionId,
      timestamp: new Date().toISOString(),
    };
    timeline.set(documentId, [...(timeline.get(documentId) ?? []), event]);
  };

  const getFinalRevision = (documentId: string): string | null => finalRevisions.get(documentId) ?? null;

  const listRevisions = (documentId: string): RevisionRecord[] => [...revisions.values()]
    .filter((record) => record.documentId === documentId)
    .map((record) => clone(record));

  const listTimeline = (documentId: string): RevisionTimelineEvent[] => clone(timeline.get(documentId) ?? []);

  return { commitRevision, getRevision, setFinalRevision, getFinalRevision, listRevisions, listTimeline };
};
