import type { WorkspaceHandle } from '../features/workspace/open-workspace';

export const recreateWindowOnActivate = (hasOpenWindow: () => boolean, createWindow: () => void): void => {
  if (!hasOpenWindow()) createWindow();
};

export const openWorkspaceForActivation = async (
  directory: string,
  activeWorkspace: WorkspaceHandle | null,
  resolveDirectory: (directory: string) => Promise<string>,
  openWorkspace: (directory: string) => Promise<WorkspaceHandle>,
  activateWorkspace: (workspace: WorkspaceHandle) => WorkspaceHandle,
): Promise<WorkspaceHandle> => {
  if (activeWorkspace) {
    try {
      if (await resolveDirectory(directory) === activeWorkspace.workspace.directory) return activeWorkspace;
    } catch {
      // Let the regular opener report the canonical workspace error.
    }
  }
  return activateWorkspace(await openWorkspace(directory));
};
