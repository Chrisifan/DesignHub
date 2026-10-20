import type { Region } from '../canvas/selection';
import type { DesignScene } from '../canvas/scene';
import type { ImageTool, ToolParams } from '../image-tools/target';
import type { VisualContextPlan } from '../agent/visual-context';

export type TaskState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'unknown';

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

export type ToolCandidate = {
  taskId: string;
  tool: ImageTool;
  sourceAssetId: string;
  baseRevisionId: string | null;
  resultAssetId: string;
  beforeScene: DesignScene;
  candidateScene: DesignScene;
  toolParams?: ToolParams;
  providerId?: string;
  model?: string;
  remoteRequestId?: string;
};

export const designGenerationSlotIds = ['primary', 'composition', 'expressive'] as const;
export type DesignGenerationSlotId = typeof designGenerationSlotIds[number];
export type DesignGenerationSlotState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskDiagnostic = { host?: string; causeName?: string; causeCode?: string };

export type DesignGenerationSlot = {
  id: DesignGenerationSlotId;
  direction: string;
  state: DesignGenerationSlotState;
  attempt: number;
  remoteRequestId?: string;
  assetId?: string;
  candidateId?: string;
  errorCode?: string;
  diagnostic?: TaskDiagnostic;
  providerFailure?: TaskProviderFailure;
  cost?: number | null;
};

export type PortfolioTaskMetadata = {
  sourceIds: string[];
  rightsConfirmed: boolean;
};

export type ProjectDesignOutput = {
  sourceConversationTaskId?: string;
  width: number;
  height: number;
  title: string;
};

export type TaskProviderFailureKind = 'http' | 'rate_limited' | 'invalid_response' | 'cancelled';

/** Safe, actionable provider metadata. Never include provider messages or request payloads here. */
export type TaskProviderFailure = {
  kind: TaskProviderFailureKind;
  status?: number;
  providerCode?: string;
  retryAfterSeconds?: number;
};

const designGenerationDirections: Record<DesignGenerationSlotId, string> = {
  primary: '主方案：准确落实用户需求、内容层级、品牌约束和设计师风格。',
  composition: '构图探索：保持内容、品牌和风格约束，明显改变构图、视觉动线和信息层级。',
  expressive: '视觉突破：保持核心需求和可用性，采用更大胆但仍可交付的视觉表达。',
};

export const createDesignGenerationSlots = (count: 1 | 3 = 3): DesignGenerationSlot[] => designGenerationSlotIds.slice(0, count === 1 ? 1 : 3).map((id) => ({
  id,
  direction: designGenerationDirections[id],
  state: 'queued',
  attempt: 1,
}));

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
  'id', 'requestId', 'requestText', 'state', 'cancelRequested', 'attempt', 'source',
  'sourceAssetId', 'maskAssetId', 'hasMask', 'baseRevisionId', 'designerVersionId', 'providerId', 'capability',
  'sourceDesignId',
  'portfolio', 'model', 'size', 'count', 'tool', 'toolParams', 'region', 'createdAt', 'updatedAt',
  'projectDesignOutput',
  'errorCode', 'providerFailure', 'analysisDiagnostic', 'result', 'parentConversationTaskId', 'contextAssetIds', 'contextVersion', 'designContext',
  'analysisThreadId', 'conversationParentTaskId', 'progressText', 'generationSlots', 'visualContextPlan',
  'remoteRequestId', 'remoteSupportsCancellation', 'remoteSupportsStatusQuery',
]);

export type TaskRecord = {
  id: string;
  requestId: string;
  requestText?: string;
  state: TaskState;
  cancelRequested: boolean;
  attempt: number;
  source?: TaskSource;
  sourceAssetId?: string;
  /** Exact source design selected for an image edit; asset ids may be shared by legacy records. */
  sourceDesignId?: string;
  /** Managed PNG mask used by a regional image task. */
  maskAssetId?: string;
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
  /** Provider-side request metadata; never used to auto-resubmit after restart. */
  remoteRequestId?: string;
  remoteSupportsCancellation?: boolean;
  remoteSupportsStatusQuery?: boolean;
  generationSlots?: DesignGenerationSlot[];
  contextAssetIds?: string[];
  contextVersion?: number;
  designContext?: import('../agent/context').DesignGenerationContext;
  visualContextPlan?: VisualContextPlan;
  portfolio?: PortfolioTaskMetadata;
  model?: string;
  size?: string;
  count?: number;
  tool?: ImageTool;
  toolParams?: ToolParams;
  /** Durable output metadata required to append a retried image-tool result to the project canvas. */
  projectDesignOutput?: ProjectDesignOutput;
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
    candidates?: TaskCandidate[];
    toolCandidate?: ToolCandidate;
  };
};

const transitions: Record<TaskState, TaskState[]> = {
  queued: ['running', 'cancelled', 'failed'],
  running: ['completed', 'cancelled', 'failed'],
  completed: [],
  failed: [],
  cancelled: [],
  unknown: ['queued'],
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
  task.state === 'completed' || task.state === 'failed' || task.state === 'cancelled' || task.state === 'unknown'
    ? { ...task }
    : { ...task, cancelRequested: true }
);

export const completeTask = (task: TaskRecord): TaskRecord => (
  task.cancelRequested ? transitionTask(task, 'cancelled') : transitionTask(task, 'completed')
);

export const retryTask = (task: TaskRecord, id: string): TaskRecord => {
  if (task.state !== 'failed' && task.state !== 'cancelled' && task.state !== 'unknown') throw new Error('TASK_NOT_RETRYABLE');
  return {
    ...task,
    id,
    state: 'queued',
    cancelRequested: false,
    attempt: task.attempt + 1,
    errorCode: undefined,
    providerFailure: undefined,
    analysisDiagnostic: undefined,
    ...(task.capability === 'design-generation' && !task.generationSlots?.length
      ? { generationSlots: createDesignGenerationSlots(), result: undefined }
      : {}),
  };
};
