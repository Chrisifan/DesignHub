import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants, lstatSync, realpathSync, readFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import type { CommitRevisionInput, RevisionRecord, RevisionTimelineEvent } from '../../features/revisions/model';
import type { DesignScene } from '../../features/canvas/scene';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { getWritableWorkspaceLease } from './workspace-store';
import { resolveProjectDirectory } from './project-store';

export type PersistedRevisionState = {
  revisions: RevisionRecord[];
  timeline: RevisionTimelineEvent[];
  finalRevisionId: string | null;
};

const documentIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u;
const revisionFileName = (documentId: string): string => {
  if (!documentIdPattern.test(documentId)) throw new Error('INVALID_DOCUMENT_ID');
  return `${documentId}.revisions.json`;
};
const clone = <T>(value: T): T => structuredClone(value);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isScene = (value: unknown): value is DesignScene => isRecord(value)
  && typeof value.id === 'string' && Number.isFinite(value.width) && Number.isFinite(value.height) && Array.isArray(value.layers);
const isRevision = (value: unknown): value is RevisionRecord => isRecord(value)
  && typeof value.revisionId === 'string' && value.revisionId.length > 0
  && typeof value.projectId === 'string' && value.projectId.length > 0
  && typeof value.documentId === 'string' && value.documentId.length > 0
  && (value.parentRevisionId === null || typeof value.parentRevisionId === 'string')
  && typeof value.operationId === 'string' && value.operationId.length > 0
  && typeof value.sceneAssetId === 'string' && value.sceneAssetId.length > 0
  && Array.isArray(value.assetIds) && value.assetIds.every((id) => typeof id === 'string')
  && Array.isArray(value.contributions)
  && (value.scene === undefined || isScene(value.scene))
  && typeof value.createdAt === 'string' && !Number.isNaN(Date.parse(value.createdAt))
  && (value.operatorName === undefined || typeof value.operatorName === 'string');
const isTimelineEvent = (value: unknown): value is RevisionTimelineEvent => isRecord(value)
  && typeof value.id === 'string' && value.id.length > 0
  && (value.kind === 'revision' || value.kind === 'finalized')
  && typeof value.label === 'string'
  && typeof value.documentId === 'string' && value.documentId.length > 0
  && typeof value.revisionId === 'string' && value.revisionId.length > 0
  && typeof value.timestamp === 'string' && !Number.isNaN(Date.parse(value.timestamp));
const emptyState = (): PersistedRevisionState => ({ revisions: [], timeline: [], finalRevisionId: null });

const assertRegularRevisionFile = (file: string): void => {
  try {
    const status = lstatSync(file);
    if (!status.isFile() || status.isSymbolicLink()) throw new Error('INVALID_REVISION_STATE');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return;
    if (error instanceof Error && error.message === 'INVALID_REVISION_STATE') throw error;
    throw new Error('INVALID_REVISION_STATE');
  }
};

const getDocumentsDirectory = (projectDirectory: string, writable: boolean): string => {
  const directory = join(projectDirectory, 'documents');
  try {
    const status = lstatSync(directory);
    if (!status.isDirectory() || status.isSymbolicLink() || realpathSync(directory) !== directory) throw new Error('INVALID_PROJECT_PATH');
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PROJECT_PATH') throw error;
    if (!writable) return directory;
    if (isRecord(error) && error.code === 'ENOENT') {
      mkdirSync(directory, { recursive: false });
      return directory;
    }
    throw error;
  }
  return directory;
};

const validateTarget = (handle: WorkspaceHandle, workspaceId: string, projectId: string, documentId: string, writable: boolean): { directory: string; file: string } => {
  if (handle.workspace.workspaceId !== workspaceId) throw new Error('WORKSPACE_IDENTITY_MISMATCH');
  if (writable && !getWritableWorkspaceLease(handle)) throw new Error('WORKSPACE_NOT_WRITABLE');
  const projectDirectory = resolveProjectDirectory(handle, projectId);
  if (!projectDirectory) throw new Error('PROJECT_NOT_FOUND');
  const metadataPath = join(projectDirectory, 'designhub.project.json');
  let metadata: Record<string, unknown>;
  try { metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as Record<string, unknown>; } catch { throw new Error('INVALID_PROJECT_METADATA'); }
  const projectMetadata = isRecord(metadata.metadata) ? metadata.metadata : null;
  const documents = projectMetadata && Array.isArray(projectMetadata.documents) ? projectMetadata.documents : [];
  if (!documents.some((entry) => isRecord(entry) && entry.id === documentId)) throw new Error('DOCUMENT_NOT_FOUND');
  const directory = getDocumentsDirectory(projectDirectory, writable);
  return { directory, file: join(directory, revisionFileName(documentId)) };
};

const readState = async (file: string): Promise<PersistedRevisionState> => {
  assertRegularRevisionFile(file);
  try { await access(file, constants.R_OK); } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return emptyState();
    throw error;
  }
  let parsed: unknown;
  try { parsed = JSON.parse(await readFile(file, 'utf8')) as unknown; } catch { throw new Error('INVALID_REVISION_STATE'); }
  if (!isRecord(parsed) || parsed.formatVersion !== 1 || !Array.isArray(parsed.revisions) || !parsed.revisions.every(isRevision) || !Array.isArray(parsed.timeline) || !parsed.timeline.every(isTimelineEvent) || (parsed.finalRevisionId !== null && typeof parsed.finalRevisionId !== 'string')) throw new Error('INVALID_REVISION_STATE');
  return { revisions: clone(parsed.revisions), timeline: clone(parsed.timeline), finalRevisionId: parsed.finalRevisionId as string | null };
};

const writeState = async (file: string, state: PersistedRevisionState): Promise<void> => {
  const temporary = join(dirname(file), `.${basename(file)}.tmp-${randomUUID()}`);
  try {
    await writeFile(temporary, `${JSON.stringify({ formatVersion: 1, ...state }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
};

const fingerprint = (input: CommitRevisionInput): string => JSON.stringify({ projectId: input.projectId, documentId: input.documentId, baseRevisionId: input.baseRevisionId, operationId: input.operationId, sceneAssetId: input.sceneAssetId, assetIds: input.assetIds, contributions: input.contributions, operatorName: input.operatorName, scene: input.scene });

export const loadDocumentRevisions = async (handle: WorkspaceHandle, workspaceId: string, projectId: string, documentId: string): Promise<PersistedRevisionState> => {
  const target = validateTarget(handle, workspaceId, projectId, documentId, false);
  return readState(target.file);
};

export const commitDocumentRevision = async (handle: WorkspaceHandle, input: CommitRevisionInput & { workspaceId: string }): Promise<{ revisionId: string }> => {
  const target = validateTarget(handle, input.workspaceId, input.projectId, input.documentId, true);
  const state = await readState(target.file);
  const existing = state.revisions.find((revision) => revision.operationId === input.operationId);
  if (existing) {
    if (fingerprint(input) !== fingerprint({ ...existing, baseRevisionId: existing.parentRevisionId, operationId: existing.operationId })) throw new Error('OPERATION_CONFLICT');
    return { revisionId: existing.revisionId };
  }
  if (input.baseRevisionId && !state.revisions.some((revision) => revision.revisionId === input.baseRevisionId)) throw new Error('REVISION_NOT_FOUND');
  const revision: RevisionRecord = { revisionId: randomUUID(), projectId: input.projectId, documentId: input.documentId, parentRevisionId: input.baseRevisionId, operationId: input.operationId, sceneAssetId: input.sceneAssetId, assetIds: [...input.assetIds], contributions: clone(input.contributions), ...(input.operatorName === undefined ? {} : { operatorName: input.operatorName }), ...(input.scene === undefined ? {} : { scene: clone(input.scene) }), createdAt: new Date().toISOString() };
  const event: RevisionTimelineEvent = { id: `event-${revision.revisionId}`, kind: 'revision', label: `Revision ${revision.revisionId}`, documentId: input.documentId, revisionId: revision.revisionId, timestamp: revision.createdAt };
  await mkdir(target.directory, { recursive: true });
  await writeState(target.file, { revisions: [...state.revisions, revision], timeline: [...state.timeline, event], finalRevisionId: state.finalRevisionId });
  return { revisionId: revision.revisionId };
};

export const setFinalDocumentRevision = async (handle: WorkspaceHandle, input: { workspaceId: string; projectId: string; documentId: string; revisionId: string }): Promise<boolean> => {
  const target = validateTarget(handle, input.workspaceId, input.projectId, input.documentId, true);
  const state = await readState(target.file);
  const revision = state.revisions.find((entry) => entry.revisionId === input.revisionId);
  if (!revision) throw new Error('REVISION_NOT_FOUND');
  if (revision.documentId !== input.documentId || revision.projectId !== input.projectId) throw new Error('DOCUMENT_MISMATCH');
  if (state.finalRevisionId === input.revisionId) return true;
  const event: RevisionTimelineEvent = { id: `finalized-${input.documentId}-${input.revisionId}-${Date.now()}-${randomUUID()}`, kind: 'finalized', label: 'Final revision selected', documentId: input.documentId, revisionId: input.revisionId, timestamp: new Date().toISOString() };
  await writeState(target.file, { revisions: state.revisions, timeline: [...state.timeline, event], finalRevisionId: input.revisionId });
  return true;
};
