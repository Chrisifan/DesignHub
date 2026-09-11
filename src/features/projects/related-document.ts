import type { BrandSnapshot } from '../brands/constraints';

export type DesignScene = {
  layers: string[];
  [key: string]: unknown;
};

export type DesignDocument = {
  id: string;
  sourceDocumentId?: string;
  sourceRevisionId?: string;
  size: string;
  scene: DesignScene;
  brandSnapshot: BrandSnapshot;
};

export type RelatedDocumentOptions = {
  id: string;
  size: string;
  scene: DesignScene;
};

const clone = <T>(value: T): T => structuredClone(value);

export const createRelatedDocument = (source: DesignDocument, options: RelatedDocumentOptions): DesignDocument => {
  const sourceRevisionId = source.sourceRevisionId;
  if (!sourceRevisionId?.trim()) throw new Error('SOURCE_REVISION_REQUIRED');
  return {
    id: options.id,
    sourceDocumentId: source.id,
    sourceRevisionId,
    size: options.size,
    scene: clone(options.scene),
    brandSnapshot: clone(source.brandSnapshot),
  };
};
