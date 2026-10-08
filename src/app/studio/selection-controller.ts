import type { SceneLayer, DesignScene } from '../../features/canvas/scene';

export type CanvasSelection = { layerId: string; type: SceneLayer['type'] };

export type SelectedImageLayer = Extract<SceneLayer, { type: 'image' }>;

export const findSelectedLayer = (scene: DesignScene, selection: CanvasSelection | null): SceneLayer | undefined => {
  if (!selection) return undefined;
  const layer = scene.layers.find((candidate) => candidate.id === selection.layerId);
  return layer?.type === selection.type ? layer : undefined;
};

export const findSelectedImageLayer = (scene: DesignScene, selection: CanvasSelection | null): SelectedImageLayer | undefined => {
  const layer = findSelectedLayer(scene, selection);
  return layer?.type === 'image' && layer.assetId !== 'placeholder' ? layer : undefined;
};

export const selectionForLayer = (layer: SceneLayer | undefined): CanvasSelection | null => (
  layer ? { layerId: layer.id, type: layer.type } : null
);
