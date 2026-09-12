export const AGENT_TOOL_ALLOWLIST = [
  'resolve-constraint',
  'inspect-scene',
  'execute-image-tool',
  'commit-revision',
] as const;

export type AgentTool = (typeof AGENT_TOOL_ALLOWLIST)[number];

export type AgentToolRequest = {
  tool: string;
  target: Record<string, unknown>;
  params: unknown;
};
export type AgentToolValidation =
  | { ok: true }
  | { ok: false; reason: 'TOOL_NOT_ALLOWED' | 'TARGET_REQUIRED' | 'INVALID_TARGET' | 'PARAMS_REQUIRED' | 'UNSAFE_PARAMS' };

const unsafeKeys = new Set(['apiKey', 'credential', 'password', 'secret', 'prompt', 'systemPrompt', 'shell', 'command']);
const safeIdentifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value);

const hasUnsafeKey = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => unsafeKeys.has(key) || hasUnsafeKey(nested));
};

export const isAllowedAgentTool = (tool: string): tool is AgentTool =>
  (AGENT_TOOL_ALLOWLIST as readonly string[]).includes(tool);

export const validateAgentToolRequest = (request: AgentToolRequest): AgentToolValidation => {
  if (!isAllowedAgentTool(request.tool)) return { ok: false, reason: 'TOOL_NOT_ALLOWED' };
  if (!request.target || typeof request.target !== 'object' || !safeIdentifier(request.target.projectId)) {
    return { ok: false, reason: 'TARGET_REQUIRED' };
  }
  if (Object.entries(request.target).some(([, value]) => value !== undefined && !safeIdentifier(value))) {
    return { ok: false, reason: 'INVALID_TARGET' };
  }
  if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
    return { ok: false, reason: 'PARAMS_REQUIRED' };
  }
  if (hasUnsafeKey(request.params)) return { ok: false, reason: 'UNSAFE_PARAMS' };
  return { ok: true };
};
