import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { isTrustedWorkspaceRequest } from './workspace';
import { isWorkspaceSettings, type WorkspaceSettings } from '../storage/settings-store';

export const settingsLoadChannel = 'workspace:settings-load';
export const settingsSaveChannel = 'workspace:settings-save';

type SettingsSender = { mainFrame: { url: string }; getURL: () => string };
type SettingsRequest = { sender: SettingsSender; senderFrame: { url: string } | null };
type SettingsWindow = { webContents: SettingsSender };

const isWorkspaceId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const loadSettingsHandler = (
  window: SettingsWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  loadSettings: (workspace: WorkspaceHandle, workspaceId: string) => Promise<WorkspaceSettings | null>,
) => async (event: SettingsRequest, workspaceId: unknown): Promise<WorkspaceSettings | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isWorkspaceId(workspaceId)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== workspaceId) return null;
  return loadSettings(workspace, workspaceId);
};

export const saveSettingsHandler = (
  window: SettingsWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  saveSettings: (workspace: WorkspaceHandle, workspaceId: string, settings: WorkspaceSettings) => Promise<boolean>,
) => async (event: SettingsRequest, input: unknown): Promise<boolean> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return false;
  const value = input as Record<string, unknown>;
  if (!isWorkspaceId(value.workspaceId) || !isWorkspaceSettings(value.settings)) return false;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== value.workspaceId) return false;
  return saveSettings(workspace, value.workspaceId, value.settings);
};
