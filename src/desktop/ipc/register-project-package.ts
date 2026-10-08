import type { BrowserWindow } from 'electron';
import {
  exportProjectPackageHandler,
  importProjectPackageHandler,
  projectPackageExportChannel,
  projectPackageImportChannel,
} from './package';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};

type PackageHandler = (...args: unknown[]) => unknown;

export type RegisterProjectPackageOptions = {
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  getLibrary: () => ProjectLibraryHandle | null;
  exportPackage: (
    workspace: ProjectLibraryHandle,
    projectId: string,
  ) => Promise<{ path: string; sha256: string } | null>;
  importPackage: (workspace: ProjectLibraryHandle) => Promise<{ projectId: string } | null>;
};

export const registerProjectPackageHandlers = ({
  ipc,
  getWindow,
  getTrustedUrl,
  getLibrary,
  exportPackage,
  importPackage,
}: RegisterProjectPackageOptions): void => {
  const getContext = () => {
    const window = getWindow();
    const trustedUrl = getTrustedUrl();
    return window && trustedUrl ? { window, trustedUrl } : null;
  };

  const getHandlers = (): { exportPackage: PackageHandler; importPackage: PackageHandler } | null => {
    const context = getContext();
    if (!context) return null;
    return {
      exportPackage: exportProjectPackageHandler(
        context.window,
        context.trustedUrl,
        getLibrary,
        exportPackage,
      ) as PackageHandler,
      importPackage: importProjectPackageHandler(
        context.window,
        context.trustedUrl,
        getLibrary,
        importPackage,
      ) as PackageHandler,
    };
  };

  ipc.handle(projectPackageExportChannel, (event, input) => {
    return getHandlers()?.exportPackage(event, input) ?? null;
  });
  ipc.handle(projectPackageImportChannel, (event, input) => {
    return getHandlers()?.importPackage(event, input) ?? null;
  });
};
