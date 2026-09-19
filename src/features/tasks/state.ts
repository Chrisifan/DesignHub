import type { Region } from '../canvas/selection';
import type { ImageTool, ToolParams } from '../image-tools/target';

export type TaskState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type TaskSource = { kind: 'project' | 'creation-draft' | 'designer-draft'; id: string };

export type TaskCandidate = {
  id: string;
  baseRevisionId: string | null;
  assetIds: string[];
  sceneAssetId?: string;
  analysisThreadId?: string;
  parentConversationTaskId?: string;
  designerVersionId?: string;
  createdAt: string;
};

export type PortfolioTaskMetadata = {
  sourceIds: string[];
  rightsConfirmed: boolean;
};

export type TaskProviderFailureKind = 'http' | 'rate_limited' | 'invalid_response' | 'cancelled';

/** Safe, actionable provider metadata. Never include provider messages or request payloads here. */
export type TaskProviderFailure = {
  kind: TaskProviderFailureKind;
  status?: number;
  providerCode?: string;
  retryAfterSeconds?: number;
};

export const portfolioAnalysisDiagnostics = [
  'payload.invalid_json',
  'candidates.expected_single_candidate',
  'candidate.required_fields',
  'candidate.styleDna.palette.required',
  'candidate.styleDna.typography.required',
  'candidate.styleDna.composition.required',
  'candidate.styleDna.texture.required',
  'candidate.styleDna.signals.contrast.invalid_percentage',
  'candidate.styleDna.signals.darkAiriness.invalid_percentage',
  'candidate.styleDna.signals.whitespace.invalid_percentage',
  'candidate.styleDna.signals.grain.invalid_percentage',
  'candidate.styleDna.signals.diffuseLight.invalid_percentage',
  'candidate.styleDna.signals.typeFamily.required',
  'candidate.styleDna.signals.typeWeight.required',
  'candidate.styleDna.signals.tracking.required',
  'candidate.styleDna.signals.compositionTopology.required',
  'candidate.styleDna.signals.rendering.required',
] as const;

export type PortfolioAnalysisDiagnostic = typeof portfolioAnalysisDiagnostics[number];

const portfolioAnalysisDiagnosticSet = new Set<string>(portfolioAnalysisDiagnostics);
export const isPortfolioAnalysisDiagnostic = (value: unknown): value is PortfolioAnalysisDiagnostic => (
  typeof value === 'string' && portfolioAnalysisDiagnosticSet.has(value)
);

const safeProviderCodes = new Set([
  'content_policy_violation', 'context_length_exceeded', 'image_too_large', 'image_too_small',
  'insufficient_quota', 'invalid_image_format', 'invalid_request_error', 'model_not_found',
  'rate_limit_exceeded', 'server_error', 'service_unavailable', 'unsupported_image_format',
  'unsupported_image_type',
]);

export const isSafeProviderCode = (value: unknown): value is string => typeof value === 'string' && safeProviderCodes.has(value);

export const taskRecordKeys = new Set<keyof TaskRecord>([
  'id', 'requestId', 'requestText', 'state', 'cancelRequested', 'attempt', 'source', 'documentId',
  'sourceAssetId', 'hasMask', 'baseRevisionId', 'designerVersionId', 'providerId', 'capability',
  'portfolio', 'model', 'size', 'count', 'tool', 'toolParams', 'region', 'createdAt', 'updatedAt',
  'errorCode', 'providerFailure', 'analysisDiagnostic', 'result', 'parentConversationTaskId', 'contextAssetIds', 'contextVersion', 'designContext',
  'analysisThreadId', 'conversationParentTaskId', 'progressText',
]);

export type TaskRecord = {
  id: string;
  requestId: string;
  requestText?: string;
  state: TaskState;
  cancelRequested: boolean;
  attempt: number;
  source?: TaskSource;
  documentId?: string;
  sourceAssetId?: string;
  hasMask?: boolean;
  baseRevisionId?: string | null;
  designerVersionId?: string;
  providerId?: string;
  capability?: string;
  parentConversationTaskId?: string;
  /** Stable identifier for the temporary multi-turn analysis thread. */
  analysisThreadId?: string;
  /** Previous conversation task in the same analysis thread. */
  conversationParentTaskId?: string;
  /** Incremental analysis text while a conversation task is running. */
  progressText?: string;
  contextAssetIds?: string[];
  contextVersion?: number;
  designContext?: import('../agent/context').DesignGenerationContext;
  portfolio?: PortfolioTaskMetadata;
  model?: string;
  size?: string;
  count?: number;
  tool?: ImageTool;
  toolParams?: ToolParams;
  region?: Region;
  createdAt?: string;
  updatedAt?: string;
  errorCode?: string;
  providerFailure?: TaskProviderFailure;
  analysisDiagnostic?: PortfolioAnalysisDiagnostic;
  result?: {
    text?: string;
    assetIds?: string[];
    sceneAssetId?: string;
    imageCount?: number;
    cost?: number | null;
    candidate?: TaskCandidate;
  };
};

const transitions: Record<TaskState, TaskState[]> = {
  queued: ['running', 'cancelled', 'failed'],
  running: ['completed', 'cancelled', 'failed'],
  completed: [],
  failed: [],
  cancelled: [],
};

export const mayTransition = (from: TaskState, to: TaskState): boolean => transitions[from].includes(to);

export const createTaskState = (input: Omit<TaskRecord, 'state' | 'cancelRequested' | 'attempt'>): TaskRecord => ({
  ...input,
  state: 'running',
  cancelRequested: false,
  attempt: 1,
});

export const transitionTask = (task: TaskRecord, next: TaskState): TaskRecord => {
  if (!mayTransition(task.state, next)) return { ...task };
  return { ...task, state: next };
};

export const requestCancellation = (task: TaskRecord): TaskRecord => (
  task.state === 'completed' || task.state === 'failed' || task.state === 'cancelled'
    ? { ...task }
    : { ...task, cancelRequested: true }
);

export const completeTask = (task: TaskRecord): TaskRecord => (
  task.cancelRequested ? transitionTask(task, 'cancelled') : transitionTask(task, 'completed')
);

export const retryTask = (task: TaskRecord, id: string): TaskRecord => {
  if (task.state !== 'failed' && task.state !== 'cancelled') throw new Error('TASK_NOT_RETRYABLE');
  return { ...task, id, state: 'queued', cancelRequested: false, attempt: task.attempt + 1, errorCode: undefined, providerFailure: undefined, analysisDiagnostic: undefined };
};
