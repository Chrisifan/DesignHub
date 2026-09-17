import type { PortfolioAnalysisInput } from '../../features/agent/task-service';
import type { TaskRecord } from '../../features/tasks/state';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import type { PortfolioInspection, PortfolioInspectionRequest, PortfolioSelectionInput, PortfolioUploadFile } from '../../platform/contracts';
import type { PortfolioSourceInspector } from '../portfolio-source-inspector';
import { isTrustedWorkspaceRequest } from './workspace';

export const portfolioInspectChannel = 'portfolio:inspect';
export const portfolioSelectChannel = 'portfolio:select';
export const portfolioDiscardChannel = 'portfolio:discard';

export type PortfolioInspectionBridgeInput = {
  workspaceId: string;
  request: PortfolioInspectionRequest;
};

export type PortfolioSelectionBridgeInput = PortfolioSelectionInput;

type PortfolioSender = { mainFrame: { url: string }; getURL: () => string };
type PortfolioRequestEvent = { sender: PortfolioSender; senderFrame: { url: string } | null };
type PortfolioWindow = { webContents: PortfolioSender };
type FileChooser = () => Promise<string[] | null>;

const maxPortfolioSources = 8;
const maxArchiveBytes = 24 * 1024 * 1024;
const maxImageBytes = 8 * 1024 * 1024;
const supportedImageExtensions = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);

const isNonEmpty = (value: unknown, maximum = 4096): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
const isIdentifier = (value: unknown): value is string => isNonEmpty(value, 128) && !/[\u0000-\u001F/\\]/u.test(value);
const extensionForName = (name: string): string => name.split('.').at(-1)?.toLowerCase() ?? '';
const isUploadFile = (value: unknown): value is PortfolioUploadFile => {
  if (!value || typeof value !== 'object') return false;
  const file = value as Record<string, unknown>;
  if (!isNonEmpty(file.name, 512) || /[\\/\u0000-\u001F]/u.test(file.name) || typeof file.mimeType !== 'string' || file.mimeType.length > 128 || !(file.bytes instanceof Uint8Array)) return false;
  const extension = extensionForName(file.name);
  if (extension === 'zip') return file.bytes.byteLength <= maxArchiveBytes;
  return supportedImageExtensions.has(extension) && file.bytes.byteLength <= maxImageBytes;
};
const isUploadBatch = (files: unknown): files is PortfolioUploadFile[] => {
  if (!Array.isArray(files) || files.length === 0 || files.length > maxPortfolioSources || !files.every(isUploadFile)) return false;
  const zipCount = files.filter((file) => extensionForName(file.name) === 'zip').length;
  return zipCount === 0 || (zipCount === 1 && files.length === 1);
};
const isInspectionInput = (value: unknown): value is PortfolioInspectionBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  if (!isNonEmpty(input.workspaceId) || !input.request || typeof input.request !== 'object') return false;
  const request = input.request as Record<string, unknown>;
  if (request.url !== undefined) return false;
  if (request.kind === 'local-files') return request.files === undefined;
  return request.kind === 'uploaded-files' && isUploadBatch(request.files);
};
const isSelectionInput = (value: unknown): value is PortfolioSelectionBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  const source = input.source;
  const selections = input.selections;
  if (!Array.isArray(selections) || selections.length === 0) return false;
  const isSelection = (selection: unknown): selection is { inspectionId: string; sourceIds: string[] } => {
    if (selection === null || typeof selection !== 'object') return false;
    const candidate = selection as { inspectionId?: unknown; sourceIds?: unknown };
    if (!isIdentifier(candidate.inspectionId) || !Array.isArray(candidate.sourceIds) || candidate.sourceIds.length === 0) return false;
    return candidate.sourceIds.every(isIdentifier) && new Set(candidate.sourceIds).size === candidate.sourceIds.length;
  };
  if (!selections.every(isSelection)) return false;
  const sourceCount = selections.reduce((total, selection) => total + selection.sourceIds.length, 0);
  return isNonEmpty(input.workspaceId) && isNonEmpty(input.connectionId)
    && input.rightsConfirmed === true && source !== null && typeof source === 'object'
    && (source as Record<string, unknown>).kind === 'designer-draft' && isIdentifier((source as Record<string, unknown>).id)
    && new Set(selections.map((selection) => selection.inspectionId)).size === selections.length
    && sourceCount <= 8;
};
const isDiscardInput = (value: unknown): value is { workspaceId: string; inspectionId: string } => value !== null && typeof value === 'object'
  && isNonEmpty((value as Record<string, unknown>).workspaceId) && isIdentifier((value as Record<string, unknown>).inspectionId);

export const createPortfolioInspectionHandler = (
  window: PortfolioWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  chooseFiles: FileChooser,
  inspector: PortfolioSourceInspector,
) => async (event: PortfolioRequestEvent, input: unknown): Promise<PortfolioInspection | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isInspectionInput(input)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return null;
  if (input.request.kind === 'uploaded-files') return inspector.inspectUploadedFiles(input.request.files);
  const paths = await chooseFiles();
  if (!paths?.length) return null;
  return inspector.inspectLocalFiles(paths);
};

export const createPortfolioSelectionHandler = (
  window: PortfolioWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  inspector: PortfolioSourceInspector,
  submit: (workspace: WorkspaceHandle, input: PortfolioAnalysisInput) => Promise<TaskRecord>,
) => async (event: PortfolioRequestEvent, input: unknown): Promise<TaskRecord | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isSelectionInput(input)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId || workspace.workspace.openMode === 'read-only') return null;
  const sourceBatches = await Promise.all(input.selections.map((selection) => inspector.selectedSources(selection.inspectionId, selection.sourceIds)));
  const sources = sourceBatches.flat();
  if (sources.length === 0 || sources.length > 8 || new Set(sources.map((source) => source.id)).size !== sources.length) throw new Error('PORTFOLIO_SOURCE_LIMIT');
  return submit(workspace, {
      source: input.source,
      connectionId: input.connectionId,
      sources,
      rightsConfirmed: input.rightsConfirmed,
    });
};

export const createPortfolioDiscardHandler = (
  window: PortfolioWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  inspector: PortfolioSourceInspector,
) => (event: PortfolioRequestEvent, input: unknown): boolean => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isDiscardInput(input)) return false;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return false;
  inspector.discard(input.inspectionId);
  return true;
};
