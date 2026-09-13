import type { PortfolioAnalysisInput } from '../../features/agent/task-service';
import type { TaskRecord } from '../../features/tasks/state';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import type { PortfolioInspection, PortfolioInspectionRequest, PortfolioSelectionInput } from '../../platform/contracts';
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
type FileChooser = (kind: 'local-images' | 'local-zip') => Promise<string[] | null>;

const isNonEmpty = (value: unknown, maximum = 4096): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
const isIdentifier = (value: unknown): value is string => isNonEmpty(value, 128) && !/[\u0000-\u001F/\\]/u.test(value);
const isRemoteUrl = (value: unknown): value is string => {
  if (!isNonEmpty(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch { return false; }
};
const isInspectionInput = (value: unknown): value is PortfolioInspectionBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  if (!isNonEmpty(input.workspaceId) || !input.request || typeof input.request !== 'object') return false;
  const request = input.request as Record<string, unknown>;
  return (request.kind === 'local-images' || request.kind === 'local-zip')
    ? request.url === undefined
    : (request.kind === 'remote-image' || request.kind === 'remote-page') && isRemoteUrl(request.url);
};
const isSelectionInput = (value: unknown): value is PortfolioSelectionBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  const source = input.source;
  return isNonEmpty(input.workspaceId) && isNonEmpty(input.connectionId) && isIdentifier(input.inspectionId)
    && input.rightsConfirmed === true && source !== null && typeof source === 'object'
    && (source as Record<string, unknown>).kind === 'designer-draft' && isIdentifier((source as Record<string, unknown>).id)
    && Array.isArray(input.sourceIds) && input.sourceIds.length > 0 && input.sourceIds.length <= 8
    && input.sourceIds.every(isIdentifier) && new Set(input.sourceIds).size === input.sourceIds.length;
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
  if (input.request.kind === 'local-images' || input.request.kind === 'local-zip') {
    const paths = await chooseFiles(input.request.kind);
    if (!paths?.length) return null;
    return input.request.kind === 'local-images' ? inspector.inspectLocalImages(paths) : inspector.inspectZip(paths[0] as string);
  }
  return input.request.kind === 'remote-image'
    ? inspector.inspectRemoteImage(input.request.url as string)
    : inspector.inspectRemotePage(input.request.url as string);
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
  const task = await submit(workspace, {
      source: input.source,
      connectionId: input.connectionId,
      sources: await inspector.selectedSources(input.inspectionId, input.sourceIds),
      rightsConfirmed: input.rightsConfirmed,
    });
  inspector.discard(input.inspectionId);
  return task;
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
