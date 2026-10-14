import type { BrowserWindow } from 'electron';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { randomUUID } from 'node:crypto';
import type { ProjectPackageArchiveImportInput } from '../storage/project-package-import';

type OpenDialog = (window: BrowserWindow, options: { properties: Array<'openFile'>; filters: Array<{ name: string; extensions: string[] }> }) => Promise<{ canceled: boolean; filePaths: string[] }>;

export type ProjectPackageServiceDependencies = {
  getWindow: () => BrowserWindow | null;
  showOpenDialog: OpenDialog;
  importArchive: (workspace: ProjectLibraryHandle, input: ProjectPackageArchiveImportInput) => Promise<{ projectId: string }>;
};

export const createProjectPackageService = (dependencies: ProjectPackageServiceDependencies) => ({
  importPackage: async (workspace: ProjectLibraryHandle): Promise<{ projectId: string } | null> => {
    const window = dependencies.getWindow();
    if (!window) return null;
    const result = await dependencies.showOpenDialog(window, {
      properties: ['openFile'],
      filters: [{ name: 'DesignHub package', extensions: ['zip'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return dependencies.importArchive(workspace, {
      libraryId: workspace.library.libraryId,
      operationId: randomUUID(),
      archivePath: result.filePaths[0],
    });
  },
});
