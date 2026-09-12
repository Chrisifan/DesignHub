export type LayerBase = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
};

export type ImageLayer = LayerBase & {
  type: 'image';
  assetId: string;
};

export type TextLayer = LayerBase & {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  align: 'left' | 'center' | 'right';
  color: string;
};

export type ShapeLayer = LayerBase & {
  type: 'shape';
  kind: 'rect' | 'ellipse' | 'line';
  fill: string;
  stroke: string;
  strokeWidth: number;
};

export type SceneLayer = ImageLayer | TextLayer | ShapeLayer;

export type DesignScene = {
  version: 1;
  id: string;
  width: number;
  height: number;
  layers: SceneLayer[];
};

export type CreateSceneInput = Omit<DesignScene, 'version'>;

export type ViewportState = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const clone = <T>(value: T): T => structuredClone(value);

const isNonBlank = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const hasAllowedKeys = (value: Record<string, unknown>, allowed: string[]): boolean => Object.keys(value).every((key) => allowed.includes(key));

const isLayerBase = (value: Record<string, unknown>): boolean => (
  isNonBlank(value.id)
  && isFiniteNumber(value.x)
  && isFiniteNumber(value.y)
  && isFiniteNumber(value.width) && value.width > 0
  && isFiniteNumber(value.height) && value.height > 0
  && isFiniteNumber(value.rotation)
  && isFiniteNumber(value.opacity) && value.opacity >= 0 && value.opacity <= 1
  && typeof value.visible === 'boolean'
  && typeof value.locked === 'boolean'
);

const isImageLayer = (value: Record<string, unknown>): boolean => (
  value.type === 'image'
  && hasAllowedKeys(value, ['id', 'type', 'assetId', 'x', 'y', 'width', 'height', 'rotation', 'opacity', 'visible', 'locked'])
  && isLayerBase(value)
  && isNonBlank(value.assetId)
);

const isTextLayer = (value: Record<string, unknown>): boolean => (
  value.type === 'text'
  && hasAllowedKeys(value, ['id', 'type', 'text', 'fontFamily', 'fontSize', 'fontWeight', 'align', 'color', 'x', 'y', 'width', 'height', 'rotation', 'opacity', 'visible', 'locked'])
  && isLayerBase(value)
  && typeof value.text === 'string'
  && isNonBlank(value.fontFamily)
  && isFiniteNumber(value.fontSize) && value.fontSize > 0
  && isNonBlank(value.fontWeight)
  && (value.align === 'left' || value.align === 'center' || value.align === 'right')
  && isNonBlank(value.color)
);

const isShapeLayer = (value: Record<string, unknown>): boolean => (
  value.type === 'shape'
  && hasAllowedKeys(value, ['id', 'type', 'kind', 'fill', 'stroke', 'strokeWidth', 'x', 'y', 'width', 'height', 'rotation', 'opacity', 'visible', 'locked'])
  && isLayerBase(value)
  && (value.kind === 'rect' || value.kind === 'ellipse' || value.kind === 'line')
  && typeof value.fill === 'string'
  && typeof value.stroke === 'string'
  && isFiniteNumber(value.strokeWidth) && value.strokeWidth >= 0
);

const isSceneLayer = (value: unknown): value is SceneLayer => isRecord(value) && (isImageLayer(value) || isTextLayer(value) || isShapeLayer(value));

const validateScene = (value: unknown): DesignScene => {
  if (!isRecord(value)
    || !hasAllowedKeys(value, ['version', 'id', 'width', 'height', 'layers'])
    || value.version !== 1
    || !isNonBlank(value.id)
    || !isFiniteNumber(value.width) || value.width <= 0
    || !isFiniteNumber(value.height) || value.height <= 0
    || !Array.isArray(value.layers)
    || !value.layers.every(isSceneLayer)) throw new Error('INVALID_SCENE');
  const ids = value.layers.map((layer) => layer.id);
  if (new Set(ids).size !== ids.length) throw new Error('INVALID_SCENE');
  return clone(value as DesignScene);
};

export const isScene = (value: unknown): value is DesignScene => {
  try {
    validateScene(value);
    return true;
  } catch {
    return false;
  }
};

const validateSize = (size: { width: number; height: number }): void => {
  if (!isFiniteNumber(size.width) || !isFiniteNumber(size.height) || size.width <= 0 || size.height <= 0) {
    throw new Error('INVALID_SIZE');
  }
};

export const createScene = (input: CreateSceneInput): DesignScene => validateScene({ ...clone(input), version: 1 });

export const serializeScene = (scene: DesignScene): string => JSON.stringify(validateScene(scene));

export const parseScene = (serialized: string): DesignScene => {
  try {
    return validateScene(JSON.parse(serialized) as unknown);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_SCENE') throw error;
    throw new Error('INVALID_SCENE');
  }
};

export const resizeLayer = <T extends SceneLayer>(layer: T, size: { width: number; height: number }): T => {
  validateSize(size);
  return { ...clone(layer), ...size };
};

export const moveLayer = <T extends SceneLayer>(layer: T, position: { x: number; y: number }): T => {
  if (!isFiniteNumber(position.x) || !isFiniteNumber(position.y)) throw new Error('INVALID_POSITION');
  return { ...clone(layer), ...position };
};

export const setLayerVisibility = <T extends SceneLayer>(layer: T, visible: boolean): T => ({ ...clone(layer), visible });

export const setLayerLock = <T extends SceneLayer>(layer: T, locked: boolean): T => ({ ...clone(layer), locked });

export const isLayerInteractive = (layer: SceneLayer): boolean => layer.visible && !layer.locked;

export const reorderLayers = (layers: SceneLayer[], orderedIds: string[]): SceneLayer[] => {
  if (layers.length !== orderedIds.length || new Set(orderedIds).size !== orderedIds.length) throw new Error('INVALID_LAYER_ORDER');
  const byId = new Map(layers.map((layer) => [layer.id, layer]));
  if (!orderedIds.every((id) => byId.has(id))) throw new Error('INVALID_LAYER_ORDER');
  return orderedIds.map((id) => clone(byId.get(id)!));
};

export const replaceSceneLayer = (scene: DesignScene, nextLayer: SceneLayer): DesignScene => {
  const index = scene.layers.findIndex((layer) => layer.id === nextLayer.id);
  if (index < 0) throw new Error('LAYER_NOT_FOUND');
  const layers = scene.layers.map((layer) => layer.id === nextLayer.id ? clone(nextLayer) : clone(layer));
  return createScene({ ...scene, layers });
};

export const selectLayerIds = (scene: DesignScene, selectedIds: string[]): string[] => {
  const available = new Set(scene.layers.map((layer) => layer.id));
  return [...new Set(selectedIds)].filter((id) => available.has(id));
};

export const fitViewport = (scene: DesignScene, available: { width: number; height: number }): ViewportState => {
  validateSize(available);
  const zoom = Math.min(available.width / scene.width, available.height / scene.height);
  return { zoom, offsetX: 0, offsetY: 0 };
};
