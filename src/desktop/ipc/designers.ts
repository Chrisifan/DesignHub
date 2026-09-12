import { isDesignerLibraryState, type DesignerLibraryState } from '../../features/designers/persistence';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { isTrustedWorkspaceRequest } from './workspace';

export const designerLoadChannel = 'designer:load-state';
export const designerSaveChannel = 'designer:save-state';

type DesignerSender = {
  mainFrame: { url: string };
  getURL: () => string;
};

type DesignerRequest = {
  sender: DesignerSender;
  senderFrame: { url: string } | null;
};

type DesignerWindow = { webContents: DesignerSender };

const isWorkspaceId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const isSaveInput = (value: unknown): value is { workspaceId: string; state: DesignerLibraryState } => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return isWorkspaceId(input.workspaceId) && isDesignerLibraryState(input.state);
};

export const loadDesignerStateHandler = (
  window: DesignerWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  loadState: (workspace: WorkspaceHandle, workspaceId: string) => Promise<DesignerLibraryState | null>,
) => async (event: DesignerRequest, workspaceId: unknown): Promise<DesignerLibraryState | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isWorkspaceId(workspaceId)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== workspaceId) return null;
  return loadState(workspace, workspaceId);
};

export const saveDesignerStateHandler = (
  window: DesignerWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  saveState: (workspace: WorkspaceHandle, state: DesignerLibraryState) => Promise<boolean>,
) => async (event: DesignerRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isSaveInput(input)) return false;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return false;
  return saveState(workspace, input.state);
};
