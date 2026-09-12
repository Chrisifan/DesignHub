export type ProjectDocumentMetadata = {
  id: string;
  name: string;
  width: number;
  height: number;
  finalizedRevisionId?: string | null;
  updatedAt: string;
};

export type ProjectMetadata = {
  projectId: string;
  workspaceId: string;
  name: string;
  brief?: string;
  activeDesignerVersionId?: string;
  designerSnapshot?: unknown;
  brandSnapshot?: unknown;
  documents: ProjectDocumentMetadata[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMetadataInput = {
  projectId: string;
  workspaceId: string;
  name: string;
  brief?: string;
  activeDesignerVersionId?: string;
  designerSnapshot?: unknown;
  brandSnapshot?: unknown;
  documents?: Array<Omit<ProjectDocumentMetadata, 'updatedAt'>>;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectMetadataPatch = Partial<Pick<ProjectMetadata, 'name' | 'brief' | 'activeDesignerVersionId' | 'designerSnapshot' | 'brandSnapshot' | 'documents' | 'archived'>>;

const clone = <T>(value: T): T => structuredClone(value);

const validateDocument = (document: Omit<ProjectDocumentMetadata, 'updatedAt'>): void => {
  if (!document.id || !document.name.trim() || !Number.isFinite(document.width) || !Number.isFinite(document.height) || document.width <= 0 || document.height <= 0) {
    throw new Error('INVALID_DOCUMENT');
  }
};

const normalizeDocument = (document: Omit<ProjectDocumentMetadata, 'updatedAt'>, updatedAt: string): ProjectDocumentMetadata => {
  validateDocument(document);
  return { ...clone(document), name: document.name.trim(), updatedAt };
};

export const createProjectMetadata = (input: ProjectMetadataInput): ProjectMetadata => {
  if (!input.projectId || !input.workspaceId || !input.name.trim()) throw new Error('INVALID_PROJECT_METADATA');
  const createdAt = input.createdAt ?? new Date().toISOString();
  const updatedAt = input.updatedAt ?? createdAt;
  if (Number.isNaN(Date.parse(createdAt)) || Number.isNaN(Date.parse(updatedAt))) throw new Error('INVALID_PROJECT_METADATA');
  return {
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    name: input.name.trim(),
    ...(input.brief === undefined ? {} : { brief: input.brief }),
    ...(input.activeDesignerVersionId === undefined ? {} : { activeDesignerVersionId: input.activeDesignerVersionId }),
    ...(input.designerSnapshot === undefined ? {} : { designerSnapshot: clone(input.designerSnapshot) }),
    ...(input.brandSnapshot === undefined ? {} : { brandSnapshot: clone(input.brandSnapshot) }),
    documents: (input.documents ?? []).map((document) => normalizeDocument(document, updatedAt)),
    archived: input.archived ?? false,
    createdAt,
    updatedAt,
  };
};

export const updateProjectMetadata = (metadata: ProjectMetadata, patch: ProjectMetadataPatch): ProjectMetadata => {
  if (patch.name !== undefined && !patch.name.trim()) throw new Error('INVALID_PROJECT_METADATA');
  const now = Date.now();
  const previous = Date.parse(metadata.updatedAt);
  const updatedAt = new Date(Math.max(now, Number.isNaN(previous) ? now : previous + 1)).toISOString();
  const nextDocuments = patch.documents === undefined
    ? metadata.documents
    : patch.documents.map((document) => normalizeDocument(document, updatedAt));
  return {
    ...clone(metadata),
    ...(patch.name === undefined ? {} : { name: patch.name.trim() }),
    ...(patch.brief === undefined ? {} : { brief: patch.brief }),
    ...(patch.activeDesignerVersionId === undefined ? {} : { activeDesignerVersionId: patch.activeDesignerVersionId }),
    ...(patch.designerSnapshot === undefined ? {} : { designerSnapshot: clone(patch.designerSnapshot) }),
    ...(patch.brandSnapshot === undefined ? {} : { brandSnapshot: clone(patch.brandSnapshot) }),
    documents: clone(nextDocuments),
    ...(patch.archived === undefined ? {} : { archived: patch.archived }),
    updatedAt,
  };
};
