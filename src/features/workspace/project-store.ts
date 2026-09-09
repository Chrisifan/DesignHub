export type CreateProjectContainerInput = {
  workspaceId: string;
  operationId: string;
  name: string;
};

export type CreateProjectContainerResult = {
  projectId: string;
};

export type ProjectStore = {
  createProjectContainer: (input: CreateProjectContainerInput) => Promise<CreateProjectContainerResult>;
};

export const createProjectStore = (
  createProjectContainer: (input: CreateProjectContainerInput) => Promise<CreateProjectContainerResult>,
): ProjectStore => ({ createProjectContainer: (input) => createProjectContainer(input) });
