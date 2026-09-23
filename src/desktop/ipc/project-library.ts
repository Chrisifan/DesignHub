import type { BrowserWindow } from 'electron';

import type { ProjectLibraryDescriptor, ProjectLibraryHandle, ProjectLibraryStatus } from '../../features/project-library/open-project-library';
import { isTrustedWorkspaceRequest } from './workspace';

export const projectLibraryStatusChannel = 'project-library:get-status';
export const projectLibraryChooseChannel = 'project-library:choose';

export type { ProjectLibraryStatus } from '../../features/project-library/open-project-library';

type ProjectLibrarySender = { mainFrame: { url: string }; getURL: () => string };
type ProjectLibraryRequest = { sender: ProjectLibrarySender; senderFrame: { url: string } | null };
type ProjectLibraryWindow = { webContents: ProjectLibrarySender };
type DirectoryDialog = (window: BrowserWindow) => Promise<{ canceled: boolean; filePaths: string[] }>;
type OpenLibrary = (directory: string) => Promise<ProjectLibraryHandle>;
type InitializeLibrary = (directory: string) => Promise<ProjectLibraryHandle>;

type LifecycleDependencies = {
  window: ProjectLibraryWindow;
  trustedUrl: string;
  loadDirectory: () => Promise<string | null>;
  saveDirectory: (directory: string) => Promise<void>;
  showDirectoryDialog: DirectoryDialog;
  open: OpenLibrary;
  initialize: InitializeLibrary;
  getActiveHandle: () => ProjectLibraryHandle | null;
  activate: (handle: ProjectLibraryHandle) => void;
};

const errorCode = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return String(error.code);
};

const statusReason = (error: unknown): 'missing' | 'unavailable' | 'invalid' => {
  if (errorCode(error) === 'ENOENT') return 'missing';
  if (error instanceof Error && (error.message.startsWith('INVALID_') || error.message === 'NOT_A_PROJECT_LIBRARY')) return 'invalid';
  return 'unavailable';
};

const asDescriptor = (handle: ProjectLibraryHandle): ProjectLibraryDescriptor => handle.library;

export const createProjectLibraryLifecycleHandlers = (dependencies: LifecycleDependencies) => {
  const { window, trustedUrl } = dependencies;
  const getStatus = async (event: ProjectLibraryRequest): Promise<ProjectLibraryStatus | null> => {
    if (!isTrustedWorkspaceRequest(event as never, window as never, trustedUrl)) return null;
    const directory = await dependencies.loadDirectory();
    if (!directory) return { state: 'unselected' };

    const active = dependencies.getActiveHandle();
    if (active?.library.directory === directory) return { state: 'ready', library: asDescriptor(active) };

    try {
      const handle = await dependencies.open(directory);
      dependencies.activate(handle);
      return { state: 'ready', library: asDescriptor(handle) };
    } catch (error) {
      return { state: 'needs-location', directory, reason: statusReason(error) };
    }
  };

  const choose = async (event: ProjectLibraryRequest): Promise<ProjectLibraryDescriptor | null> => {
    if (!isTrustedWorkspaceRequest(event as never, window as never, trustedUrl)) return null;
    const result = await dependencies.showDirectoryDialog(window as never);
    if (result.canceled) return null;
    const directory = result.filePaths[0];
    if (!directory) return null;

    const active = dependencies.getActiveHandle();
    if (active?.library.directory === directory) return asDescriptor(active);

    let handle: ProjectLibraryHandle;
    try {
      handle = await dependencies.open(directory);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'NOT_A_PROJECT_LIBRARY') throw error;
      handle = await dependencies.initialize(directory);
    }

    try {
      await dependencies.saveDirectory(handle.library.directory);
      dependencies.activate(handle);
      return asDescriptor(handle);
    } catch (error) {
      handle.close();
      throw error;
    }
  };

  return { getStatus, choose };
};
