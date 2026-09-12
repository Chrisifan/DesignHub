export type RevisionAssetReferences = { assetIds: string[] };

export const referencedAssetIds = (revisions: RevisionAssetReferences[]): string[] =>
  [...new Set(revisions.flatMap((revision) => Array.isArray(revision.assetIds) ? revision.assetIds : []))];
