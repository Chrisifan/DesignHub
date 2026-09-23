import { isDesignerLibraryState, type DesignerLibraryState } from '../../features/designers/persistence';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { isTrustedWorkspaceRequest } from './workspace';

export const designerLoadChannel = 'designer:load-state';
export const designerSaveChannel = 'designer:save-state';
export const designerArtworkReadChannel = 'designer:read-artwork';

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

const isArtworkReadInput = (value: unknown): value is { workspaceId: string; artworkId: string } => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return isWorkspaceId(input.workspaceId)
    && typeof input.artworkId === 'string'
    && input.artworkId.trim().length > 0;
};

export const loadDesignerStateHandler = (
  window: DesignerWindow,
  trustedUrl: string,
  getWorkspace: () => ProjectLibraryHandle | null,
  loadState: (workspace: ProjectLibraryHandle, workspaceId: string) => Promise<DesignerLibraryState | null>,
) => async (event: DesignerRequest, workspaceId: unknown): Promise<DesignerLibraryState | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isWorkspaceId(workspaceId)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.library.libraryId !== workspaceId) return null;
  return loadState(workspace, workspaceId);
};

export const saveDesignerStateHandler = (
  window: DesignerWindow,
  trustedUrl: string,
  getWorkspace: () => ProjectLibraryHandle | null,
  saveState: (workspace: ProjectLibraryHandle, state: DesignerLibraryState) => Promise<boolean>,
) => async (event: DesignerRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isSaveInput(input)) return false;
  const workspace = getWorkspace();
  if (!workspace || workspace.library.libraryId !== input.workspaceId) return false;
  return saveState(workspace, input.state);
};

export const readDesignerArtworkHandler = (
  window: DesignerWindow,
  trustedUrl: string,
  getWorkspace: () => ProjectLibraryHandle | null,
  readArtwork: (workspace: ProjectLibraryHandle, workspaceId: string, artworkId: string) => Promise<{ artworkId: string; dataUrl: string } | null>,
) => async (event: DesignerRequest, input: unknown): Promise<{ artworkId: string; dataUrl: string } | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isArtworkReadInput(input)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.library.libraryId !== input.workspaceId) return null;
  return readArtwork(workspace, input.workspaceId, input.artworkId);
};
