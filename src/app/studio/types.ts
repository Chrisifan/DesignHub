import type { Locale } from '../i18n';
import type { ConversationImageAttachment } from '../../features/agent/task-service';
import type { ProjectCoverFile } from './project-cover';
import type { ProjectCanvasLayout, ProjectDesign } from '../../features/projects/metadata';
import type { ProjectGenerationRatio } from '../../features/projects/size';
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
  generationRatio?: ProjectGenerationRatio;
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
  designs?: ProjectDesign[];
  canvasLayout?: ProjectCanvasLayout;
  documents: number;
  documentEntries?: Array<{ id: string; name: string; width: number; height: number; sourceDocumentId?: string; sourceRevisionId?: string | null; finalizedRevisionId?: string | null }>;
  archived?: boolean;
  updatedAt?: string;
};
export type HomeConversationRequest = {
  message: string;
  attachments: ConversationImageAttachment[];
  designerId?: string;
};
export type PendingHomeConversation = {
  id: string;
  projectId: string;
  documentId?: string;
  message: string;
  attachments: ConversationImageAttachment[];
};
export type PageProps = {
  locale: Locale;
  notify: (message: string) => void;
  navigate: (view: View) => void;
};
