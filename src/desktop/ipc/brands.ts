import { isBrandLibraryState, type BrandLibraryState } from '../../features/brands/constraints';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { isTrustedWorkspaceRequest } from './workspace';

export const brandLoadChannel = 'brand:load-state';
export const brandSaveChannel = 'brand:save-state';

type BrandSender = { mainFrame: { url: string }; getURL: () => string };
type BrandRequest = { sender: BrandSender; senderFrame: { url: string } | null };
type BrandWindow = { webContents: BrandSender };

const isWorkspaceId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isSaveInput = (value: unknown): value is { workspaceId: string; state: BrandLibraryState } => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return isWorkspaceId(input.workspaceId) && isBrandLibraryState(input.state);
};

export const loadBrandStateHandler = (
  window: BrandWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  loadState: (workspace: WorkspaceHandle, workspaceId: string) => Promise<BrandLibraryState | null>,
) => async (event: BrandRequest, workspaceId: unknown): Promise<BrandLibraryState | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isWorkspaceId(workspaceId)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== workspaceId) return null;
  return loadState(workspace, workspaceId);
};

export const saveBrandStateHandler = (
  window: BrandWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  saveState: (workspace: WorkspaceHandle, state: BrandLibraryState) => Promise<boolean>,
) => async (event: BrandRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isSaveInput(input)) return false;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId || workspace.workspace.openMode !== 'writable') return false;
  return saveState(workspace, input.state);
};
