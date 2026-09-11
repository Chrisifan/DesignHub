import type { BrowserWindow } from 'electron';
import type { WorkspaceDescriptor, WorkspaceHandle } from '../../features/workspace/open-workspace';
import type { WorkspaceCreateInput } from '../../platform/contracts';

export const workspaceChannel = 'workspace:choose-directory';
export const workspaceCreateChannel = 'workspace:create';
export const workspaceOpenChannel = 'workspace:open';

type WorkspaceSender = {
  mainFrame: { url: string };
  getURL: () => string;
};

type WorkspaceRequest = {
  sender: WorkspaceSender;
  senderFrame: { url: string } | null;
};

type WorkspaceWindow = {
  webContents: WorkspaceSender;
};

export type DirectoryDialog = (window: BrowserWindow) => Promise<{ canceled: boolean; filePaths: string[] }>;

type WorkspaceOperationResult = WorkspaceHandle | WorkspaceDescriptor;
type WorkspaceCreator = (input: WorkspaceCreateInput) => Promise<WorkspaceOperationResult | null>;
type WorkspaceOpener = (directory: string) => Promise<WorkspaceOperationResult | null>;

const hasSameCanonicalRendererLocation = (candidateUrl: string, trustedUrl: string): boolean => {
  try {
    const candidate = new URL(candidateUrl);
    const trusted = new URL(trustedUrl);
    if (trusted.protocol === 'file:') return candidate.protocol === 'file:' && candidate.href === trusted.href;
    if (trusted.protocol !== 'http:' && trusted.protocol !== 'https:') return false;
    return candidate.protocol === trusted.protocol
      && candidate.host === trusted.host
      && candidate.pathname === trusted.pathname
      && candidate.search === trusted.search
      && candidate.hash === trusted.hash;
  } catch {
    return false;
  }
};

export const chooseDirectory = async (window: BrowserWindow, showOpenDialog: DirectoryDialog): Promise<string | null> => {
  const result = await showOpenDialog(window);
  return result.canceled ? null : result.filePaths[0] ?? null;
};

export const isTrustedWorkspaceRequest = (event: WorkspaceRequest, window: WorkspaceWindow, trustedUrl: string): boolean => {
  const frame = event.senderFrame;
  if (event.sender !== window.webContents || frame !== window.webContents.mainFrame || frame === null) return false;
  return hasSameCanonicalRendererLocation(frame.url, trustedUrl);
};

export const createWorkspaceHandler = (window: WorkspaceWindow, trustedUrl: string, showOpenDialog: DirectoryDialog) => async (event: WorkspaceRequest): Promise<string | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl)) return null;
  return chooseDirectory(window as never, showOpenDialog);
};

const isWorkspaceCreateInput = (input: unknown): input is WorkspaceCreateInput => {
  if (typeof input !== 'object' || input === null) return false;
  const candidate = input as Record<string, unknown>;
  return typeof candidate.parentDirectory === 'string'
    && candidate.parentDirectory.trim().length > 0
    && typeof candidate.name === 'string'
    && candidate.name.trim().length > 0;
};

const isWorkspaceDirectory = (directory: unknown): directory is string =>
  typeof directory === 'string' && directory.trim().length > 0;

const toWorkspaceDescriptor = (result: WorkspaceOperationResult | null): WorkspaceDescriptor | null =>
  result === null ? null : 'workspace' in result ? result.workspace : result;

export const createWorkspaceFromParentHandler = (
  window: WorkspaceWindow,
  trustedUrl: string,
  createWorkspace: WorkspaceCreator,
) => async (event: WorkspaceRequest, input: unknown): Promise<WorkspaceDescriptor | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isWorkspaceCreateInput(input)) return null;
  const result = await createWorkspace(input);
  return toWorkspaceDescriptor(result);
};

export const openWorkspaceHandler = (
  window: WorkspaceWindow,
  trustedUrl: string,
  openWorkspace: WorkspaceOpener,
) => async (event: WorkspaceRequest, directory: unknown): Promise<WorkspaceDescriptor | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isWorkspaceDirectory(directory)) return null;
  const result = await openWorkspace(directory);
  return toWorkspaceDescriptor(result);
};
