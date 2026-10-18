import type { ProjectLibraryHandle } from '../features/project-library/open-project-library';

type FocusableWindow = {
  isMinimized: () => boolean;
  restore: () => void;
  show: () => void;
  focus: () => void;
};

export const focusExistingWindow = (window: FocusableWindow | null): void => {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
};

export const recreateWindowOnActivate = (hasOpenWindow: () => boolean, createWindow: () => void): void => {
  if (!hasOpenWindow()) createWindow();
};

export const openProjectLibraryForActivation = async (
  directory: string,
  activeLibrary: ProjectLibraryHandle | null,
  resolveDirectory: (directory: string) => Promise<string>,
  openProjectLibrary: (directory: string) => Promise<ProjectLibraryHandle>,
  activateProjectLibrary: (library: ProjectLibraryHandle) => ProjectLibraryHandle,
): Promise<ProjectLibraryHandle> => {
  if (activeLibrary) {
    try {
      if (await resolveDirectory(directory) === activeLibrary.library.directory) return activeLibrary;
    } catch {
      // Let the regular opener report the canonical workspace error.
    }
  }
  return activateProjectLibrary(await openProjectLibrary(directory));
};
