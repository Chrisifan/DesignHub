export type ContextAsset = {
  id: string;
  projectId: string;
};

export const selectContextAssets = (
  assets: ContextAsset[],
  projectId: string,
  currentAssetIds: string[],
  explicitlyAttached: string[],
): string[] => {
  const current = new Set(currentAssetIds);
  const attached = new Set(explicitlyAttached);

  return assets
    .filter((asset) => (asset.projectId === projectId && current.has(asset.id)) || attached.has(asset.id))
    .map((asset) => asset.id)
    .filter((id, index, ids) => ids.indexOf(id) === index);
};

