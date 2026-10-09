import { designGenerationSlotIds, type DesignGenerationSlotId, type TaskRecord } from '../../features/tasks/state';
import type { TaskSource } from '../../features/tasks/state';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import type { AgentTaskService, ConversationImageAttachment, ConversationTestInput, ConversationTestResult, DesignerArtworkGenerationInput, DesignGenerationInput, DesignGenerationSlotRetryInput, ImageEditInput, ImageGenerationInput, ImageGenerationTestInput, ImageGenerationTestResult, PortfolioAnalysisInput } from '../../features/agent/task-service';
import type { PortfolioImageSource } from '../../features/agent/analyze-portfolio';
import { imageTools, validateToolParams } from '../../features/image-tools/target';
import { isProjectGenerationRatio } from '../../features/projects/size';
import { isTrustedProjectLibraryRequest } from './workspace';
import { isScene } from '../../features/canvas/scene';

export const conversationSubmitChannel = 'agent:conversation-submit';
export const designGenerationSubmitChannel = 'agent:design-generation-submit';
export const designGenerationSlotRetryChannel = 'agent:retry-design-generation-slot';
export const conversationTestChannel = 'agent:conversation-test';
export const taskCancelChannel = 'agent:task-cancel';
export const taskRetryChannel = 'agent:task-retry';
export const imageGenerationSubmitChannel = 'agent:image-generation-submit';
export const imageGenerationTestChannel = 'agent:image-generation-test';
export const designerArtworkGenerationSubmitChannel = 'agent:submit-designer-artwork';
export const imageEditSubmitChannel = 'agent:image-edit-submit';
export const portfolioAnalysisSubmitChannel = 'agent:portfolio-analysis-submit';

type AgentSender = { mainFrame: { url: string }; getURL: () => string };
type AgentRequest = { sender: AgentSender; senderFrame: { url: string } | null };
type AgentWindow = { webContents: AgentSender };

export type ConversationInput = {
  projectId?: string;
  source?: TaskSource;
  documentId?: string;
  analysisThreadId?: string;
  conversationParentTaskId?: string;
  referencedAssetIds?: string[];
  designerVersionId?: string;
  baseRevisionId?: string | null;
  connectionId: string;
  model?: string;
  message: string;
  attachments?: ConversationImageAttachment[];
};
export type ConversationBridgeInput = ConversationInput & { libraryId: string };
export type DesignGenerationBridgeInput = DesignGenerationInput;
export type ConversationTestBridgeInput = ConversationTestInput & { libraryId: string };
export type ImageGenerationBridgeInput = ImageGenerationInput & { libraryId: string };
export type ImageGenerationTestBridgeInput = ImageGenerationTestInput & { libraryId: string };
export type DesignerArtworkGenerationBridgeInput = DesignerArtworkGenerationInput & { libraryId: string };
export type ImageEditBridgeInput = ImageEditInput & { libraryId: string };
export type PortfolioAnalysisBridgeInput = PortfolioAnalysisInput & { libraryId: string };

const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isTaskSource = (value: unknown): value is TaskSource => value !== null
  && typeof value === 'object'
  && ((value as Record<string, unknown>).kind === 'project'
    || (value as Record<string, unknown>).kind === 'creation-draft'
    || (value as Record<string, unknown>).kind === 'designer-draft')
  && isNonEmpty((value as Record<string, unknown>).id);
const isConversationAttachment = (value: unknown): value is ConversationImageAttachment => {
  if (!value || typeof value !== 'object') return false;
  const attachment = value as Record<string, unknown>;
  const bytes = attachment.bytes;
  return isNonEmpty(attachment.name) && attachment.name.length <= 255
    && typeof attachment.mimeType === 'string' && /^image\/[a-z0-9.+-]+$/iu.test(attachment.mimeType)
    && bytes instanceof Uint8Array && bytes.byteLength > 0 && bytes.byteLength <= 8 * 1024 * 1024;
};
const isConversationInput = (value: unknown): value is ConversationBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  const sourceValid = input.source === undefined || isTaskSource(input.source);
  const projectValid = input.projectId === undefined || isNonEmpty(input.projectId);
  const hasBinding = isNonEmpty(input.projectId) || isTaskSource(input.source);
  return isNonEmpty(input.libraryId) && hasBinding && sourceValid && projectValid && isNonEmpty(input.connectionId) && isNonEmpty(input.message)
    && (input.documentId === undefined || isNonEmpty(input.documentId))
    && (input.analysisThreadId === undefined || isNonEmpty(input.analysisThreadId))
    && (input.conversationParentTaskId === undefined || isNonEmpty(input.conversationParentTaskId))
    && (input.referencedAssetIds === undefined || (Array.isArray(input.referencedAssetIds) && input.referencedAssetIds.length <= 32 && input.referencedAssetIds.every(isNonEmpty)))
    && (input.designerVersionId === undefined || isNonEmpty(input.designerVersionId))
    && (input.baseRevisionId === undefined || input.baseRevisionId === null || isNonEmpty(input.baseRevisionId))
    && (input.model === undefined || isNonEmpty(input.model))
    && (input.attachments === undefined || (Array.isArray(input.attachments) && input.attachments.length <= 8 && input.attachments.every(isConversationAttachment)));
};
const isConversationTestInput = (value: unknown): value is ConversationTestBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return isNonEmpty(input.libraryId) && isNonEmpty(input.connectionId)
    && (input.model === undefined || isNonEmpty(input.model))
    && (input.timeoutMs === undefined || (Number.isInteger(input.timeoutMs) && Number(input.timeoutMs) >= 1 && Number(input.timeoutMs) <= 300_000));
};
const isDesignGenerationInput = (value: unknown): value is DesignGenerationBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return isNonEmpty(input.libraryId) && isNonEmpty(input.projectId)
    && isNonEmpty(input.conversationTaskId) && isNonEmpty(input.connectionId)
    && (input.documentId === undefined || isNonEmpty(input.documentId))
    && (input.baseRevisionId === undefined || input.baseRevisionId === null || isNonEmpty(input.baseRevisionId))
    && (input.model === undefined || isNonEmpty(input.model))
    && (input.generationRatio === undefined || isProjectGenerationRatio(input.generationRatio))
    && (input.count === undefined || input.count === 1 || input.count === 3);
};
const isPortfolioImage = (value: unknown): value is PortfolioImageSource['image'] => {
  if (!value || typeof value !== 'object') return false;
  const image = value as Record<string, unknown>;
  if (typeof image.url === 'string') {
    if (image.url.length > 4096) return false;
    try {
      const parsed = new URL(image.url);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.username && !parsed.password;
    } catch { return false; }
  }
  return typeof image.base64 === 'string' && image.base64.length > 0 && image.base64.length <= 20_000_000
    && (image.mimeType === undefined || (typeof image.mimeType === 'string' && /^image\/[a-z0-9.+-]+$/iu.test(image.mimeType)));
};
const isPortfolioAnalysisInput = (value: unknown): value is PortfolioAnalysisBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  const source = input.source;
  if (!source || typeof source !== 'object' || (source as Record<string, unknown>).kind !== 'designer-draft' || !isNonEmpty((source as Record<string, unknown>).id)) return false;
  if (!isNonEmpty(input.libraryId) || !isNonEmpty(input.connectionId) || input.rightsConfirmed !== true || !Array.isArray(input.sources) || input.sources.length === 0 || input.sources.length > 8) return false;
  return input.sources.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const sourceItem = item as Record<string, unknown>;
    return isNonEmpty(sourceItem.id) && sourceItem.id.length <= 128 && !/[\u0000-\u001F/\\]/u.test(sourceItem.id)
      && isNonEmpty(sourceItem.description) && sourceItem.description.length <= 4000 && isPortfolioImage(sourceItem.image);
  });
};
const isCancelInput = (value: unknown): value is { libraryId: string; taskId: string } => value !== null
  && typeof value === 'object'
  && isNonEmpty((value as Record<string, unknown>).libraryId)
  && isNonEmpty((value as Record<string, unknown>).taskId);
const isDesignGenerationSlotRetryInput = (value: unknown): value is DesignGenerationSlotRetryInput => value !== null
  && typeof value === 'object'
  && isNonEmpty((value as Record<string, unknown>).libraryId)
  && isNonEmpty((value as Record<string, unknown>).taskId)
  && designGenerationSlotIds.includes((value as Record<string, unknown>).slotId as DesignGenerationSlotId);
const isImageGenerationInput = (value: unknown): value is ImageGenerationBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return isNonEmpty(input.libraryId) && isNonEmpty(input.projectId) && isNonEmpty(input.documentId) && isNonEmpty(input.connectionId) && isNonEmpty(input.prompt)
    && (input.baseRevisionId === undefined || input.baseRevisionId === null || isNonEmpty(input.baseRevisionId))
    && (input.designerVersionId === undefined || isNonEmpty(input.designerVersionId))
    && (input.model === undefined || isNonEmpty(input.model))
    && (input.size === undefined || isNonEmpty(input.size))
    && (input.count === undefined || (Number.isInteger(input.count) && Number(input.count) >= 1 && Number(input.count) <= 4));
};
const isImageGenerationTestInput = (value: unknown): value is ImageGenerationTestBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return isNonEmpty(input.libraryId) && isNonEmpty(input.connectionId) && isNonEmpty(input.prompt)
    && (input.model === undefined || isNonEmpty(input.model))
    && (input.size === undefined || isNonEmpty(input.size))
    && (input.timeoutMs === undefined || (Number.isInteger(input.timeoutMs) && Number(input.timeoutMs) >= 1 && Number(input.timeoutMs) <= 300_000));
};
const isDesignerArtworkGenerationInput = (value: unknown): value is DesignerArtworkGenerationBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  const source = input.source;
  return isNonEmpty(input.libraryId)
    && isNonEmpty(input.connectionId)
    && isNonEmpty(input.prompt)
    && source !== null
    && typeof source === 'object'
    && (source as Record<string, unknown>).kind === 'designer-draft'
    && isNonEmpty((source as Record<string, unknown>).id)
    && (input.model === undefined || isNonEmpty(input.model))
    && (input.size === undefined || isNonEmpty(input.size))
    && (input.count === undefined || (Number.isInteger(input.count) && Number(input.count) >= 1 && Number(input.count) <= 4));
};
const isBlobLike = (value: unknown): value is Blob => Boolean(value && typeof value === 'object' && typeof (value as Blob).size === 'number' && (typeof (value as Blob).arrayBuffer === 'function' || typeof (value as Blob).stream === 'function' || typeof (value as Blob).slice === 'function'));
const isRegion = (value: unknown): boolean => value !== null && typeof value === 'object'
  && ['x', 'y', 'width', 'height'].every((key) => typeof (value as Record<string, unknown>)[key] === 'number' && Number.isFinite((value as Record<string, unknown>)[key]))
  && Number((value as Record<string, unknown>).x) >= 0 && Number((value as Record<string, unknown>).y) >= 0
  && Number((value as Record<string, unknown>).width) > 0 && Number((value as Record<string, unknown>).height) > 0;
const isProjectDesignOutput = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const design = value as Record<string, unknown>;
  return isNonEmpty(design.sourceTaskId)
    && (design.sourceConversationTaskId === undefined || isNonEmpty(design.sourceConversationTaskId))
    && isNonEmpty(design.title)
    && typeof design.width === 'number' && Number.isFinite(design.width) && design.width > 0
    && typeof design.height === 'number' && Number.isFinite(design.height) && design.height > 0;
};
const isImageEditInput = (value: unknown): value is ImageEditBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  const localResize = input.tool === 'resize' && input.connectionId === '';
  return isNonEmpty(input.libraryId) && isNonEmpty(input.projectId) && isNonEmpty(input.documentId) && (localResize || isNonEmpty(input.connectionId)) && isNonEmpty(input.prompt)
    && isBlobLike(input.image)
    && (input.mask === undefined || isBlobLike(input.mask))
    && (input.maskAssetId === undefined || isNonEmpty(input.maskAssetId))
    && (input.baseRevisionId === undefined || input.baseRevisionId === null || isNonEmpty(input.baseRevisionId))
    && (input.designerVersionId === undefined || isNonEmpty(input.designerVersionId))
    && (input.model === undefined || isNonEmpty(input.model))
    && (input.size === undefined || isNonEmpty(input.size))
    && (input.tool === undefined || imageTools.includes(input.tool as typeof imageTools[number]))
    && (input.tool === undefined
      ? input.toolParams === undefined
      : validateToolParams(input.tool as typeof imageTools[number], input.toolParams).ok)
    && (input.region === undefined || isRegion(input.region))
    && (input.targetLayerId === undefined || isNonEmpty(input.targetLayerId))
    && (input.beforeScene === undefined || isScene(input.beforeScene))
    && (input.projectDesign === undefined || isProjectDesignOutput(input.projectDesign));
};

export const createConversationHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  submit: (workspace: ProjectLibraryHandle, input: ConversationBridgeInput) => Promise<TaskRecord>,
) => async (event: AgentRequest, input: unknown): Promise<TaskRecord | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isConversationInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return submit(workspace, input);
};

export const createConversationTestHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  submit: (workspace: ProjectLibraryHandle, input: ConversationTestBridgeInput) => Promise<ConversationTestResult>,
) => async (event: AgentRequest, input: unknown): Promise<ConversationTestResult | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isConversationTestInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return submit(workspace, input);
};

export const createDesignGenerationHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  submit: (workspace: ProjectLibraryHandle, input: DesignGenerationBridgeInput) => Promise<TaskRecord>,
) => async (event: AgentRequest, input: unknown): Promise<TaskRecord | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isDesignGenerationInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId || workspace.library.openMode !== 'writable') return null;
  return submit(workspace, input);
};

export const createPortfolioAnalysisHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  submit: (workspace: ProjectLibraryHandle, input: PortfolioAnalysisBridgeInput) => Promise<TaskRecord>,
) => async (event: AgentRequest, input: unknown): Promise<TaskRecord | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isPortfolioAnalysisInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return submit(workspace, input);
};

export const createImageGenerationHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  submit: (workspace: ProjectLibraryHandle, input: ImageGenerationBridgeInput) => Promise<TaskRecord>,
) => async (event: AgentRequest, input: unknown): Promise<TaskRecord | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isImageGenerationInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return submit(workspace, input);
};

export const createImageGenerationTestHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  submit: (workspace: ProjectLibraryHandle, input: ImageGenerationTestBridgeInput) => Promise<ImageGenerationTestResult>,
) => async (event: AgentRequest, input: unknown): Promise<ImageGenerationTestResult | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isImageGenerationTestInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return submit(workspace, input);
};

export const createDesignerArtworkGenerationHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  submit: (workspace: ProjectLibraryHandle, input: DesignerArtworkGenerationInput) => Promise<TaskRecord>,
) => async (event: AgentRequest, input: unknown): Promise<TaskRecord | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isDesignerArtworkGenerationInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId || workspace.library.openMode !== 'writable') return null;
  return submit(workspace, input);
};

export const createImageEditHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  submit: (workspace: ProjectLibraryHandle, input: ImageEditBridgeInput) => Promise<TaskRecord>,
) => async (event: AgentRequest, input: unknown): Promise<TaskRecord | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isImageEditInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return submit(workspace, input);
};

export const cancelTaskHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  cancel: (workspace: ProjectLibraryHandle, taskId: string) => Promise<boolean>,
) => async (event: AgentRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isCancelInput(input)) return false;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return false;
  return cancel(workspace, input.taskId);
};

export const retryTaskHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  retry: (workspace: ProjectLibraryHandle, taskId: string) => Promise<TaskRecord | undefined>,
) => async (event: AgentRequest, input: unknown): Promise<TaskRecord | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isCancelInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return (await retry(workspace, input.taskId)) ?? null;
};

export const createDesignGenerationSlotRetryHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  retry: (workspace: ProjectLibraryHandle, input: DesignGenerationSlotRetryInput) => Promise<TaskRecord>,
) => async (event: AgentRequest, input: unknown): Promise<TaskRecord | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isDesignGenerationSlotRetryInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId || workspace.library.openMode !== 'writable') return null;
  return retry(workspace, input);
};

export const bindAgentTaskService = (service: AgentTaskService): AgentTaskService => service;
