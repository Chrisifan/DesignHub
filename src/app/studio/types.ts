import type { Locale } from '../i18n';
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
export type CreationMode = 'manual' | 'conversation';
export type StudioSurface = View | 'new-design';
export type NewDesignDraft = {
  name: string;
  goal: string;
  brief: string;
  personaId: string;
  size: '1080 × 1440';
  mode: CreationMode;
};
export type Project = {
  id: string;
  name: string;
  enName: string;
  description: string;
  enDescription: string;
  designers: string[];
  artwork: Artwork;
  documents: number;
  archived?: boolean;
};
export type PageProps = {
  locale: Locale;
  notify: (message: string) => void;
  navigate: (view: View) => void;
};
