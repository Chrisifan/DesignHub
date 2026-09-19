export type ContextAsset = {
  id: string;
  projectId: string;
};

export type DesignGenerationContext = {
  version: 1;
  workspaceId: string;
  projectId: string;
  documentId: string;
  brief: string;
  document: {
    width: number;
    height: number;
    currentImageAssetIds: string[];
  };
  attachmentAssetIds: string[];
  userMessage: string;
  assistantBrief?: string;
  designerSnapshot?: Record<string, unknown>;
  brandSnapshot?: Record<string, unknown>;
  baseRevisionId: string | null;
};

const safeDesignerSnapshot = (snapshot: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
  if (!snapshot) return undefined;
  const allowed = ['id', 'name', 'signature', 'summary', 'principle', 'personaCode', 'version', 'tags', 'styleDna', 'negativeRules'];
  const safe = Object.fromEntries(allowed.filter((key) => snapshot[key] !== undefined).map((key) => [key, snapshot[key]]));
  return Object.keys(safe).length > 0 ? safe : undefined;
};

const safeBrandSnapshot = (snapshot: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
  if (!snapshot) return undefined;
  const allowed = ['id', 'name', 'version', 'colors', 'typography', 'constraints', 'logoUsage'];
  const safe = Object.fromEntries(allowed.filter((key) => snapshot[key] !== undefined).map((key) => [key, snapshot[key]]));
  return Object.keys(safe).length > 0 ? safe : undefined;
};

export const buildDesignContextPrompt = (context: DesignGenerationContext): string => {
  const designer = safeDesignerSnapshot(context.designerSnapshot);
  const brand = safeBrandSnapshot(context.brandSnapshot);
  const sections = [
    'You are the DesignHub canvas design assistant. Use this immutable project context when interpreting the request.',
    `Project brief: ${context.brief || 'Not specified'}`,
    `Document: ${context.document.width}x${context.document.height}px`,
    `User request: ${context.userMessage}`,
    context.assistantBrief ? `Assistant design brief: ${context.assistantBrief}` : '',
    `Current canvas image asset ids: ${context.document.currentImageAssetIds.join(', ') || 'none'}`,
    `Attached reference asset ids: ${context.attachmentAssetIds.join(', ') || 'none'}`,
    designer ? `Designer profile: ${JSON.stringify(designer)}` : '',
    brand ? `Brand profile: ${JSON.stringify(brand)}` : '',
    designer ? 'Return concise, actionable design direction. Respect all negative rules.' : 'Return concise, actionable design direction based on the project brief and user request.',
  ];
  return sections.filter(Boolean).join('\n');
};
export const selectContextAssets = (
  assets: ContextAsset[],
  projectId: string,
  currentAssetIds: string[],
  explicitlyAttached: string[],
): string[] => {
  const current = new Set(currentAssetIds);
  const attached = new Set(explicitlyAttached);

  return assets
    .filter((asset) => (asset.projectId === projectId && current.has(asset.id)) || attached.has(asset.id))
    .map((asset) => asset.id)
    .filter((id, index, ids) => ids.indexOf(id) === index);
};
