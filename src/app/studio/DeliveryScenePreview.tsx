import { useEffect, useMemo, useState } from 'react';

import type { DesignScene, SceneLayer } from '../../features/canvas/scene';
import { getDesktopApi } from '../../platform/runtime';

type DeliveryScenePreviewProps = {
  workspaceId: string;
  projectId: string;
  scene: DesignScene;
  alt: string;
};

const rotation = (layer: SceneLayer): string | undefined => layer.rotation
  ? `rotate(${layer.rotation} ${layer.x + layer.width / 2} ${layer.y + layer.height / 2})`
  : undefined;

export const DeliveryScenePreview = ({ workspaceId, projectId, scene, alt }: DeliveryScenePreviewProps) => {
  const [sources, setSources] = useState<Record<string, string>>({});
  const imageAssetIds = useMemo(() => [...new Set(scene.layers.flatMap((layer) => (
    layer.type === 'image' && layer.visible && layer.role !== 'reference' && layer.assetId !== 'placeholder'
      ? [layer.assetId]
      : []
  )))], [scene.layers]);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    setSources({});
    void Promise.all(imageAssetIds.map(async (assetId) => {
      const bytes = await getDesktopApi().readAsset?.({ workspaceId, projectId, assetId });
      if (!bytes || cancelled) return null;
      const url = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'image/*' }));
      objectUrls.push(url);
      return [assetId, url] as const;
    })).then((entries) => {
      if (!cancelled) setSources(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry))));
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageAssetIds, projectId, workspaceId]);

  const visibleLayers = scene.layers.filter((layer) => layer.visible && !(layer.type === 'image' && (layer.role === 'reference' || layer.assetId === 'placeholder')));
  const onlyImage = visibleLayers.length === 1 && visibleLayers[0]?.type === 'image' ? visibleLayers[0] : null;
  if (onlyImage) {
    return sources[onlyImage.assetId]
      ? <img className="delivery-scene-preview" src={sources[onlyImage.assetId]} alt={alt} />
      : <div className="delivery-scene-state delivery-scene-state--loading" role="status">正在读取设计稿…</div>;
  }

  return <svg className="delivery-scene-preview" role="img" aria-label={alt} viewBox={`0 0 ${scene.width} ${scene.height}`}>
    <rect width={scene.width} height={scene.height} fill="#fff" />
    {visibleLayers.map((layer) => {
      if (layer.type === 'image') return sources[layer.assetId]
        ? <image key={layer.id} href={sources[layer.assetId]} x={layer.x} y={layer.y} width={layer.width} height={layer.height} opacity={layer.opacity} transform={rotation(layer)} preserveAspectRatio="none" />
        : null;
      if (layer.type === 'text') return <text key={layer.id} x={layer.x} y={layer.y + layer.fontSize} fontFamily={layer.fontFamily} fontSize={layer.fontSize} fontWeight={layer.fontWeight} fill={layer.color} opacity={layer.opacity} textAnchor={layer.align === 'center' ? 'middle' : layer.align === 'right' ? 'end' : 'start'} transform={rotation(layer)}>{layer.text}</text>;
      if (layer.kind === 'ellipse') return <ellipse key={layer.id} cx={layer.x + layer.width / 2} cy={layer.y + layer.height / 2} rx={layer.width / 2} ry={layer.height / 2} fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} opacity={layer.opacity} transform={rotation(layer)} />;
      return <rect key={layer.id} x={layer.x} y={layer.y} width={layer.width} height={layer.height} fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} opacity={layer.opacity} transform={rotation(layer)} />;
    })}
  </svg>;
};
