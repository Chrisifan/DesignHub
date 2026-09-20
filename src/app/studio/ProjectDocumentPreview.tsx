import { useEffect, useState } from 'react';

import { getDesktopApi } from '../../platform/runtime';
import type { Artwork } from './types';
import { ArtworkPreview } from './ui';

type ProjectDocumentPreviewProps = {
  workspaceId?: string;
  projectId: string;
  documentId?: string;
  artwork: Artwork;
  alt: string;
};

export const ProjectDocumentPreview = ({ workspaceId, projectId, documentId, artwork, alt }: ProjectDocumentPreviewProps) => {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    setSource(null);
    if (!workspaceId || !documentId) return undefined;
    let cancelled = false;
    let objectUrl: string | undefined;

    const load = async (): Promise<void> => {
      const scene = await getDesktopApi().loadDocumentScene?.(workspaceId, projectId, documentId);
      const image = scene?.layers.find((layer) => (
        layer.type === 'image'
        && layer.role === 'content'
        && layer.assetId !== 'placeholder'
      )) ?? scene?.layers.find((layer) => (
        layer.type === 'image'
        && layer.role !== 'reference'
        && layer.assetId !== 'placeholder'
      ));
      if (!image) return;
      const bytes = await getDesktopApi().readAsset?.({ workspaceId, projectId, assetId: image.assetId });
      if (!bytes || cancelled) return;
      objectUrl = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'image/*' }));
      if (!cancelled) setSource(objectUrl);
    };

    void load().catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, projectId, workspaceId]);

  return source
    ? <img className="project-detail-document-card__image" src={source} alt={alt} onError={() => setSource(null)} />
    : <ArtworkPreview kind={artwork} />;
};
