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

const isPercentage = (value: unknown): boolean => typeof value === 'number'
  && Number.isFinite(value)
  && value >= 0
  && value <= 100;

const isStyleDnaSignals = (value: unknown): boolean => isRecord(value)
  && isPercentage(value.contrast)
  && isPercentage(value.darkAiriness)
  && isPercentage(value.whitespace)
  && isPercentage(value.grain)
  && isPercentage(value.diffuseLight)
  && isLocalizedText(value.typeFamily)
  && isLocalizedText(value.typeWeight)
  && isLocalizedText(value.tracking)
  && isLocalizedText(value.compositionTopology)
  && isLocalizedText(value.rendering);

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
    && (styleDna.signals === undefined || isStyleDnaSignals(styleDna.signals))
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
    || typeof value.defaultId !== 'string') return false;
  if (value.drafts === undefined) return true;
  if (!isRecord(value.drafts)) return false;
  const drafts = value.drafts;
  if (drafts.newDraft !== undefined && !isDraftState(drafts.newDraft)) return false;
  if (drafts.editDrafts !== undefined && (!isRecord(drafts.editDrafts)
    || !Object.values(drafts.editDrafts).every((draft) => isDraftState(draft)))) return false;
  return true;
};

export const cloneDesignerState = (state: DesignerLibraryState): DesignerLibraryState => structuredClone(state);

/** IDs from the removed preview seed. Only these exact legacy records are migrated away. */
export const legacySeededDesignerIds = new Set([
  'paper-type',
  'clear-commerce',
  'natural-story',
  'minimal-form',
]);

/**
 * Migrates the pre-V1 `built-in` marker to the regular published state.
 * New workspaces never create that marker, but accepting it here keeps older
 * workspace files readable without exposing a separate built-in concept.
 */
export const normalizeDesignerState = (state: DesignerLibraryState): DesignerLibraryState => {
  const cloned = cloneDesignerState(state);
  const profiles = cloned.profiles
    .filter((profile) => !legacySeededDesignerIds.has(profile.id))
    .map((profile) => profile.status === 'built-in'
      ? { ...profile, status: 'published' as const }
      : profile);
  const defaultId = profiles.some((profile) => profile.id === cloned.defaultId)
    ? cloned.defaultId
    : '';
  return {
    ...cloned,
    profiles,
    defaultId,
  };
};
