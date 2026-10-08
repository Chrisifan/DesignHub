import type { BrowserWindow } from 'electron';

import { createProjectLibraryLifecycleHandlers, projectLibraryChooseChannel, projectLibraryStatusChannel } from './project-library';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};

type ProjectLibraryLifecycleHandlers = ReturnType<typeof createProjectLibraryLifecycleHandlers>;

export type RegisterProjectLibraryOptions = {
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  createHandlers: () => ProjectLibraryLifecycleHandlers;
};

export const registerProjectLibraryHandlers = ({
  ipc,
  getWindow,
  getTrustedUrl,
  createHandlers,
}: RegisterProjectLibraryOptions): void => {
  const hasContext = (): boolean => Boolean(getWindow() && getTrustedUrl());

  ipc.handle(projectLibraryStatusChannel, (event) => {
    if (!hasContext()) return null;
    return createHandlers().getStatus(event as never);
  });
  ipc.handle(projectLibraryChooseChannel, (event) => {
    if (!hasContext()) return null;
    return createHandlers().choose(event as never);
  });
};
