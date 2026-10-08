import type { BrowserWindow } from 'electron';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { createProjectPackageArchive, writeProjectPackageArchive } from '../storage/project-package-store';
import { createProjectStore } from '../storage/project-store';
import { randomUUID } from 'node:crypto';

type SaveDialog = (window: BrowserWindow, options: { defaultPath: string; filters: Array<{ name: string; extensions: string[] }> }) => Promise<{ canceled: boolean; filePath?: string }>;
type OpenDialog = (window: BrowserWindow, options: { properties: Array<'openFile'>; filters: Array<{ name: string; extensions: string[] }> }) => Promise<{ canceled: boolean; filePaths: string[] }>;

export type ProjectPackageServiceDependencies = {
  getWindow: () => BrowserWindow | null;
  showSaveDialog: SaveDialog;
  showOpenDialog: OpenDialog;
  readArchive: (path: string) => Promise<Uint8Array>;
};

export const createProjectPackageService = (dependencies: ProjectPackageServiceDependencies) => ({
  exportPackage: async (workspace: ProjectLibraryHandle, projectId: string): Promise<{ path: string; sha256: string } | null> => {
    const window = dependencies.getWindow();
    if (!window) return null;
    const result = await dependencies.showSaveDialog(window, {
      defaultPath: `designhub-${projectId}.designhub.zip`,
      filters: [{ name: 'DesignHub package', extensions: ['zip'] }],
    });
    if (result.canceled || !result.filePath) return null;
    const { archive, sha256 } = await createProjectPackageArchive(workspace, projectId);
    await writeProjectPackageArchive(result.filePath, archive);
    return { path: result.filePath, sha256 };
  },
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
