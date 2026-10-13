import type { Locale } from '../i18n';
import type { ConversationImageAttachment } from '../../features/agent/task-service';
import type { ProjectCoverFile } from './project-cover';
import type { ProjectCanvasLayout, ProjectDesign } from '../../features/projects/metadata';
import type { ProjectGenerationRatio } from '../../features/projects/size';
export type View =
  | 'projects'
  | 'designers'
  | 'assets'
  | 'connections'
  | 'tasks'
  | 'image-tools'
  | 'image-tool-remove-background'
  | 'image-tool-upscale'
  | 'image-tool-resize'
  | 'image-tool-format-convert'
  | 'delivery'
  | 'storage'
  | 'settings';
export type Theme = 'system' | 'dark' | 'light';
export type Artwork = 'market' | 'objects' | 'type' | 'blank';
export type CreationMode = 'manual' | 'composition' | 'mockup';
export type StudioSurface = View;
export type ProjectCoverDraft = ProjectCoverFile & { previewUrl: string };
export type NewDesignDraft = {
  name: string;
  goal: string;
  brief: string;
  personaId: string;
  size: '1080 × 1440' | '1080 × 1080' | '1920 × 1080';
  mode: CreationMode;
  coreFile?: File;
  optionalFile?: File;
  referenceFile?: File;
  mockupFile?: File;
  templateId?: string;
  templateColor?: string;
  cover?: ProjectCoverDraft;
};
export type Project = {
  [key: string]: unknown;
  id: string;
  libraryId?: string;
  name: string;
  enName: string;
  generationRatio?: ProjectGenerationRatio;
  description: string;
  enDescription: string;
  designers: string[];
  activeDesignerVersionId?: string;
  contributorDesignerVersionIds?: string[];
  designerSnapshot?: unknown;
  coverAssetId?: string;
  coverPreviewUrl?: string;
  artwork: Artwork;
  designs?: ProjectDesign[];
  canvasLayout?: ProjectCanvasLayout;
  archived?: boolean;
  updatedAt?: string;
};
export type HomeConversationRequest = {
  message: string;
  attachments: ConversationImageAttachment[];
  generationRatio: ProjectGenerationRatio;
  designerId?: string;
};
export type PageProps = {
  locale: Locale;
  notify: (message: string) => void;
  navigate: (view: View) => void;
};
