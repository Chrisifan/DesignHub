import type { BrowserWindow } from 'electron';
import { loadSettingsHandler, saveSettingsHandler, settingsLoadChannel, settingsSaveChannel } from './settings';
import { createProviderConfigLoadHandler, createProviderConfigSaveHandler, createProviderStatusLoadHandler, createProviderStatusSaveHandler, providerConfigLoadChannel, providerConfigSaveChannel, providerStatusLoadChannel, providerStatusSaveChannel } from './providers';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import type { WorkspaceSettings } from '../../features/workspace/settings';
import type { ProviderConfigMap, ProviderConfigSaveInput } from '../../features/providers/config';
import type { ProviderConnectionStatusMap } from '../../features/providers/status';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};

export type RegisterSettingsProviderOptions = {
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  getLibrary: () => ProjectLibraryHandle | null;
  loadSettings: (workspace: ProjectLibraryHandle, libraryId: string) => Promise<WorkspaceSettings | null>;
  saveSettings: (workspace: ProjectLibraryHandle, libraryId: string, settings: WorkspaceSettings) => Promise<boolean>;
  loadProviderConfigs: () => Promise<ProviderConfigMap>;
  saveProviderConfig: (input: ProviderConfigSaveInput) => Promise<boolean>;
  loadProviderStatuses?: () => Promise<ProviderConnectionStatusMap>;
  saveProviderStatuses?: (statuses: ProviderConnectionStatusMap) => Promise<boolean>;
};

export const registerSettingsProviderHandlers = ({
  ipc,
  getWindow,
  getTrustedUrl,
  getLibrary,
  loadSettings,
  saveSettings,
  loadProviderConfigs,
  saveProviderConfig,
  loadProviderStatuses,
  saveProviderStatuses,
}: RegisterSettingsProviderOptions): void => {
  const getContext = () => {
    const window = getWindow();
    const trustedUrl = getTrustedUrl();
    return window && trustedUrl ? { window, trustedUrl } : null;
  };

  ipc.handle(settingsLoadChannel, (event, libraryId) => {
    const context = getContext();
    return context
      ? loadSettingsHandler(context.window, context.trustedUrl, getLibrary, loadSettings)(event as never, libraryId)
      : null;
  });
  ipc.handle(settingsSaveChannel, (event, input) => {
    const context = getContext();
    return context
      ? saveSettingsHandler(context.window, context.trustedUrl, getLibrary, saveSettings)(event as never, input)
      : false;
  });
  ipc.handle(providerConfigLoadChannel, (event) => {
    const context = getContext();
    return context
      ? createProviderConfigLoadHandler(context.window, context.trustedUrl, loadProviderConfigs)(event as never)
      : null;
  });
  ipc.handle(providerConfigSaveChannel, (event, input) => {
    const context = getContext();
    return context
      ? createProviderConfigSaveHandler(context.window, context.trustedUrl, saveProviderConfig)(event as never, input)
      : false;
  });
  ipc.handle(providerStatusLoadChannel, (event) => {
    const context = getContext();
    return context && loadProviderStatuses
      ? createProviderStatusLoadHandler(context.window, context.trustedUrl, loadProviderStatuses)(event as never)
      : null;
  });
  ipc.handle(providerStatusSaveChannel, (event, statuses) => {
    const context = getContext();
    return context && saveProviderStatuses
      ? createProviderStatusSaveHandler(context.window, context.trustedUrl, saveProviderStatuses)(event as never, statuses)
      : false;
  });
};
