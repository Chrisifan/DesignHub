import type { BrandSnapshot } from '../brands/constraints';

export type DesignScene = {
  layers: string[];
  [key: string]: unknown;
};

export type DesignDocument = {
  id: string;
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

export const createRelatedDocument = (source: DesignDocument, options: RelatedDocumentOptions): DesignDocument => ({
  id: options.id,
  size: options.size,
  scene: clone(options.scene),
  brandSnapshot: clone(source.brandSnapshot),
});
