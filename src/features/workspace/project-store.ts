export type CreateProjectContainerInput = {
  workspaceId: string;
  operationId: string;
  name: string;
};

export type CreateProjectContainerResult = {
  projectId: string;
};

export type ActiveProject = {
  projectId: string;
  name: string;
};

export type TrashProjectInput = {
  workspaceId: string;
  projectId: string;
};

export type TrashedProject = {
  projectId: string;
  originalRelativePath: string;
  deletedAt: string;
};

export type RestoreProjectResult = {
  projectId: string;
  restoredRelativePath: string;
};

export type ProjectStore = {
  createProjectContainer: (input: CreateProjectContainerInput) => Promise<CreateProjectContainerResult>;
  listActiveProjects: () => Promise<ActiveProject[]>;
  moveProjectToTrash: (input: TrashProjectInput) => Promise<TrashedProject>;
  listTrashedProjects: () => Promise<TrashedProject[]>;
  restoreProjectFromTrash: (input: TrashProjectInput) => Promise<RestoreProjectResult>;
  purgeProjectFromTrash: (input: TrashProjectInput) => Promise<void>;
};

export const createProjectStore = (
  implementation: ProjectStore,
): ProjectStore => ({
  createProjectContainer: (input) => implementation.createProjectContainer(input),
  listActiveProjects: () => implementation.listActiveProjects(),
  moveProjectToTrash: (input) => implementation.moveProjectToTrash(input),
  listTrashedProjects: () => implementation.listTrashedProjects(),
  restoreProjectFromTrash: (input) => implementation.restoreProjectFromTrash(input),
  purgeProjectFromTrash: (input) => implementation.purgeProjectFromTrash(input),
});
