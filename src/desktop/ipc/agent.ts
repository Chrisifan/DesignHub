import type { TaskRecord } from '../../features/tasks/state';
import type { TaskSource } from '../../features/tasks/state';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import type { AgentTaskService, ImageEditInput, ImageGenerationInput } from '../../features/agent/task-service';
import { isTrustedWorkspaceRequest } from './workspace';

export const conversationSubmitChannel = 'agent:conversation-submit';
export const taskCancelChannel = 'agent:task-cancel';
export const taskRetryChannel = 'agent:task-retry';
export const imageGenerationSubmitChannel = 'agent:image-generation-submit';
export const imageEditSubmitChannel = 'agent:image-edit-submit';

type AgentSender = { mainFrame: { url: string }; getURL: () => string };
type AgentRequest = { sender: AgentSender; senderFrame: { url: string } | null };
type AgentWindow = { webContents: AgentSender };

export type ConversationInput = {
  projectId?: string;
  source?: TaskSource;
  documentId?: string;
  designerVersionId?: string;
  baseRevisionId?: string | null;
  connectionId: string;
  message: string;
};
export type ConversationBridgeInput = ConversationInput & { workspaceId: string };
export type ImageGenerationBridgeInput = ImageGenerationInput & { workspaceId: string };
export type ImageEditBridgeInput = ImageEditInput & { workspaceId: string };

const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isTaskSource = (value: unknown): value is TaskSource => value !== null
  && typeof value === 'object'
  && ((value as Record<string, unknown>).kind === 'project'
    || (value as Record<string, unknown>).kind === 'creation-draft'
    || (value as Record<string, unknown>).kind === 'designer-draft')
  && isNonEmpty((value as Record<string, unknown>).id);
const isConversationInput = (value: unknown): value is ConversationBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  const sourceValid = input.source === undefined || isTaskSource(input.source);
  const projectValid = input.projectId === undefined || isNonEmpty(input.projectId);
  const hasBinding = isNonEmpty(input.projectId) || isTaskSource(input.source);
  return isNonEmpty(input.workspaceId) && hasBinding && sourceValid && projectValid && isNonEmpty(input.connectionId) && isNonEmpty(input.message)
    && (input.documentId === undefined || isNonEmpty(input.documentId))
    && (input.designerVersionId === undefined || isNonEmpty(input.designerVersionId))
    && (input.baseRevisionId === undefined || input.baseRevisionId === null || isNonEmpty(input.baseRevisionId));
};
const isCancelInput = (value: unknown): value is { workspaceId: string; taskId: string } => value !== null
  && typeof value === 'object'
  && isNonEmpty((value as Record<string, unknown>).workspaceId)
  && isNonEmpty((value as Record<string, unknown>).taskId);
const isImageGenerationInput = (value: unknown): value is ImageGenerationBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return isNonEmpty(input.workspaceId) && isNonEmpty(input.projectId) && isNonEmpty(input.documentId) && isNonEmpty(input.connectionId) && isNonEmpty(input.prompt)
    && (input.baseRevisionId === undefined || input.baseRevisionId === null || isNonEmpty(input.baseRevisionId))
    && (input.designerVersionId === undefined || isNonEmpty(input.designerVersionId))
    && (input.model === undefined || isNonEmpty(input.model))
    && (input.size === undefined || isNonEmpty(input.size))
    && (input.count === undefined || (Number.isInteger(input.count) && Number(input.count) >= 1 && Number(input.count) <= 4));
};
const isBlobLike = (value: unknown): value is Blob => Boolean(value && typeof value === 'object' && typeof (value as Blob).size === 'number' && (typeof (value as Blob).arrayBuffer === 'function' || typeof (value as Blob).stream === 'function' || typeof (value as Blob).slice === 'function'));
const isImageEditInput = (value: unknown): value is ImageEditBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return isNonEmpty(input.workspaceId) && isNonEmpty(input.projectId) && isNonEmpty(input.documentId) && isNonEmpty(input.connectionId) && isNonEmpty(input.prompt)
    && isBlobLike(input.image)
    && (input.mask === undefined || isBlobLike(input.mask))
    && (input.baseRevisionId === undefined || input.baseRevisionId === null || isNonEmpty(input.baseRevisionId))
    && (input.designerVersionId === undefined || isNonEmpty(input.designerVersionId))
    && (input.model === undefined || isNonEmpty(input.model))
    && (input.size === undefined || isNonEmpty(input.size));
};

export const createConversationHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  submit: (workspace: WorkspaceHandle, input: ConversationBridgeInput) => Promise<TaskRecord>,
) => async (event: AgentRequest, input: unknown): Promise<TaskRecord | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isConversationInput(input)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return null;
  return submit(workspace, input);
};

export const createImageGenerationHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  submit: (workspace: WorkspaceHandle, input: ImageGenerationBridgeInput) => Promise<TaskRecord>,
) => async (event: AgentRequest, input: unknown): Promise<TaskRecord | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isImageGenerationInput(input)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return null;
  return submit(workspace, input);
};

export const createImageEditHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  submit: (workspace: WorkspaceHandle, input: ImageEditBridgeInput) => Promise<TaskRecord>,
) => async (event: AgentRequest, input: unknown): Promise<TaskRecord | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isImageEditInput(input)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return null;
  return submit(workspace, input);
};

export const cancelTaskHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  cancel: (workspace: WorkspaceHandle, taskId: string) => Promise<boolean>,
) => async (event: AgentRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isCancelInput(input)) return false;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return false;
  return cancel(workspace, input.taskId);
};

export const retryTaskHandler = (
  window: AgentWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  retry: (workspace: WorkspaceHandle, taskId: string) => Promise<TaskRecord | undefined>,
) => async (event: AgentRequest, input: unknown): Promise<TaskRecord | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isCancelInput(input)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return null;
  return (await retry(workspace, input.taskId)) ?? null;
};

export const bindAgentTaskService = (service: AgentTaskService): AgentTaskService => service;
