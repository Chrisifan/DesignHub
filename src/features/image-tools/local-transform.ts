import type { DesignScene } from '../canvas/scene';

export type SceneSize = { width: number; height: number };

export const resizeScene = (scene: DesignScene, size: SceneSize): DesignScene => {
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) throw new Error('INVALID_SIZE');
  const xScale = size.width / scene.width;
  const yScale = size.height / scene.height;
  return {
    ...structuredClone(scene),
    width: size.width,
    height: size.height,
    layers: scene.layers.map((layer) => ({
      ...structuredClone(layer),
      x: layer.x * xScale,
      y: layer.y * yScale,
      width: layer.width * xScale,
      height: layer.height * yScale,
    })),
  };
};
