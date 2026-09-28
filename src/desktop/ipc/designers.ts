import { isDesignerLibraryState, type DesignerLibraryState } from '../../features/designers/persistence';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { isTrustedProjectLibraryRequest } from './workspace';

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

const isSaveInput = (value: unknown): value is { libraryId: string; state: DesignerLibraryState } => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return isWorkspaceId(input.libraryId) && isDesignerLibraryState(input.state);
};

const isArtworkReadInput = (value: unknown): value is { libraryId: string; artworkId: string } => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return isWorkspaceId(input.libraryId)
    && typeof input.artworkId === 'string'
    && input.artworkId.trim().length > 0;
};

export const loadDesignerStateHandler = (
  window: DesignerWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  loadState: (workspace: ProjectLibraryHandle, libraryId: string) => Promise<DesignerLibraryState | null>,
) => async (event: DesignerRequest, libraryId: unknown): Promise<DesignerLibraryState | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isWorkspaceId(libraryId)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== libraryId) return null;
  return loadState(workspace, libraryId);
};

export const saveDesignerStateHandler = (
  window: DesignerWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  saveState: (workspace: ProjectLibraryHandle, state: DesignerLibraryState) => Promise<boolean>,
) => async (event: DesignerRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isSaveInput(input)) return false;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return false;
  return saveState(workspace, input.state);
};

export const readDesignerArtworkHandler = (
  window: DesignerWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  readArtwork: (workspace: ProjectLibraryHandle, libraryId: string, artworkId: string) => Promise<{ artworkId: string; dataUrl: string } | null>,
) => async (event: DesignerRequest, input: unknown): Promise<{ artworkId: string; dataUrl: string } | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isArtworkReadInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return readArtwork(workspace, input.libraryId, input.artworkId);
};
