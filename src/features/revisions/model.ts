export type CommitRevisionInput = {
  projectId: string;
  documentId: string;
  baseRevisionId: string | null;
  operationId: string;
  sceneAssetId: string;
  assetIds: string[];
  contributions: { designerVersionId: string; role: 'lead' | 'direction' | 'revision'; designerName?: string }[];
  operatorName?: string;
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
};

export type RevisionStore = {
  commitRevision: (input: CommitRevisionInput) => Promise<{ revisionId: string }>;
  getRevision: (revisionId: string) => RevisionRecord | undefined;
  setFinalRevision: (documentId: string, revisionId: string) => Promise<void>;
  getFinalRevision: (documentId: string) => string | null;
  listRevisions: (documentId: string) => RevisionRecord[];
};

const clone = <T>(value: T): T => structuredClone(value);

let revisionSequence = 0;

const nextRevisionId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  revisionSequence += 1;
  return `revision-${revisionSequence}`;
};

export const branchRevision = (base: { id: string; documentId: string }, id: string) => ({
  id,
  documentId: base.documentId,
  parentId: base.id,
});

export const createRevisionStore = (): RevisionStore => {
  const revisions = new Map<string, RevisionRecord>();
  const operations = new Map<string, string>();
  const finalRevisions = new Map<string, string>();

  const commitRevision = async (input: CommitRevisionInput): Promise<{ revisionId: string }> => {
    if (!input.projectId || !input.documentId || !input.operationId || !input.sceneAssetId) {
      throw new Error('INVALID_REVISION');
    }
    const existingRevisionId = operations.get(input.operationId);
    if (existingRevisionId) return { revisionId: existingRevisionId };

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
      createdAt: new Date().toISOString(),
    };
    revisions.set(revisionId, record);
    operations.set(input.operationId, revisionId);
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
  };

  const getFinalRevision = (documentId: string): string | null => finalRevisions.get(documentId) ?? null;

  const listRevisions = (documentId: string): RevisionRecord[] => [...revisions.values()]
    .filter((record) => record.documentId === documentId)
    .map((record) => clone(record));

  return { commitRevision, getRevision, setFinalRevision, getFinalRevision, listRevisions };
};
