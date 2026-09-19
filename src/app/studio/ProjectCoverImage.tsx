import { useEffect, useState } from 'react';

import { getDesktopApi } from '../../platform/runtime';
import { defaultProjectCoverUrl } from './project-cover';

type ProjectCoverImageProps = {
  workspaceId?: string;
  projectId: string;
  coverAssetId?: string;
  previewUrl?: string;
  alt: string;
};

export const ProjectCoverImage = ({ workspaceId, projectId, coverAssetId, previewUrl, alt }: ProjectCoverImageProps) => {
  const [source, setSource] = useState(previewUrl ?? defaultProjectCoverUrl);

  useEffect(() => {
    if (previewUrl || !workspaceId || !coverAssetId) {
      setSource(previewUrl ?? defaultProjectCoverUrl);
      return undefined;
    }
    let cancelled = false;
    let objectUrl: string | undefined;
    setSource(defaultProjectCoverUrl);
    const request = getDesktopApi().readAsset?.({ workspaceId, projectId, assetId: coverAssetId });
    void request?.then((bytes) => {
      if (cancelled || !bytes) return;
      const buffer = bytes.slice().buffer as ArrayBuffer;
      objectUrl = URL.createObjectURL(new Blob([buffer], { type: 'image/*' }));
      setSource(objectUrl);
    }).catch(() => {
      if (!cancelled) setSource(defaultProjectCoverUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [coverAssetId, previewUrl, projectId, workspaceId]);

  return (
    <img
      className="project-cover__image"
      src={source}
      alt={alt}
      onError={() => {
        if (source !== defaultProjectCoverUrl) setSource(defaultProjectCoverUrl);
      }}
    />
  );
};
