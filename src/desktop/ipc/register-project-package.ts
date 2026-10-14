import type { BrowserWindow } from 'electron';
import { importProjectPackageHandler, projectPackageImportChannel } from './package';
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
  importPackage: (workspace: ProjectLibraryHandle) => Promise<{ projectId: string } | null>;
};

export const registerProjectPackageHandlers = ({
  ipc,
  getWindow,
  getTrustedUrl,
  getLibrary,
  importPackage,
}: RegisterProjectPackageOptions): void => {
  const getContext = () => {
    const window = getWindow();
    const trustedUrl = getTrustedUrl();
    return window && trustedUrl ? { window, trustedUrl } : null;
  };

  const getHandler = (): PackageHandler | null => {
    const context = getContext();
    if (!context) return null;
    return importProjectPackageHandler(
      context.window,
      context.trustedUrl,
      getLibrary,
      importPackage,
    ) as PackageHandler;
  };

  ipc.handle(projectPackageImportChannel, (event, input) => {
    return getHandler()?.(event, input) ?? null;
  });
};
