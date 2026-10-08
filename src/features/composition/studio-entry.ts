import { createScene, type ImageLayer } from '../canvas/scene';
import { resolveMockupPlacement, validateMockupRenderInput } from '../mockups/template';
import { validateDesignSceneCandidate, type DesignSceneAsset, type DesignSceneCandidateValidation } from './design-scene-candidate';

type CandidateIdentity = { id: string; sourceTaskId: string; createdAt: string };

export const createCompositionEntryCandidate = (input: CandidateIdentity & {
  width: number;
  height: number;
  assets: DesignSceneAsset[];
}): DesignSceneCandidateValidation => {
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width <= 0 || input.height <= 0) {
    return { ok: false, reason: 'SCENE_INVALID' };
  }
  const layers: ImageLayer[] = input.assets.map((asset, index) => ({
    id: `composition-${index}`,
    type: 'image',
    assetId: asset.assetId,
    role: asset.role === 'reference' ? 'reference' : 'content',
    x: asset.role === 'core' ? 0 : Math.round(input.width * (index % 2 ? 0.55 : 0.05)),
    y: asset.role === 'core' ? 0 : Math.round(input.height * (index % 2 ? 0.07 : 0.66)),
    width: asset.role === 'core' ? input.width : Math.round(input.width * 0.4),
    height: asset.role === 'core' ? input.height : Math.round(input.height * 0.27),
    rotation: 0,
    opacity: asset.role === 'reference' ? 0.55 : 1,
    visible: true,
    locked: asset.role === 'reference',
  }));
  return validateDesignSceneCandidate({
    ...input,
    mode: 'structured',
    editable: true,
    scene: createScene({ id: `scene-${input.id}`, width: input.width, height: input.height, layers }),
  });
};

export const createMockupEntryCandidate = (input: CandidateIdentity & {
  sourceAssetId: string;
  sourceWidth: number;
  sourceHeight: number;
  templateId: string;
  color: string;
}): DesignSceneCandidateValidation | { ok: false; reason: 'TEMPLATE_NOT_FOUND' | 'SOURCE_TOO_SMALL' | 'COLOR_UNSUPPORTED' } => {
  const valid = validateMockupRenderInput(input);
  if (!valid.ok) return valid;
  const { template } = valid;
  const placement = resolveMockupPlacement(template);
  const colors: Record<string, string> = { black: '#202124', white: '#f4f4f0', graphite: '#56595d', oak: '#9a704f', kraft: '#aa8056' };
  return validateDesignSceneCandidate({
    ...input,
    mode: 'structured',
    editable: true,
    assets: [{ assetId: input.sourceAssetId, role: 'core' }],
    scene: createScene({
      id: `scene-${input.id}`,
      width: template.output.width,
      height: template.output.height,
      layers: [
        { id: 'mockup-surface', type: 'shape', kind: 'rect', fill: colors[input.color] ?? input.color, stroke: '#383838', strokeWidth: 1, x: 0, y: 0, width: template.output.width, height: template.output.height, rotation: 0, opacity: 1, visible: true, locked: true },
        { id: 'mockup-artwork', type: 'image', assetId: input.sourceAssetId, role: 'content', x: placement.left, y: placement.top, width: placement.width, height: placement.height, rotation: 0, opacity: 1, visible: true, locked: false },
      ],
    }),
  });
};
