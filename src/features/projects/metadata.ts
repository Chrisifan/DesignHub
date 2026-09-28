import { isProjectGenerationRatio, type ProjectGenerationRatio } from './size';

export type ProjectDocumentMetadata = {
  id: string;
  name: string;
  width: number;
  height: number;
  sourceDocumentId?: string;
  sourceRevisionId?: string | null;
  finalizedRevisionId?: string | null;
  updatedAt: string;
};

export type ProjectDesign = {
  id: string;
  projectId?: string;
  assetId: string;
  sourceTaskId: string;
  sourceConversationTaskId?: string;
  width: number;
  height: number;
  title: string;
  createdAt: string;
};

export type ProjectCanvasLayout = {
  viewport: { zoom: number; offsetX: number; offsetY: number };
  nodes: Record<string, { x: number; y: number }>;
};

export type ProjectMetadata = {
  projectId: string;
  workspaceId?: string;
  libraryId?: string;
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
  documents: ProjectDocumentMetadata[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMetadataInput = {
  projectId: string;
  workspaceId?: string;
  libraryId?: string;
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
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectMetadataPatch = Partial<Pick<ProjectMetadata, 'name' | 'brief' | 'generationRatio' | 'activeDesignerVersionId' | 'contributorDesignerVersionIds' | 'designerSnapshot' | 'brandSnapshot' | 'coverAssetId' | 'archived'>> & {
  designs?: ProjectDesign[];
  canvasLayout?: ProjectCanvasLayout;
  documents?: Array<Omit<ProjectDocumentMetadata, 'updatedAt'>>;
};

const clone = <T>(value: T): T => structuredClone(value);
const documentIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u;
const designIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u;

const normalizeContributorIds = (activeDesignerVersionId: string | undefined, contributorDesignerVersionIds: string[] | undefined): string[] | undefined => {
  const contributors = [...new Set((contributorDesignerVersionIds ?? []).map((id) => id.trim()).filter(Boolean))];
  if (!activeDesignerVersionId?.trim()) return contributors.length > 0 ? contributors : undefined;
  const activeId = activeDesignerVersionId.trim();
  return [activeId, ...contributors.filter((id) => id !== activeId)];
};

const validateDocument = (document: Omit<ProjectDocumentMetadata, 'updatedAt'>): void => {
  if (!documentIdPattern.test(document.id) || !document.name.trim() || !Number.isFinite(document.width) || !Number.isFinite(document.height) || document.width <= 0 || document.height <= 0) {
    throw new Error('INVALID_DOCUMENT');
  }
};

const validateDocumentList = (documents: Array<Omit<ProjectDocumentMetadata, 'updatedAt'>>): void => {
  const ids = documents.map((document) => document.id);
  if (new Set(ids).size !== ids.length) throw new Error('INVALID_DOCUMENT');
};

const normalizeDocument = (document: Omit<ProjectDocumentMetadata, 'updatedAt'>, updatedAt: string): ProjectDocumentMetadata => {
  validateDocument(document);
  return { ...clone(document), name: document.name.trim(), updatedAt };
};

const validateDesign = (design: ProjectDesign): void => {
  if (!designIdPattern.test(design.id) || !design.assetId.trim() || !design.sourceTaskId.trim() || !design.title.trim()
    || !Number.isFinite(design.width) || !Number.isFinite(design.height) || design.width <= 0 || design.height <= 0
    || Number.isNaN(Date.parse(design.createdAt))) throw new Error('INVALID_PROJECT_DESIGN');
};

const normalizeDesigns = (designs: ProjectDesign[] | undefined, projectId: string): ProjectDesign[] => {
  const next = (designs ?? []).map((design) => {
    validateDesign(design);
    if (design.projectId !== undefined && design.projectId !== projectId) throw new Error('INVALID_PROJECT_DESIGN');
    return { ...clone(design), projectId, id: design.id.trim(), assetId: design.assetId.trim(), sourceTaskId: design.sourceTaskId.trim(), title: design.title.trim() };
  });
  if (new Set(next.map((design) => design.id)).size !== next.length) throw new Error('INVALID_PROJECT_DESIGN');
  return next;
};

const normalizeCanvasLayout = (layout: ProjectCanvasLayout | undefined, designs: ProjectDesign[]): ProjectCanvasLayout | undefined => {
  if (!layout) return undefined;
  const { viewport, nodes } = layout;
  if (!viewport || !Number.isFinite(viewport.zoom) || viewport.zoom <= 0 || !Number.isFinite(viewport.offsetX) || !Number.isFinite(viewport.offsetY) || !nodes || typeof nodes !== 'object') {
    throw new Error('INVALID_PROJECT_CANVAS_LAYOUT');
  }
  const designIds = new Set(designs.map((design) => design.id));
  const normalizedNodes: Record<string, { x: number; y: number }> = {};
  for (const [id, position] of Object.entries(nodes)) {
    if (!designIds.has(id) || !Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new Error('INVALID_PROJECT_CANVAS_LAYOUT');
    normalizedNodes[id] = { x: position.x, y: position.y };
  }
  return { viewport: { zoom: viewport.zoom, offsetX: viewport.offsetX, offsetY: viewport.offsetY }, nodes: normalizedNodes };
};

export const createProjectMetadata = (input: ProjectMetadataInput): ProjectMetadata => {
  const workspaceId = input.workspaceId ?? input.libraryId;
  if (!input.projectId || !workspaceId || !input.name.trim()) throw new Error('INVALID_PROJECT_METADATA');
  if (input.generationRatio !== undefined && !isProjectGenerationRatio(input.generationRatio)) throw new Error('INVALID_PROJECT_METADATA');
  const createdAt = input.createdAt ?? new Date().toISOString();
  const updatedAt = input.updatedAt ?? createdAt;
  if (Number.isNaN(Date.parse(createdAt)) || Number.isNaN(Date.parse(updatedAt))) throw new Error('INVALID_PROJECT_METADATA');
  return {
    projectId: input.projectId,
    workspaceId,
    name: input.name.trim(),
    generationRatio: input.generationRatio ?? '3:4',
    ...(input.brief === undefined ? {} : { brief: input.brief }),
    ...(input.activeDesignerVersionId === undefined ? {} : { activeDesignerVersionId: input.activeDesignerVersionId }),
    ...(normalizeContributorIds(input.activeDesignerVersionId, input.contributorDesignerVersionIds) ? { contributorDesignerVersionIds: normalizeContributorIds(input.activeDesignerVersionId, input.contributorDesignerVersionIds) } : {}),
    ...(input.designerSnapshot === undefined ? {} : { designerSnapshot: clone(input.designerSnapshot) }),
    ...(input.brandSnapshot === undefined ? {} : { brandSnapshot: clone(input.brandSnapshot) }),
    ...(input.coverAssetId === undefined ? {} : { coverAssetId: input.coverAssetId }),
    designs: normalizeDesigns(input.designs, input.projectId),
    ...(input.canvasLayout ? { canvasLayout: normalizeCanvasLayout(input.canvasLayout, normalizeDesigns(input.designs, input.projectId)) } : {}),
    documents: (() => {
      const documents = input.documents ?? [];
      validateDocumentList(documents);
      return documents.map((document) => normalizeDocument(document, updatedAt));
    })(),
    archived: input.archived ?? false,
    createdAt,
    updatedAt,
  };
};

export const updateProjectMetadata = (metadata: ProjectMetadata, patch: ProjectMetadataPatch): ProjectMetadata => {
  if (patch.name !== undefined && !patch.name.trim()) throw new Error('INVALID_PROJECT_METADATA');
  if (patch.generationRatio !== undefined && !isProjectGenerationRatio(patch.generationRatio)) throw new Error('INVALID_PROJECT_METADATA');
  const now = Date.now();
  const previous = Date.parse(metadata.updatedAt);
  const updatedAt = new Date(Math.max(now, Number.isNaN(previous) ? now : previous + 1)).toISOString();
  const nextDocuments = patch.documents === undefined
    ? metadata.documents
    : (() => {
      validateDocumentList(patch.documents!);
      return patch.documents!.map((document) => normalizeDocument(document, updatedAt));
    })();
  const nextDesigns = patch.designs === undefined ? (metadata.designs ?? []) : normalizeDesigns(patch.designs, metadata.projectId);
  return {
    ...clone(metadata),
    ...(patch.name === undefined ? {} : { name: patch.name.trim() }),
    ...(patch.generationRatio === undefined ? {} : { generationRatio: patch.generationRatio }),
    ...(patch.brief === undefined ? {} : { brief: patch.brief }),
    ...(patch.activeDesignerVersionId === undefined ? {} : { activeDesignerVersionId: patch.activeDesignerVersionId.trim() }),
    ...(() => {
      const nextActive = patch.activeDesignerVersionId === undefined ? metadata.activeDesignerVersionId : patch.activeDesignerVersionId;
      const nextContributors = patch.contributorDesignerVersionIds === undefined ? metadata.contributorDesignerVersionIds : patch.contributorDesignerVersionIds;
      const normalized = normalizeContributorIds(nextActive, nextContributors);
      return normalized ? { contributorDesignerVersionIds: normalized } : { contributorDesignerVersionIds: undefined };
    })(),
    ...(patch.designerSnapshot === undefined ? {} : { designerSnapshot: clone(patch.designerSnapshot) }),
    ...(patch.brandSnapshot === undefined ? {} : { brandSnapshot: clone(patch.brandSnapshot) }),
    ...(patch.coverAssetId === undefined ? {} : { coverAssetId: patch.coverAssetId }),
    designs: clone(nextDesigns),
    ...(patch.canvasLayout === undefined ? (metadata.canvasLayout ? { canvasLayout: normalizeCanvasLayout(metadata.canvasLayout, nextDesigns) } : {}) : { canvasLayout: normalizeCanvasLayout(patch.canvasLayout, nextDesigns) }),
    documents: clone(nextDocuments),
    ...(patch.archived === undefined ? {} : { archived: patch.archived }),
    updatedAt,
  };
};
