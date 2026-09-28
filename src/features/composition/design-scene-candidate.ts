import type { DesignScene } from '../canvas/scene';

export type DesignSceneRole = 'core' | 'optional' | 'reference';

export type DesignSceneAsset = {
  assetId: string;
  role: DesignSceneRole;
  label?: string;
};

export type DesignSceneCandidate = {
  id: string;
  sourceTaskId: string;
  mode: 'structured' | 'raster-fallback';
  editable: boolean;
  scene: DesignScene;
  assets: DesignSceneAsset[];
  providerId?: string;
  model?: string;
  createdAt: string;
};

export type DesignSceneCandidateValidation =
  | { ok: true; candidate: DesignSceneCandidate }
  | { ok: false; reason: 'INVALID_CANDIDATE' | 'CORE_ASSET_MISSING' | 'SCENE_INVALID' };

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const validateDesignSceneCandidate = (value: unknown): DesignSceneCandidateValidation => {
  if (!value || typeof value !== 'object') return { ok: false, reason: 'INVALID_CANDIDATE' };
  const candidate = value as Partial<DesignSceneCandidate>;
  if (!nonEmpty(candidate.id) || !nonEmpty(candidate.sourceTaskId)
    || (candidate.mode !== 'structured' && candidate.mode !== 'raster-fallback')
    || typeof candidate.editable !== 'boolean'
    || !candidate.scene || typeof candidate.scene !== 'object'
    || !Array.isArray(candidate.assets)
    || !nonEmpty(candidate.createdAt)) return { ok: false, reason: 'INVALID_CANDIDATE' };
  const assets = candidate.assets as DesignSceneAsset[];
  if (assets.some((asset) => !asset || !nonEmpty(asset.assetId) || !['core', 'optional', 'reference'].includes(asset.role))) {
    return { ok: false, reason: 'INVALID_CANDIDATE' };
  }
  if (candidate.mode === 'raster-fallback' && candidate.editable) return { ok: false, reason: 'INVALID_CANDIDATE' };
  if (assets.filter((asset) => asset.role === 'core').length === 0) return { ok: false, reason: 'CORE_ASSET_MISSING' };
  if (!Number.isFinite(candidate.scene.width) || !Number.isFinite(candidate.scene.height)
    || candidate.scene.width <= 0 || candidate.scene.height <= 0 || !Array.isArray(candidate.scene.layers)) {
    return { ok: false, reason: 'SCENE_INVALID' };
  }
  return { ok: true, candidate: structuredClone(candidate as DesignSceneCandidate) };
};

export const markRasterFallbackCandidate = (candidate: Omit<DesignSceneCandidate, 'mode' | 'editable'>): DesignSceneCandidate => ({
  ...candidate,
  mode: 'raster-fallback',
  editable: false,
});

export const parseStructuredDesignSceneCandidate = (text: string): DesignSceneCandidateValidation => {
  try {
    return validateDesignSceneCandidate(JSON.parse(text) as unknown);
  } catch {
    return { ok: false, reason: 'INVALID_CANDIDATE' };
  }
};
