import { useEffect, useRef, useState } from 'react';

import type { SceneLayer } from '../../features/canvas/scene';
import { getDesktopApi } from '../../platform/runtime';
import type { Artwork } from './types';
import { ArtworkPreview } from './ui';

type ProjectDocumentPreviewProps = {
  libraryId?: string;
  projectId: string;
  documentId?: string;
  artwork: Artwork;
  alt: string;
};

export const ProjectDocumentPreview = ({ libraryId, projectId, documentId, artwork, alt }: ProjectDocumentPreviewProps) => {
  const [source, setSource] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setSource(null);
    if (!libraryId || !documentId) return undefined;
    let cancelled = false;
    let objectUrl: string | undefined;

    const load = async (): Promise<void> => {
      const scene = await getDesktopApi().loadDocumentScene?.(libraryId, projectId, documentId);
      const image = scene?.layers.find((layer): layer is Extract<SceneLayer, { type: 'image' }> => (
        layer.type === 'image'
        && layer.role === 'content'
        && layer.assetId !== 'placeholder'
      )) ?? scene?.layers.find((layer): layer is Extract<SceneLayer, { type: 'image' }> => (
        layer.type === 'image'
        && layer.role !== 'reference'
        && layer.assetId !== 'placeholder'
      ));
      if (!image) return;
      const bytes = await getDesktopApi().readAsset?.({ libraryId, projectId, assetId: image.assetId });
      if (!bytes || cancelled) return;
      objectUrl = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'image/*' }));
      objectUrlRef.current = objectUrl;
      if (!cancelled) setSource(objectUrl);
    };

    void load().catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl && objectUrlRef.current === objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrlRef.current = null;
      }
    };
  }, [documentId, projectId, libraryId]);

  return source
    ? <img className="project-detail-document-card__image" src={source} alt={alt} onError={() => {
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
        setSource(null);
      }} />
    : <ArtworkPreview kind={artwork} />;
};
