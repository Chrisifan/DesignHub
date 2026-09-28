import type { ProjectCanvasLayout, ProjectDesign, ProjectDocumentMetadata, ProjectMetadata, ProjectMetadataPatch } from '../projects/metadata';
import type { ProjectGenerationRatio } from '../projects/size';

export type CreateProjectContainerInput = {
  libraryId: string;
  operationId: string;
  name: string;
  generationRatio?: ProjectGenerationRatio;
  brief?: string;
  activeDesignerVersionId?: string;
  contributorDesignerVersionIds?: string[];
  designerSnapshot?: unknown;
  brandSnapshot?: unknown;
  coverAssetId?: string;
  designs?: ProjectDesign[];
  canvasLayout?: ProjectCanvasLayout;
  documents?: Array<Omit<ProjectDocumentMetadata, 'updatedAt'>>;
};

export type CreateProjectContainerResult = {
  projectId: string;
};

export type DuplicateProjectInput = {
  libraryId: string;
  sourceProjectId: string;
  operationId: string;
  name?: string;
};

export type ImportProjectPackageInput = {
  libraryId: string;
  operationId: string;
  archive: Uint8Array;
};

export type ImportProjectPackageResult = {
  projectId: string;
};

export type ActiveProject = {
  projectId: string;
  name: string;
  generationRatio?: ProjectGenerationRatio;
  brief?: string;
  activeDesignerVersionId?: string;
  contributorDesignerVersionIds?: string[];
  designerSnapshot?: unknown;
  brandSnapshot?: unknown;
  coverAssetId?: string;
  designs?: ProjectDesign[];
  canvasLayout?: ProjectCanvasLayout;
  documents?: ProjectDocumentMetadata[];
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type UpdateProjectMetadataInput = {
  libraryId: string;
  projectId: string;
  patch: ProjectMetadataPatch;
};

export type TrashProjectInput = {
  libraryId: string;
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
  addProjectDesigns: (input: { libraryId: string; projectId: string; designs: ProjectDesign[] }) => Promise<ProjectDesign[]>;
  listProjectDesigns: (input: { libraryId: string; projectId: string }) => Promise<ProjectDesign[]>;
  loadProjectCanvasLayout: (input: { libraryId: string; projectId: string }) => Promise<ProjectCanvasLayout | null>;
  saveProjectCanvasLayout: (input: { libraryId: string; projectId: string; layout: ProjectCanvasLayout }) => Promise<ProjectCanvasLayout>;
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
  addProjectDesigns: (input) => implementation.addProjectDesigns(input),
  listProjectDesigns: (input) => implementation.listProjectDesigns(input),
  loadProjectCanvasLayout: (input) => implementation.loadProjectCanvasLayout(input),
  saveProjectCanvasLayout: (input) => implementation.saveProjectCanvasLayout(input),
  moveProjectToTrash: (input) => implementation.moveProjectToTrash(input),
  listTrashedProjects: () => implementation.listTrashedProjects(),
  restoreProjectFromTrash: (input) => implementation.restoreProjectFromTrash(input),
  purgeProjectFromTrash: (input) => implementation.purgeProjectFromTrash(input),
});
