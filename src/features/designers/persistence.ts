import type { PersonaProfile } from '../../app/studio/personas';

export type DesignerDraftState = Record<string, string>;

export type DesignerLibraryState = {
  profiles: PersonaProfile[];
  defaultId: string;
  drafts?: {
    newDraft?: DesignerDraftState;
    editDrafts?: Record<string, DesignerDraftState>;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const isLocalizedText = (value: unknown): boolean => isRecord(value)
  && typeof value.zh === 'string'
  && typeof value.en === 'string';

const isArtwork = (value: unknown): boolean => value === 'market' || value === 'objects' || value === 'type' || value === 'blank';

const isPortfolioSheet = (value: unknown): boolean => isRecord(value)
  && typeof value.id === 'string'
  && isArtwork(value.artwork)
  && isLocalizedText(value.title)
  && isLocalizedText(value.note);

const isPersonaProfile = (value: unknown): value is PersonaProfile => {
  if (!isRecord(value)) return false;
  const status = value.status;
  const styleDna = value.styleDna;
  return typeof value.id === 'string'
    && value.id.trim().length > 0
    && isLocalizedText(value.name)
    && isLocalizedText(value.signature)
    && isLocalizedText(value.summary)
    && isLocalizedText(value.principle)
    && typeof value.personaCode === 'string'
    && typeof value.version === 'string'
    && (status === 'built-in' || status === 'published' || status === 'draft' || status === 'archived')
    && (value.artworkAssetId === undefined || (typeof value.artworkAssetId === 'string' && value.artworkAssetId.trim().length > 0))
    && typeof value.artworkUrl === 'string'
    && isLocalizedText(value.artworkAlt)
    && Array.isArray(value.tags)
    && value.tags.every((tag) => isLocalizedText(tag))
    && Number.isInteger(value.referenceCount)
    && Number(value.referenceCount) >= 0
    && isRecord(styleDna)
    && Array.isArray(styleDna.palette)
    && styleDna.palette.every((color) => typeof color === 'string')
    && isLocalizedText(styleDna.typography)
    && isLocalizedText(styleDna.composition)
    && isLocalizedText(styleDna.texture)
    && Array.isArray(value.negativeRules)
    && value.negativeRules.every((rule) => isLocalizedText(rule))
    && Array.isArray(value.portfolioSheets)
    && value.portfolioSheets.every((sheet) => isPortfolioSheet(sheet));
};

const isDraftState = (value: unknown): value is DesignerDraftState => isRecord(value)
  && Object.values(value).every((entry) => typeof entry === 'string');

export const isDesignerLibraryState = (value: unknown): value is DesignerLibraryState => {
  if (!isRecord(value)
    || !Array.isArray(value.profiles)
    || !value.profiles.every((profile) => isPersonaProfile(profile))
    || typeof value.defaultId !== 'string'
    || value.defaultId.trim().length === 0) return false;
  if (value.drafts === undefined) return true;
  if (!isRecord(value.drafts)) return false;
  const drafts = value.drafts;
  if (drafts.newDraft !== undefined && !isDraftState(drafts.newDraft)) return false;
  if (drafts.editDrafts !== undefined && (!isRecord(drafts.editDrafts)
    || !Object.values(drafts.editDrafts).every((draft) => isDraftState(draft)))) return false;
  return true;
};

export const cloneDesignerState = (state: DesignerLibraryState): DesignerLibraryState => structuredClone(state);
