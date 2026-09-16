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
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyLocalized = (value: unknown): boolean => {
  const text = localized(value);
  return Boolean(text.zh.trim() || text.en.trim());
};
const isCompletePortfolioCandidate = (value: unknown): boolean => {
  if (!isRecord(value) || !isNonEmptyLocalized(value.name) || !isNonEmptyLocalized(value.signature)
    || !isNonEmptyLocalized(value.summary ?? value.styleSummary) || !isNonEmptyLocalized(value.principle)
    || !Array.isArray(value.tags) || value.tags.length === 0 || !value.tags.every(isNonEmptyLocalized)
    || !Array.isArray(value.negativeRules) || value.negativeRules.length === 0 || !value.negativeRules.every(isNonEmptyLocalized)
    || !isRecord(value.styleDna)) return false;
  const styleDna = value.styleDna;
  return Array.isArray(styleDna.palette) && styleDna.palette.length > 0
    && styleDna.palette.every((color) => typeof color === 'string' && color.trim().length > 0)
    && isNonEmptyLocalized(styleDna.typography)
    && isNonEmptyLocalized(styleDna.composition)
    && isNonEmptyLocalized(styleDna.texture);
};
const parsePayload = (text: string): unknown => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  const candidates = fenced ? [fenced, trimmed] : [trimmed];
  const opening = new Map<string, string>([['{', '}'], ['[', ']']]);
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch { /* Try extracting a JSON value from surrounding prose. */ }
    for (let start = 0; start < candidate.length; start += 1) {
      const closing = opening.get(candidate[start] ?? '');
      if (!closing) continue;
      const stack = [closing];
      let quoted = false;
      let escaped = false;
      for (let index = start + 1; index < candidate.length; index += 1) {
        const character = candidate[index];
        if (quoted) {
          if (escaped) escaped = false;
          else if (character === '\\') escaped = true;
          else if (character === '"') quoted = false;
          continue;
        }
        if (character === '"') { quoted = true; continue; }
        const nestedClosing = opening.get(character ?? '');
        if (nestedClosing) stack.push(nestedClosing);
        else if (character === stack.at(-1)) {
          stack.pop();
          if (stack.length === 0) {
            try { return JSON.parse(candidate.slice(start, index + 1)); } catch { break; }
          }
        }
      }
    }
  }
  throw new Error('VISION_ANALYSIS_INVALID_RESPONSE');
};

const isTransientVisionError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const status = 'status' in error && typeof error.status === 'number' ? error.status : undefined;
  return status === 408 || status === 425 || status === 429 || (status !== undefined && status >= 500 && status <= 599);
};

const abortableDelay = async (milliseconds: number, signal?: AbortSignal): Promise<void> => {
  if (signal?.aborted) throw Object.assign(new Error('Provider request cancelled locally.'), { kind: 'cancelled' });
  await new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(Object.assign(new Error('Provider request cancelled locally.'), { kind: 'cancelled' }));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
};

const analyzeVisionWithRetry = async (
  adapter: VisionAnalysisAdapter,
  request: VisionRequest,
  signal?: AbortSignal,
): Promise<{ text: string; cost: number | null }> => {
  try {
    return signal ? await adapter.analyzeVision(request, signal) : await adapter.analyzeVision(request);
  } catch (error) {
    if (!isTransientVisionError(error) || signal?.aborted) throw error;
    await abortableDelay(250, signal);
    return signal ? adapter.analyzeVision(request, signal) : adapter.analyzeVision(request);
  }
};
const profileFromCandidate = (value: unknown, index: number): PersonaProfile => {
  if (!isCompletePortfolioCandidate(value)) throw new Error('VISION_ANALYSIS_INVALID_RESPONSE');
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
    const request = {
      prompt: `Analyse portfolio source ${source.id}. Source description: ${source.description}. Return JSON only, without Markdown or explanatory text. Return {"candidates":[{"name":{"zh":"","en":""},"signature":{"zh":"","en":""},"summary":{"zh":"","en":""},"principle":{"zh":"","en":""},"tags":[{"zh":"","en":""}],"styleDna":{"palette":["#000000"],"typography":{"zh":"","en":""},"composition":{"zh":"","en":""},"texture":{"zh":"","en":""}},"negativeRules":[{"zh":"","en":""}]}]}. Every candidate must supply non-empty values for every field, at least one tag, palette color, and negative rule. Do not invent provenance or claim identity.`,
      image: source.image,
    };
    const response = await analyzeVisionWithRetry(input.adapter, request, input.signal);
    if (response.cost === null || response.cost === undefined) costKnown = false;
    else cost += response.cost;
    candidates.push(...candidatesFromResponse(response.text, candidates.length));
  }
  return { taskId: createTaskId('portfolio-analysis'), designerDraftId: input.designerDraftId, sourceIds, candidates: candidates.slice(0, 4), cost: costKnown ? cost : null };
};

export const parsePortfolioCandidates = (text: string): PersonaProfile[] => candidatesFromResponse(text, 0);
