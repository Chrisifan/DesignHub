export const visualContextRoles = [
  'edit-target',
  'visual-anchor',
  'content-source',
  'visual-reference',
] as const;

export type VisualContextRole = typeof visualContextRoles[number];

export type VisualContextItem = {
  assetId: string;
  roles: VisualContextRole[];
  confidence: number;
};

export type VisualContextPlan = {
  version: 1;
  items: VisualContextItem[];
  clarificationRequired: boolean;
};

export type ParsedVisualContextEnvelope = {
  brief: string;
  visualContextPlan: VisualContextPlan;
  releasedAssetIds: string[];
};

const rolePriority: Record<VisualContextRole, number> = {
  'edit-target': 0,
  'visual-anchor': 1,
  'content-source': 2,
  'visual-reference': 3,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
};

export const isVisualContextPlan = (value: unknown): value is VisualContextPlan => {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ['version', 'items', 'clarificationRequired'])
    || value.version !== 1
    || typeof value.clarificationRequired !== 'boolean'
    || !Array.isArray(value.items)) return false;

  const assetIds = new Set<string>();
  return value.items.every((candidate) => {
    if (!isRecord(candidate)
      || !hasOnlyKeys(candidate, ['assetId', 'roles', 'confidence'])
      || typeof candidate.assetId !== 'string'
      || !candidate.assetId.trim()
      || assetIds.has(candidate.assetId)) return false;
    if (!Array.isArray(candidate.roles)
      || candidate.roles.length === 0
      || new Set(candidate.roles).size !== candidate.roles.length) return false;
    if (!candidate.roles.every((role) => typeof role === 'string'
      && (visualContextRoles as readonly string[]).includes(role))) return false;
    if (typeof candidate.confidence !== 'number'
      || !Number.isFinite(candidate.confidence)
      || candidate.confidence < 0
      || candidate.confidence > 1) return false;
    assetIds.add(candidate.assetId);
    return true;
  });
};

export const parseVisualContextEnvelope = (text: string): ParsedVisualContextEnvelope | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed)
    || !hasOnlyKeys(parsed, ['brief', 'visualContext', 'releasedAssetIds'])
    || typeof parsed.brief !== 'string'
    || !parsed.brief.trim()
    || !isVisualContextPlan(parsed.visualContext)
    || !Array.isArray(parsed.releasedAssetIds)
    || !parsed.releasedAssetIds.every((id) => typeof id === 'string' && id.trim())
    || new Set(parsed.releasedAssetIds).size !== parsed.releasedAssetIds.length) return null;

  return {
    brief: parsed.brief.trim(),
    visualContextPlan: structuredClone(parsed.visualContext),
    releasedAssetIds: [...parsed.releasedAssetIds],
  };
};

export const buildVisualContextAnalysisInstruction = (input: {
  knownAssetIds: readonly string[];
  previousPlan?: VisualContextPlan;
}): string => [
  'Return JSON only with keys brief, visualContext, and releasedAssetIds.',
  'visualContext must contain version: 1, items, and clarificationRequired.',
  'Allowed roles: edit-target, visual-anchor, content-source, visual-reference.',
  'Every currently supplied image must appear in items. One image may have multiple roles.',
  'Keep previous visual-anchor roles unless the user explicitly asks to stop using them.',
  'Only list an existing asset in releasedAssetIds when the current user message explicitly releases it.',
  'If no single edit target can be determined and an edit target is required, set clarificationRequired true. Ask one clarification question in brief.',
  `Known asset IDs: ${input.knownAssetIds.join(', ') || 'none'}`,
  `Previous plan: ${JSON.stringify(input.previousPlan ?? null)}`,
].join('\n');

export const mergeVisualContextPlan = (input: {
  previous?: VisualContextPlan;
  proposed: VisualContextPlan;
  releasedAssetIds: readonly string[];
  requiredAssetIds: readonly string[];
  knownAssetIds: readonly string[];
}): VisualContextPlan => {
  const known = new Set(input.knownAssetIds);
  const previousIds = new Set(input.previous?.items.map((item) => item.assetId) ?? []);
  const released = new Set(input.releasedAssetIds.filter((id) => known.has(id) && previousIds.has(id)));
  const merged = new Map(
    input.proposed.items
      .filter((item) => known.has(item.assetId))
      .map((item) => [item.assetId, structuredClone(item)]),
  );

  for (const previous of input.previous?.items ?? []) {
    if (released.has(previous.assetId) || !known.has(previous.assetId)) continue;
    const current = merged.get(previous.assetId);
    if (!current && previous.roles.includes('visual-anchor')) {
      merged.set(previous.assetId, structuredClone(previous));
    } else if (current && previous.roles.includes('visual-anchor') && !current.roles.includes('visual-anchor')) {
      current.roles.push('visual-anchor');
    }
  }

  for (const assetId of input.requiredAssetIds) {
    if (known.has(assetId) && !merged.has(assetId)) {
      merged.set(assetId, { assetId, roles: ['visual-reference'], confidence: 0 });
    }
  }

  return {
    version: 1,
    items: [...merged.values()],
    clarificationRequired: input.proposed.clarificationRequired,
  };
};

export const deriveConservativeVisualContextPlan = (input: {
  previous?: VisualContextPlan;
  initialAttachmentAssetIds: readonly string[];
  currentAssetIds: readonly string[];
  canvasAssetIds: readonly string[];
}): VisualContextPlan => {
  const items = new Map((input.previous?.items ?? []).map((item) => [item.assetId, structuredClone(item)]));
  const current = [...new Set(input.currentAssetIds)];

  if (current.length > 0) {
    for (const item of items.values()) {
      item.roles = item.roles.filter((role) => role !== 'edit-target');
    }
    for (const assetId of current) {
      const item = items.get(assetId) ?? { assetId, roles: [], confidence: 0 };
      item.roles = current.length === 1
        ? [...new Set<VisualContextRole>(['edit-target', ...item.roles])]
        : [...new Set<VisualContextRole>([...item.roles, 'visual-reference'])];
      items.set(assetId, item);
    }
  }

  for (const assetId of new Set(input.initialAttachmentAssetIds)) {
    const item = items.get(assetId) ?? { assetId, roles: [], confidence: 0 };
    item.roles = [...new Set<VisualContextRole>([...item.roles, 'visual-anchor', 'visual-reference'])];
    items.set(assetId, item);
  }

  if (![...items.values()].some((item) => item.roles.includes('edit-target'))
    && current.length === 0
    && new Set(input.canvasAssetIds).size === 1) {
    const assetId = input.canvasAssetIds[0]!;
    const item = items.get(assetId) ?? { assetId, roles: [], confidence: 0 };
    item.roles = [...new Set<VisualContextRole>(['edit-target', 'visual-anchor', ...item.roles])];
    items.set(assetId, item);
  }

  const result = [...items.values()];
  return {
    version: 1,
    items: result,
    clarificationRequired: result.length > 0
      && result.filter((item) => item.roles.includes('edit-target')).length !== 1,
  };
};

export const orderedVisualContextItems = (plan: VisualContextPlan): VisualContextItem[] =>
  [...plan.items].sort((left, right) => (
    Math.min(...left.roles.map((role) => rolePriority[role]))
    - Math.min(...right.roles.map((role) => rolePriority[role]))
    || left.assetId.localeCompare(right.assetId)
  ));

export const imageContextLabel = (item: VisualContextItem, origin: string): string =>
  `[DesignHub image: assetId=${item.assetId}; origin=${origin}; roles=${item.roles.join(',')}]`;

export const buildGenerationVisualManifest = (items: readonly VisualContextItem[]): string => [
  'Visual input manifest:',
  ...items.map((item, index) => `Image ${index + 1}: assetId=${item.assetId}; roles=${item.roles.join(',')}`),
].join('\n');
