import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { isWorkspaceSettings, type WorkspaceSettings } from '../../features/workspace/settings';
import { isTrustedProjectLibraryRequest } from './workspace';

export const settingsLoadChannel = 'workspace:settings-load';
export const settingsSaveChannel = 'workspace:settings-save';

type SettingsSender = { mainFrame: { url: string }; getURL: () => string };
type SettingsRequest = { sender: SettingsSender; senderFrame: { url: string } | null };
type SettingsWindow = { webContents: SettingsSender };

const isWorkspaceId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const loadSettingsHandler = (
  window: SettingsWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  loadSettings: (workspace: ProjectLibraryHandle, libraryId: string) => Promise<WorkspaceSettings | null>,
) => async (event: SettingsRequest, libraryId: unknown): Promise<WorkspaceSettings | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isWorkspaceId(libraryId)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== libraryId) return null;
  return loadSettings(workspace, libraryId);
};

export const saveSettingsHandler = (
  window: SettingsWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  saveSettings: (workspace: ProjectLibraryHandle, libraryId: string, settings: WorkspaceSettings) => Promise<boolean>,
) => async (event: SettingsRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return false;
  const value = input as Record<string, unknown>;
  if (!isWorkspaceId(value.libraryId) || !isWorkspaceSettings(value.settings)) return false;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== value.libraryId) return false;
  return saveSettings(workspace, value.libraryId, value.settings);
};
