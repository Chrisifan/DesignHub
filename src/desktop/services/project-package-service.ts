import type { BrowserWindow } from 'electron';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { createProjectStore } from '../storage/project-store';
import { randomUUID } from 'node:crypto';

type OpenDialog = (window: BrowserWindow, options: { properties: Array<'openFile'>; filters: Array<{ name: string; extensions: string[] }> }) => Promise<{ canceled: boolean; filePaths: string[] }>;

export type ProjectPackageServiceDependencies = {
  getWindow: () => BrowserWindow | null;
  showOpenDialog: OpenDialog;
  readArchive: (path: string) => Promise<Uint8Array>;
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
    const archive = await dependencies.readArchive(result.filePaths[0]);
    return createProjectStore(workspace).importProjectPackage({
      libraryId: workspace.library.libraryId,
      operationId: randomUUID(),
      archive,
    });
  },
});
