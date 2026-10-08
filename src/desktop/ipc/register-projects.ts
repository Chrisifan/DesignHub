import type { BrowserWindow } from 'electron';
import {
  addProjectDesignsHandler,
  createProjectContainerHandler,
  duplicateProjectHandler,
  getProjectMetadataHandler,
  listActiveProjectsHandler,
  listProjectDesignsHandler,
  listTrashedProjectsHandler,
  loadProjectCanvasLayoutHandler,
  moveProjectToTrashHandler,
  projectCanvasLayoutLoadChannel,
  projectCanvasLayoutSaveChannel,
  projectCreateChannel,
  projectDesignsAddChannel,
  projectDesignsListChannel,
  projectDuplicateChannel,
  projectListChannel,
  projectListTrashChannel,
  projectMetadataGetChannel,
  projectMetadataUpdateChannel,
  projectPurgeTrashChannel,
  projectRestoreTrashChannel,
  projectTrashChannel,
  purgeProjectFromTrashHandler,
  restoreProjectFromTrashHandler,
  saveProjectCanvasLayoutHandler,
  updateProjectMetadataHandler,
} from './projects';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import type { ProjectCanvasLayout, ProjectDesign, ProjectMetadata } from '../../features/projects/metadata';
import type { ActiveProject, CreateProjectContainerInput, CreateProjectContainerResult, DuplicateProjectInput, RestoreProjectResult, TrashedProject, TrashProjectInput, UpdateProjectMetadataInput } from '../../features/workspace/project-store';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};
type Handler = (...args: unknown[]) => unknown;

export type RegisterProjectHandlersOptions = {
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  getLibrary: () => ProjectLibraryHandle | null;
  listProjects: (workspace: ProjectLibraryHandle) => Promise<ActiveProject[]>;
  createProject: (workspace: ProjectLibraryHandle, input: CreateProjectContainerInput) => Promise<CreateProjectContainerResult>;
  duplicateProject: (workspace: ProjectLibraryHandle, input: DuplicateProjectInput) => Promise<CreateProjectContainerResult>;
  getMetadata: (workspace: ProjectLibraryHandle, projectId: string) => Promise<ProjectMetadata | null>;
  updateMetadata: (workspace: ProjectLibraryHandle, input: UpdateProjectMetadataInput) => Promise<ProjectMetadata>;
  addDesigns: (workspace: ProjectLibraryHandle, input: { libraryId: string; projectId: string; designs: ProjectDesign[] }) => Promise<ProjectDesign[]>;
  listDesigns: (workspace: ProjectLibraryHandle, input: { libraryId: string; projectId: string }) => Promise<ProjectDesign[]>;
  loadCanvasLayout: (workspace: ProjectLibraryHandle, input: { libraryId: string; projectId: string }) => Promise<ProjectCanvasLayout | null>;
  saveCanvasLayout: (workspace: ProjectLibraryHandle, input: { libraryId: string; projectId: string; layout: ProjectCanvasLayout }) => Promise<ProjectCanvasLayout>;
  listTrashed: (workspace: ProjectLibraryHandle) => Promise<TrashedProject[]>;
  moveToTrash: (workspace: ProjectLibraryHandle, input: TrashProjectInput) => Promise<TrashedProject>;
  restoreFromTrash: (workspace: ProjectLibraryHandle, input: TrashProjectInput) => Promise<RestoreProjectResult>;
  purgeFromTrash: (workspace: ProjectLibraryHandle, input: TrashProjectInput) => Promise<void>;
};

export const registerProjectHandlers = (options: RegisterProjectHandlersOptions): void => {
  const {
    ipc, getWindow, getTrustedUrl, getLibrary, listProjects, createProject, duplicateProject,
    getMetadata, updateMetadata, addDesigns, listDesigns, loadCanvasLayout, saveCanvasLayout,
    listTrashed, moveToTrash, restoreFromTrash, purgeFromTrash,
  } = options;
  const getContext = () => {
    const window = getWindow();
    const trustedUrl = getTrustedUrl();
    return window && trustedUrl ? { window, trustedUrl } : null;
  };
  const register = (channel: string, factory: (window: BrowserWindow, trustedUrl: string) => Handler, fallback: unknown = null) => {
    ipc.handle(channel, (...args) => {
      const context = getContext();
      return context ? factory(context.window, context.trustedUrl)(...args) : fallback;
    });
  };

  register(projectListChannel, (window, trustedUrl) => listActiveProjectsHandler(window, trustedUrl, getLibrary, listProjects) as Handler);
  register(projectCreateChannel, (window, trustedUrl) => createProjectContainerHandler(window, trustedUrl, getLibrary, createProject) as Handler);
  register(projectDuplicateChannel, (window, trustedUrl) => duplicateProjectHandler(window, trustedUrl, getLibrary, duplicateProject) as Handler);
  register(projectMetadataGetChannel, (window, trustedUrl) => getProjectMetadataHandler(window, trustedUrl, getLibrary, getMetadata) as Handler);
  register(projectMetadataUpdateChannel, (window, trustedUrl) => updateProjectMetadataHandler(window, trustedUrl, getLibrary, updateMetadata) as Handler);
  register(projectDesignsAddChannel, (window, trustedUrl) => addProjectDesignsHandler(window, trustedUrl, getLibrary, addDesigns) as Handler);
  register(projectDesignsListChannel, (window, trustedUrl) => listProjectDesignsHandler(window, trustedUrl, getLibrary, listDesigns) as Handler);
  register(projectCanvasLayoutLoadChannel, (window, trustedUrl) => loadProjectCanvasLayoutHandler(window, trustedUrl, getLibrary, loadCanvasLayout) as Handler);
  register(projectCanvasLayoutSaveChannel, (window, trustedUrl) => saveProjectCanvasLayoutHandler(window, trustedUrl, getLibrary, saveCanvasLayout) as Handler);
  register(projectListTrashChannel, (window, trustedUrl) => listTrashedProjectsHandler(window, trustedUrl, getLibrary, listTrashed) as Handler);
  register(projectTrashChannel, (window, trustedUrl) => moveProjectToTrashHandler(window, trustedUrl, getLibrary, moveToTrash) as Handler);
  register(projectRestoreTrashChannel, (window, trustedUrl) => restoreProjectFromTrashHandler(window, trustedUrl, getLibrary, restoreFromTrash) as Handler);
  register(projectPurgeTrashChannel, (window, trustedUrl) => purgeProjectFromTrashHandler(window, trustedUrl, getLibrary, purgeFromTrash) as Handler);
};
