import type { BrowserWindow } from 'electron';

export const workspaceChannel = 'workspace:choose-directory';

type WorkspaceSender = {
  mainFrame: { url: string };
  getURL: () => string;
};

type WorkspaceRequest = {
  sender: WorkspaceSender;
  senderFrame: { url: string } | null;
};

type WorkspaceWindow = {
  webContents: WorkspaceSender;
};

export type DirectoryDialog = (window: BrowserWindow) => Promise<{ canceled: boolean; filePaths: string[] }>;

export const chooseDirectory = async (window: BrowserWindow, showOpenDialog: DirectoryDialog): Promise<string | null> => {
  const result = await showOpenDialog(window);
  return result.canceled ? null : result.filePaths[0] ?? null;
};

export const isTrustedWorkspaceRequest = (event: WorkspaceRequest, window: WorkspaceWindow, trustedUrl: string): boolean => {
  const frame = event.senderFrame;
  if (event.sender !== window.webContents || frame !== window.webContents.mainFrame || frame === null) return false;
  return frame.url === trustedUrl;
};

export const createWorkspaceHandler = (window: WorkspaceWindow, trustedUrl: string, showOpenDialog: DirectoryDialog) => async (event: WorkspaceRequest): Promise<string | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl)) return null;
  return chooseDirectory(window as never, showOpenDialog);
};
