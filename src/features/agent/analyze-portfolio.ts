import type { VisionImage, VisionRequest } from '../providers/adapter';
import type { LocalizedText, PersonaProfile, StyleDnaSignals } from '../../app/studio/personas';
import { isPortfolioAnalysisDiagnostic, type PortfolioAnalysisDiagnostic } from '../tasks/state';

export type PortfolioImageSource = { id: string; description: string; image: VisionImage };
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

type PortfolioAnalysisResponseError = Error & { analysisDiagnostic: PortfolioAnalysisDiagnostic };
const portfolioAnalysisResponseError = (analysisDiagnostic: PortfolioAnalysisDiagnostic): PortfolioAnalysisResponseError => (
  Object.assign(new Error('VISION_ANALYSIS_INVALID_RESPONSE'), { analysisDiagnostic })
);
const isPortfolioAnalysisResponseError = (error: unknown): error is PortfolioAnalysisResponseError => (
  error instanceof Error && 'analysisDiagnostic' in error && isPortfolioAnalysisDiagnostic(error.analysisDiagnostic)
);

const createTaskId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;
const maxPortfolioSources = 8;
const maxSourceDescriptionLength = 4000;

const normalizeSourceIds = (ids: readonly string[]): string[] => ids.map((id) => id.trim()).filter(Boolean);

const isValidVisionImage = (image: unknown): image is VisionImage => {
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
      const text = (typeof record.zh === 'string' ? record.zh : record.en as string).trim();
      return {
        zh: typeof record.zh === 'string' ? record.zh.trim() : text,
        en: typeof record.en === 'string' ? record.en.trim() : text,
      };
    }
  }
  return { zh: fallback.trim(), en: fallback.trim() };
};
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyLocalized = (value: unknown): boolean => {
  const text = localized(value);
  return Boolean(text.zh.trim() || text.en.trim());
};
const isPercentage = (value: unknown): value is number => typeof value === 'number'
  && Number.isFinite(value)
  && value >= 0
  && value <= 100;
const normalizedPercentage = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)%?$/u);
  return match ? Number(match[1]) : value;
};
const isCompleteSignals = (value: unknown): boolean => isRecord(value)
  && isPercentage(normalizedPercentage(value.contrast))
  && isPercentage(normalizedPercentage(value.darkAiriness))
  && isPercentage(normalizedPercentage(value.whitespace))
  && isPercentage(normalizedPercentage(value.grain))
  && isPercentage(normalizedPercentage(value.diffuseLight))
  && isNonEmptyLocalized(value.typeFamily)
  && isNonEmptyLocalized(value.typeWeight)
  && isNonEmptyLocalized(value.tracking)
  && isNonEmptyLocalized(value.compositionTopology)
  && isNonEmptyLocalized(value.rendering);
const invalidSignalsDiagnostic = (value: unknown): PortfolioAnalysisDiagnostic | undefined => {
  if (!isRecord(value)) return 'candidate.required_fields';
  const percentages = [
    ['contrast', value.contrast],
    ['darkAiriness', value.darkAiriness],
    ['whitespace', value.whitespace],
    ['grain', value.grain],
    ['diffuseLight', value.diffuseLight],
  ] as const;
  for (const [field, candidate] of percentages) {
    if (!isPercentage(normalizedPercentage(candidate))) {
      return `candidate.styleDna.signals.${field}.invalid_percentage` as PortfolioAnalysisDiagnostic;
    }
  }
  const descriptions = [
    ['typeFamily', value.typeFamily],
    ['typeWeight', value.typeWeight],
    ['tracking', value.tracking],
    ['compositionTopology', value.compositionTopology],
    ['rendering', value.rendering],
  ] as const;
  for (const [field, candidate] of descriptions) {
    if (!isNonEmptyLocalized(candidate)) return `candidate.styleDna.signals.${field}.required` as PortfolioAnalysisDiagnostic;
  }
  return undefined;
};
const invalidCandidateDiagnostic = (value: unknown): PortfolioAnalysisDiagnostic | undefined => {
  if (!isRecord(value) || !isNonEmptyLocalized(value.name) || !isNonEmptyLocalized(value.signature)
    || !isNonEmptyLocalized(value.summary ?? value.styleSummary) || !isNonEmptyLocalized(value.principle)
    || !Array.isArray(value.tags) || value.tags.length === 0 || !value.tags.every(isNonEmptyLocalized)
    || !Array.isArray(value.negativeRules) || value.negativeRules.length === 0 || !value.negativeRules.every(isNonEmptyLocalized)
    || !isRecord(value.styleDna)) return 'candidate.required_fields';
  const styleDna = value.styleDna;
  if (!Array.isArray(styleDna.palette) || styleDna.palette.length === 0
    || !styleDna.palette.every((color) => typeof color === 'string' && color.trim().length > 0)) {
    return 'candidate.styleDna.palette.required';
  }
  if (!isNonEmptyLocalized(styleDna.typography)) return 'candidate.styleDna.typography.required';
  if (!isNonEmptyLocalized(styleDna.composition)) return 'candidate.styleDna.composition.required';
  if (!isNonEmptyLocalized(styleDna.texture)) return 'candidate.styleDna.texture.required';
  return styleDna.signals === undefined ? undefined : invalidSignalsDiagnostic(styleDna.signals);
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
    && isNonEmptyLocalized(styleDna.texture)
    && (styleDna.signals === undefined || isCompleteSignals(styleDna.signals));
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
  throw portfolioAnalysisResponseError('payload.invalid_json');
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
const portfolioCandidateContract = '{"candidates":[{"name":{"zh":"","en":""},"signature":{"zh":"","en":""},"summary":{"zh":"","en":""},"principle":{"zh":"","en":""},"tags":[{"zh":"","en":""}],"styleDna":{"palette":["#000000"],"typography":{"zh":"","en":""},"composition":{"zh":"","en":""},"texture":{"zh":"","en":""},"signals":{"contrast":0,"darkAiriness":0,"whitespace":0,"grain":0,"diffuseLight":0,"typeFamily":{"zh":"","en":""},"typeWeight":{"zh":"","en":""},"tracking":{"zh":"","en":""},"compositionTopology":{"zh":"","en":""},"rendering":{"zh":"","en":""}}},"negativeRules":[{"zh":"","en":""}]}]}';
const portfolioSynthesisPrompt = (sources: readonly PortfolioImageSource[]): string => {
  const descriptions = sources.map((source, index) => `${index + 1}. ${source.description}`).join('\n');
  return `Analyse all selected portfolio sources as one coherent visual system. Source descriptions:\n${descriptions}\nReturn JSON only, without Markdown or explanatory text. Return exactly one candidate in ${portfolioCandidateContract}. Create an original designer name derived from the combined visual style; do not use placeholders such as Portfolio candidate. Supply non-empty values for every field, at least one tag, palette color, and negative rule. Express each numeric visual signal as an integer from 0 to 100 based on the visible portfolio evidence; these are editable inferred signals, not accuracy scores or exact physical measurements. Do not invent provenance or claim identity.`;
};
const portfolioRepairPrompt = (diagnostic: PortfolioAnalysisDiagnostic): string => `The previous portfolio analysis response did not match the required JSON contract (${diagnostic}). Analyse the supplied portfolio images again and return a complete replacement response. Return JSON only, without Markdown, commentary, or a patch. Return exactly one candidate in ${portfolioCandidateContract}. Supply non-empty values for every field, at least one tag, palette color, and negative rule. Every numeric visual signal must be a number from 0 to 100.`;
const signalsFromCandidate = (value: unknown): StyleDnaSignals | undefined => {
  if (value === undefined) return undefined;
  if (!isCompleteSignals(value)) throw portfolioAnalysisResponseError('candidate.required_fields');
  const signals = value as Record<string, unknown>;
  return {
    contrast: normalizedPercentage(signals.contrast) as number,
    darkAiriness: normalizedPercentage(signals.darkAiriness) as number,
    whitespace: normalizedPercentage(signals.whitespace) as number,
    grain: normalizedPercentage(signals.grain) as number,
    diffuseLight: normalizedPercentage(signals.diffuseLight) as number,
    typeFamily: localized(signals.typeFamily),
    typeWeight: localized(signals.typeWeight),
    tracking: localized(signals.tracking),
    compositionTopology: localized(signals.compositionTopology),
    rendering: localized(signals.rendering),
  };
};
const profileFromCandidate = (value: unknown, index: number): PersonaProfile => {
  const diagnostic = invalidCandidateDiagnostic(value);
  if (diagnostic || !isCompletePortfolioCandidate(value)) throw portfolioAnalysisResponseError(diagnostic ?? 'candidate.required_fields');
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
    styleDna: {
      palette,
      typography: localized(styleDna.typography),
      composition: localized(styleDna.composition),
      texture: localized(styleDna.texture),
      ...(styleDna.signals === undefined ? {} : { signals: signalsFromCandidate(styleDna.signals) }),
    },
    negativeRules: Array.isArray(item.negativeRules) ? item.negativeRules.map((rule) => localized(rule)).filter((rule) => rule.zh || rule.en) : [], portfolioSheets: [],
  };
};
const candidatesFromResponse = (text: string, offset: number): PersonaProfile[] => {
  const payload = parsePayload(text);
  const values: unknown[] = Array.isArray(payload) ? payload : payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).candidates) ? (payload as Record<string, unknown>).candidates as unknown[] : [];
  if (values.length !== 1) throw portfolioAnalysisResponseError('candidates.expected_single_candidate');
  return values.map((value, index) => profileFromCandidate(value, offset + index));
};

export const analyzePortfolio = async (input: AnalyzePortfolioInput): Promise<AnalyzePortfolioResult> => {
  if (!input.designerDraftId.trim() || !input.connectionId.trim()) throw new Error('ANALYSIS_BINDING_REQUIRED');
  const declaredIds = normalizeSourceIds(input.sourceIds ?? []);
  const sourceIds = input.sources ? validatePortfolioSources(input.sources, declaredIds) : [...new Set(declaredIds)];
  if (sourceIds.length === 0) throw new Error('PORTFOLIO_SOURCE_REQUIRED');
  if (!input.adapter || !input.sources?.length) throw new Error('VISION_ANALYSIS_UNAVAILABLE');
  let response = await analyzeVisionWithRetry(input.adapter, {
    prompt: portfolioSynthesisPrompt(input.sources),
    images: input.sources.map((source) => source.image),
  }, input.signal);
  let candidates: PersonaProfile[];
  try {
    candidates = candidatesFromResponse(response.text, 0);
  } catch (error) {
    if (!isPortfolioAnalysisResponseError(error)) throw error;
    if (input.signal?.aborted) throw Object.assign(new Error('Provider request cancelled locally.'), { kind: 'cancelled' });
    response = await analyzeVisionWithRetry(input.adapter, {
      prompt: portfolioRepairPrompt(error.analysisDiagnostic),
      images: input.sources.map((source) => source.image),
    }, input.signal);
    candidates = candidatesFromResponse(response.text, 0);
  }
  return { taskId: createTaskId('portfolio-analysis'), designerDraftId: input.designerDraftId, sourceIds, candidates, cost: response.cost ?? null };
};

export const parsePortfolioCandidates = (text: string): PersonaProfile[] => candidatesFromResponse(text, 0);
