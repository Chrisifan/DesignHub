import type { BrowserWindow } from 'electron';
import {
  listTasksHandler,
  publishCompositionCandidateHandler,
  resolveCompositionCandidateHandler,
  taskCompositionPublishChannel,
  taskCompositionResolveChannel,
  taskListChannel,
} from './tasks';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import type { TaskRecord } from '../../features/tasks/state';
import type { DesignSceneCandidate } from '../../features/composition/design-scene-candidate';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};

type TaskRegistrationHandlers = {
  list: (...args: unknown[]) => unknown;
  publishComposition: (...args: unknown[]) => unknown;
  resolveComposition: (...args: unknown[]) => unknown;
};

export type RegisterTaskHandlersOptions = {
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  getLibrary: () => ProjectLibraryHandle | null;
  loadTasks: (workspace: ProjectLibraryHandle, libraryId: string) => Promise<TaskRecord[]>;
  publishComposition: (workspace: ProjectLibraryHandle, input: {
    libraryId: string;
    projectId: string;
    documentId: string;
    candidate: DesignSceneCandidate;
  }) => Promise<TaskRecord>;
  resolveComposition: (workspace: ProjectLibraryHandle, taskId: string, resolution: 'confirmed' | 'discarded') => Promise<TaskRecord>;
};

export const registerTaskHandlers = ({
  ipc,
  getWindow,
  getTrustedUrl,
  getLibrary,
  loadTasks,
  publishComposition,
  resolveComposition,
}: RegisterTaskHandlersOptions): void => {
  const handlers = (): TaskRegistrationHandlers | null => {
    const window = getWindow();
    const trustedUrl = getTrustedUrl();
    if (!window || !trustedUrl) return null;
    return {
      list: listTasksHandler(window, trustedUrl, getLibrary, loadTasks) as (...args: unknown[]) => unknown,
      publishComposition: publishCompositionCandidateHandler(window, trustedUrl, getLibrary, publishComposition) as (...args: unknown[]) => unknown,
      resolveComposition: resolveCompositionCandidateHandler(window, trustedUrl, getLibrary, resolveComposition) as (...args: unknown[]) => unknown,
    };
  };

  ipc.handle(taskListChannel, (event, libraryId) => handlers()?.list(event, libraryId) ?? null);
  ipc.handle(taskCompositionPublishChannel, (event, input) => handlers()?.publishComposition(event, input) ?? null);
  ipc.handle(taskCompositionResolveChannel, (event, input) => handlers()?.resolveComposition(event, input) ?? null);
};
