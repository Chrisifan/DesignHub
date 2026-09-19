import type { Locale } from '../i18n';
import type { ProjectCoverFile } from './project-cover';
export type View =
  | 'projects'
  | 'designers'
  | 'assets'
  | 'brands'
  | 'connections'
  | 'tasks'
  | 'delivery'
  | 'storage'
  | 'settings';
export type Theme = 'system' | 'dark' | 'light';
export type Artwork = 'market' | 'objects' | 'type' | 'blank';
export type CreationMode = 'manual';
export type StudioSurface = View;
export type ProjectCoverDraft = ProjectCoverFile & { previewUrl: string };
export type NewDesignDraft = {
  name: string;
  goal: string;
  brief: string;
  personaId: string;
  size: '1080 × 1440' | '1080 × 1080' | '1920 × 1080';
  mode: CreationMode;
  cover?: ProjectCoverDraft;
};
export type Project = {
  id: string;
  workspaceId?: string;
  documentId?: string;
  name: string;
  enName: string;
  description: string;
  enDescription: string;
  designers: string[];
  activeDesignerVersionId?: string;
  contributorDesignerVersionIds?: string[];
  designerSnapshot?: unknown;
  brandSnapshot?: unknown;
  coverAssetId?: string;
  coverPreviewUrl?: string;
  artwork: Artwork;
  documents: number;
  documentEntries?: Array<{ id: string; name: string; width: number; height: number; sourceDocumentId?: string; sourceRevisionId?: string | null; finalizedRevisionId?: string | null }>;
  archived?: boolean;
};
export type PageProps = {
  locale: Locale;
  notify: (message: string) => void;
  navigate: (view: View) => void;
};
