import { isBrandLibraryState, type BrandLibraryState } from '../../features/brands/constraints';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { isTrustedProjectLibraryRequest } from './workspace';

export const brandLoadChannel = 'brand:load-state';
export const brandSaveChannel = 'brand:save-state';

type BrandSender = { mainFrame: { url: string }; getURL: () => string };
type BrandRequest = { sender: BrandSender; senderFrame: { url: string } | null };
type BrandWindow = { webContents: BrandSender };

const isWorkspaceId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isSaveInput = (value: unknown): value is { libraryId: string; state: BrandLibraryState } => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return isWorkspaceId(input.libraryId) && isBrandLibraryState(input.state);
};

export const loadBrandStateHandler = (
  window: BrandWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  loadState: (workspace: ProjectLibraryHandle, libraryId: string) => Promise<BrandLibraryState | null>,
) => async (event: BrandRequest, libraryId: unknown): Promise<BrandLibraryState | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isWorkspaceId(libraryId)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== libraryId) return null;
  return loadState(workspace, libraryId);
};

export const saveBrandStateHandler = (
  window: BrandWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  saveState: (workspace: ProjectLibraryHandle, state: BrandLibraryState) => Promise<boolean>,
) => async (event: BrandRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isSaveInput(input)) return false;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId || workspace.library.openMode !== 'writable') return false;
  return saveState(workspace, input.state);
};
