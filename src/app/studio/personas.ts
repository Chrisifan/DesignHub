import type { Artwork } from './types';

export type LocalizedText = { zh: string; en: string };
export type PersonaCrop = 'avatar' | 'half' | 'full';
export type PersonaCandidateStatus = 'idle' | 'generating' | 'ready' | 'failed';

export type PersonaProfile = {
  id: string;
  name: LocalizedText;
  signature: LocalizedText;
  summary: LocalizedText;
  principle: LocalizedText;
  personaCode: string;
  version: string;
  status: 'built-in' | 'published' | 'draft' | 'archived';
  artworkAssetId?: string;
  artworkUrl: string;
  artworkAlt: LocalizedText;
  tags: LocalizedText[];
  referenceCount: number;
  styleDna: {
    palette: string[];
    typography: LocalizedText;
    composition: LocalizedText;
    texture: LocalizedText;
  };
  negativeRules: LocalizedText[];
  portfolioSheets: Array<{
    id: string;
    artwork: Artwork;
    title: LocalizedText;
    note: LocalizedText;
  }>;
};

export type PersonaCandidate = {
  id: string;
  personaId: string;
  ordinal: 1 | 2 | 3;
  status: PersonaCandidateStatus;
};

export const localize = (locale: 'zh-CN' | 'en', value: LocalizedText): string =>
  locale === 'zh-CN' ? value.zh : value.en;
