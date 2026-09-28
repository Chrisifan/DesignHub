import type { CommitRevisionInput, RevisionTimelineEvent, RevisionRecord } from '../../features/revisions/model';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { isTrustedProjectLibraryRequest } from './workspace';

export const revisionLoadChannel = 'revision:load';
export const revisionCommitChannel = 'revision:commit';
export const revisionFinalizeChannel = 'revision:finalize';

type RevisionSender = { mainFrame: { url: string }; getURL: () => string };
type RevisionRequest = { sender: RevisionSender; senderFrame: { url: string } | null };
type RevisionWindow = { webContents: RevisionSender };
type Target = { libraryId: string; projectId: string; documentId: string };
export type RevisionState = { revisions: RevisionRecord[]; timeline: RevisionTimelineEvent[]; finalRevisionId: string | null };

const isId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 512 && !/[\\/\u0000]/u.test(value);
const isTarget = (value: unknown): value is Target => typeof value === 'object' && value !== null && isId((value as Record<string, unknown>).libraryId) && isId((value as Record<string, unknown>).projectId) && isId((value as Record<string, unknown>).documentId);
const isCommitInput = (value: unknown): value is Target & CommitRevisionInput => {
  if (!isTarget(value)) return false;
  const input = value as Record<string, unknown>;
  return isId(input.operationId)
    && (input.baseRevisionId === null || isId(input.baseRevisionId))
    && isId(input.sceneAssetId)
    && Array.isArray(input.assetIds)
    && input.assetIds.every((id: unknown) => isId(id))
    && Array.isArray(input.contributions);
};

export const loadRevisionsHandler = (
  window: RevisionWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  load: (workspace: ProjectLibraryHandle, target: Target) => Promise<RevisionState>,
) => async (event: RevisionRequest, input: unknown): Promise<RevisionState | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isTarget(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return load(workspace, input);
};

export const commitRevisionHandler = (
  window: RevisionWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  commit: (workspace: ProjectLibraryHandle, input: Target & CommitRevisionInput) => Promise<{ revisionId: string }>,
) => async (event: RevisionRequest, input: unknown): Promise<{ revisionId: string } | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isCommitInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId || workspace.library.openMode !== 'writable') return null;
  return commit(workspace, input);
};

export const finalizeRevisionHandler = (
  window: RevisionWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  finalize: (workspace: ProjectLibraryHandle, input: Target & { revisionId: string }) => Promise<boolean>,
) => async (event: RevisionRequest, input: unknown): Promise<boolean | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isTarget(input) || !isId((input as Record<string, unknown>).revisionId)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId || workspace.library.openMode !== 'writable') return null;
  return finalize(workspace, input as Target & { revisionId: string });
};
