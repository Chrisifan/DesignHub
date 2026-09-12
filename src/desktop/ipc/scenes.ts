import { isTrustedWorkspaceRequest } from './workspace';
import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { isScene } from '../../features/canvas/scene';
import type { DesignScene } from '../../features/canvas/scene';

export const sceneLoadChannel = 'scene:load-document';
export const sceneSaveChannel = 'scene:save-document';

type SceneSender = {
  mainFrame: { url: string };
  getURL: () => string;
};

type SceneRequest = {
  sender: SceneSender;
  senderFrame: { url: string } | null;
};

type SceneWindow = { webContents: SceneSender };

type SceneTarget = { workspaceId: string; projectId: string; documentId: string };
type SceneSaveInput = SceneTarget & { scene: DesignScene };

const isId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const isTarget = (value: unknown): value is SceneTarget => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return isId(input.workspaceId) && isId(input.projectId) && isId(input.documentId) && !input.documentId.includes('/') && !input.documentId.includes('\\');
};

const isSaveInput = (value: unknown): value is SceneSaveInput => isTarget(value) && isScene((value as Record<string, unknown>).scene);

export const loadDocumentSceneHandler = (
  window: SceneWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  loadScene: (workspace: WorkspaceHandle, projectId: string, documentId: string) => Promise<DesignScene | null>,
) => async (event: SceneRequest, input: unknown): Promise<DesignScene | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isTarget(input)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return null;
  return loadScene(workspace, input.projectId, input.documentId);
};

export const saveDocumentSceneHandler = (
  window: SceneWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  saveScene: (workspace: WorkspaceHandle, projectId: string, documentId: string, scene: DesignScene) => Promise<boolean>,
) => async (event: SceneRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isSaveInput(input)) return false;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== input.workspaceId) return false;
  return saveScene(workspace, input.projectId, input.documentId, input.scene);
};
