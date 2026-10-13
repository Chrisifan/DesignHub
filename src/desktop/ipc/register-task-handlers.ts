import type { BrowserWindow } from 'electron';
import { listTasksHandler, taskListChannel } from './tasks';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import type { TaskRecord } from '../../features/tasks/state';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};

type TaskRegistrationHandlers = {
  list: (...args: unknown[]) => unknown;
};

export type RegisterTaskHandlersOptions = {
  [key: string]: unknown;
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  getLibrary: () => ProjectLibraryHandle | null;
  loadTasks: (workspace: ProjectLibraryHandle, libraryId: string) => Promise<TaskRecord[]>;
};

export const registerTaskHandlers = ({
  ipc,
  getWindow,
  getTrustedUrl,
  getLibrary,
  loadTasks,
}: RegisterTaskHandlersOptions): void => {
  const handlers = (): TaskRegistrationHandlers | null => {
    const window = getWindow();
    const trustedUrl = getTrustedUrl();
    if (!window || !trustedUrl) return null;
    return {
      list: listTasksHandler(window, trustedUrl, getLibrary, loadTasks) as (...args: unknown[]) => unknown,
    };
  };

  ipc.handle(taskListChannel, (event, libraryId) => handlers()?.list(event, libraryId) ?? null);
};
