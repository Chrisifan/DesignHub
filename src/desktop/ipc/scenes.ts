import { isTrustedProjectLibraryRequest } from './workspace';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
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

type SceneTarget = { libraryId: string; projectId: string; documentId: string };
type SceneSaveInput = SceneTarget & { scene: DesignScene };

const isId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const isTarget = (value: unknown): value is SceneTarget => {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return isId(input.libraryId) && isId(input.projectId) && isId(input.documentId) && !input.documentId.includes('/') && !input.documentId.includes('\\');
};

const isSaveInput = (value: unknown): value is SceneSaveInput => isTarget(value) && isScene((value as Record<string, unknown>).scene);

export const loadDocumentSceneHandler = (
  window: SceneWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  loadScene: (workspace: ProjectLibraryHandle, projectId: string, documentId: string) => Promise<DesignScene | null>,
) => async (event: SceneRequest, input: unknown): Promise<DesignScene | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isTarget(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return loadScene(workspace, input.projectId, input.documentId);
};

export const saveDocumentSceneHandler = (
  window: SceneWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  saveScene: (workspace: ProjectLibraryHandle, projectId: string, documentId: string, scene: DesignScene) => Promise<boolean>,
) => async (event: SceneRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isSaveInput(input)) return false;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return false;
  return saveScene(workspace, input.projectId, input.documentId, input.scene);
};
