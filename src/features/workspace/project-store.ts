import type { ProjectDocumentMetadata, ProjectMetadata, ProjectMetadataPatch } from '../projects/metadata';

export type CreateProjectContainerInput = {
  workspaceId: string;
  operationId: string;
  name: string;
  brief?: string;
  activeDesignerVersionId?: string;
  contributorDesignerVersionIds?: string[];
  designerSnapshot?: unknown;
  brandSnapshot?: unknown;
  coverAssetId?: string;
  documents?: Array<Omit<ProjectDocumentMetadata, 'updatedAt'>>;
};

export type CreateProjectContainerResult = {
  projectId: string;
};

export type DuplicateProjectInput = {
  workspaceId: string;
  sourceProjectId: string;
  operationId: string;
  name?: string;
};

export type ImportProjectPackageInput = {
  workspaceId: string;
  operationId: string;
  archive: Uint8Array;
};

export type ImportProjectPackageResult = {
  projectId: string;
};

export type ActiveProject = {
  projectId: string;
  name: string;
  brief?: string;
  activeDesignerVersionId?: string;
  contributorDesignerVersionIds?: string[];
  designerSnapshot?: unknown;
  brandSnapshot?: unknown;
  coverAssetId?: string;
  documents?: ProjectDocumentMetadata[];
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type UpdateProjectMetadataInput = {
  workspaceId: string;
  projectId: string;
  patch: ProjectMetadataPatch;
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
  duplicateProject: (input: DuplicateProjectInput) => Promise<CreateProjectContainerResult>;
  importProjectPackage: (input: ImportProjectPackageInput) => Promise<ImportProjectPackageResult>;
  listActiveProjects: () => Promise<ActiveProject[]>;
  getProjectMetadata: (projectId: string) => Promise<ProjectMetadata | null>;
  updateProjectMetadata: (input: UpdateProjectMetadataInput) => Promise<ProjectMetadata>;
  moveProjectToTrash: (input: TrashProjectInput) => Promise<TrashedProject>;
  listTrashedProjects: () => Promise<TrashedProject[]>;
  restoreProjectFromTrash: (input: TrashProjectInput) => Promise<RestoreProjectResult>;
  purgeProjectFromTrash: (input: TrashProjectInput) => Promise<void>;
};

export const createProjectStore = (
  implementation: ProjectStore,
): ProjectStore => ({
  createProjectContainer: (input) => implementation.createProjectContainer(input),
  duplicateProject: (input) => implementation.duplicateProject(input),
  importProjectPackage: (input) => implementation.importProjectPackage(input),
  listActiveProjects: () => implementation.listActiveProjects(),
  getProjectMetadata: (projectId) => implementation.getProjectMetadata(projectId),
  updateProjectMetadata: (input) => implementation.updateProjectMetadata(input),
  moveProjectToTrash: (input) => implementation.moveProjectToTrash(input),
  listTrashedProjects: () => implementation.listTrashedProjects(),
  restoreProjectFromTrash: (input) => implementation.restoreProjectFromTrash(input),
  purgeProjectFromTrash: (input) => implementation.purgeProjectFromTrash(input),
});
