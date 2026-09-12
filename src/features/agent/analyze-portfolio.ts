import type { VisionRequest } from '../providers/adapter';
import type { LocalizedText, PersonaProfile } from '../../app/studio/personas';

export type PortfolioImageSource = { id: string; description: string; image: VisionRequest['image'] };
export type VisionAnalysisAdapter = { analyzeVision: (request: VisionRequest, signal?: AbortSignal) => Promise<{ text: string; cost: number | null }> };
export type AnalyzePortfolioInput = {
  sourceIds?: string[];
  sources?: PortfolioImageSource[];
  designerDraftId: string;
  connectionId: string;
  adapter?: VisionAnalysisAdapter;
  signal?: AbortSignal;
};
export type AnalyzePortfolioResult = { taskId: string; designerDraftId: string; sourceIds: string[]; candidates: PersonaProfile[]; cost: number | null };

const createTaskId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;
const maxPortfolioSources = 8;
const maxSourceDescriptionLength = 4000;

const normalizeSourceIds = (ids: readonly string[]): string[] => ids.map((id) => id.trim()).filter(Boolean);

const isValidVisionImage = (image: unknown): image is VisionRequest['image'] => {
  if (!image || typeof image !== 'object') return false;
  const value = image as Record<string, unknown>;
  if (typeof value.url === 'string') {
    if (value.url.length > 4096) return false;
    try {
      const parsed = new URL(value.url);
      return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  }
  if (typeof value.base64 !== 'string' || value.base64.trim().length === 0 || value.base64.length > 20_000_000) return false;
  return value.mimeType === undefined || (typeof value.mimeType === 'string' && /^image\/[a-z0-9.+-]+$/iu.test(value.mimeType));
};

const validatePortfolioSources = (sources: readonly PortfolioImageSource[], declaredIds: readonly string[]): string[] => {
  if (sources.length === 0) throw new Error('PORTFOLIO_SOURCE_REQUIRED');
  if (sources.length > maxPortfolioSources) throw new Error('PORTFOLIO_SOURCE_LIMIT');
  const sourceIds = sources.map((source) => source.id.trim());
  if (sourceIds.some((id) => !id || id.length > 128 || /[\u0000-\u001F/\\]/u.test(id))) throw new Error('PORTFOLIO_SOURCE_REQUIRED');
  if (new Set(sourceIds).size !== sourceIds.length) throw new Error('DUPLICATE_SOURCE_ID');
  if (declaredIds.length > 0 && (declaredIds.length !== sourceIds.length || declaredIds.some((id, index) => id !== sourceIds[index]))) {
    throw new Error('PORTFOLIO_SOURCE_MISMATCH');
  }
  sources.forEach((source) => {
    if (!source.description.trim() || source.description.length > maxSourceDescriptionLength) throw new Error('PORTFOLIO_SOURCE_REQUIRED');
    if (!isValidVisionImage(source.image)) throw new Error('INVALID_PORTFOLIO_IMAGE');
  });
  return sourceIds;
};
const localized = (value: unknown, fallback = ''): LocalizedText => {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.zh === 'string' || typeof record.en === 'string') {
      const text = typeof record.zh === 'string' ? record.zh : record.en as string;
      return { zh: typeof record.zh === 'string' ? record.zh : text, en: typeof record.en === 'string' ? record.en : text };
    }
  }
  return { zh: fallback, en: fallback };
};
const parsePayload = (text: string): unknown => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? trimmed;
  try { return JSON.parse(fenced); } catch { throw new Error('VISION_ANALYSIS_INVALID_RESPONSE'); }
};
const profileFromCandidate = (value: unknown, index: number): PersonaProfile => {
  if (!value || typeof value !== 'object') throw new Error('VISION_ANALYSIS_INVALID_RESPONSE');
  const item = value as Record<string, unknown>;
  const name = localized(item.name, `Portfolio candidate ${index + 1}`);
  const styleDna = item.styleDna && typeof item.styleDna === 'object' ? item.styleDna as Record<string, unknown> : {};
  const artworkUrl = typeof item.artworkUrl === 'string' ? item.artworkUrl.trim() : '';
  const artworkAssetId = typeof item.artworkAssetId === 'string' && item.artworkAssetId.trim() ? item.artworkAssetId.trim() : undefined;
  const tags = Array.isArray(item.tags) ? item.tags.map((tag) => localized(tag)).filter((tag) => tag.zh || tag.en) : [];
  const palette = Array.isArray(styleDna.palette) ? styleDna.palette.filter((color): color is string => typeof color === 'string') : [];
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `portfolio-candidate-${index + 1}-${crypto.randomUUID()}`,
    name, signature: localized(item.signature, 'Portfolio analysis draft'), summary: localized(item.summary ?? item.styleSummary), principle: localized(item.principle),
    personaCode: typeof item.personaCode === 'string' && item.personaCode.trim() ? item.personaCode.trim() : `PORTFOLIO-${index + 1}`,
    version: typeof item.version === 'string' && item.version.trim() ? item.version.trim() : 'v0.1', status: 'draft',
    ...(artworkAssetId ? { artworkAssetId } : {}), artworkUrl, artworkAlt: localized(item.artworkAlt, name.zh), tags, referenceCount: 0,
    styleDna: { palette, typography: localized(styleDna.typography), composition: localized(styleDna.composition), texture: localized(styleDna.texture) },
    negativeRules: Array.isArray(item.negativeRules) ? item.negativeRules.map((rule) => localized(rule)).filter((rule) => rule.zh || rule.en) : [], portfolioSheets: [],
  };
};
const candidatesFromResponse = (text: string, offset: number): PersonaProfile[] => {
  const payload = parsePayload(text);
  const values: unknown[] = Array.isArray(payload) ? payload : payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).candidates) ? (payload as Record<string, unknown>).candidates as unknown[] : [];
  if (values.length === 0) throw new Error('VISION_ANALYSIS_INVALID_RESPONSE');
  return values.map((value, index) => profileFromCandidate(value, offset + index));
};

export const analyzePortfolio = async (input: AnalyzePortfolioInput): Promise<AnalyzePortfolioResult> => {
  if (!input.designerDraftId.trim() || !input.connectionId.trim()) throw new Error('ANALYSIS_BINDING_REQUIRED');
  const declaredIds = normalizeSourceIds(input.sourceIds ?? []);
  const sourceIds = input.sources ? validatePortfolioSources(input.sources, declaredIds) : [...new Set(declaredIds)];
  if (sourceIds.length === 0) throw new Error('PORTFOLIO_SOURCE_REQUIRED');
  if (!input.adapter || !input.sources?.length) throw new Error('VISION_ANALYSIS_UNAVAILABLE');
  const candidates: PersonaProfile[] = [];
  let cost = 0;
  let costKnown = true;
  for (const source of input.sources) {
    const request = { prompt: `Analyse portfolio source ${source.id}. Source description: ${source.description}. Return JSON with a candidates array of reviewable designer profile drafts. Do not invent provenance or claim identity.`, image: source.image };
    const response = input.signal ? await input.adapter.analyzeVision(request, input.signal) : await input.adapter.analyzeVision(request);
    if (response.cost === null || response.cost === undefined) costKnown = false;
    else cost += response.cost;
    candidates.push(...candidatesFromResponse(response.text, candidates.length));
  }
  return { taskId: createTaskId('portfolio-analysis'), designerDraftId: input.designerDraftId, sourceIds, candidates: candidates.slice(0, 4), cost: costKnown ? cost : null };
};

export const parsePortfolioCandidates = (text: string): PersonaProfile[] => candidatesFromResponse(text, 0);
