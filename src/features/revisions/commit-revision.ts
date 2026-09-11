import {
  createRevisionStore,
  type CommitRevisionInput,
  type RevisionRecord,
  type RevisionStore,
  type RevisionTimelineEvent,
} from './model';

export type { CommitRevisionInput, RevisionRecord, RevisionStore, RevisionTimelineEvent } from './model';
export { createRevisionStore } from './model';

const revisionStore = createRevisionStore();

export const commitRevision = (input: CommitRevisionInput): Promise<{ revisionId: string }> => (
  revisionStore.commitRevision(input)
);

export const setFinalRevision = (documentId: string, revisionId: string): Promise<void> => (
  revisionStore.setFinalRevision(documentId, revisionId)
);

export const getRevision = (revisionId: string): RevisionRecord | undefined => revisionStore.getRevision(revisionId);

export const getFinalRevision = (documentId: string): string | null => revisionStore.getFinalRevision(documentId);

export const listRevisions = (documentId: string): RevisionRecord[] => revisionStore.listRevisions(documentId);

export const listTimeline = (documentId: string): RevisionTimelineEvent[] => revisionStore.listTimeline(documentId);

export const getRevisionStore = (): RevisionStore => revisionStore;
