import type { TaskRecord } from '../../features/tasks/state';
import type { TaskSource } from '../../features/tasks/state';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import type { AgentTaskService } from '../../features/agent/task-service';
import { isTrustedWorkspaceRequest } from './workspace';

export const conversationSubmitChannel = 'agent:conversation-submit';
export const taskCancelChannel = 'agent:task-cancel';
export const taskRetryChannel = 'agent:task-retry';

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
