import type { WorkspaceDescriptor } from '../features/workspace/open-workspace';

export type WorkspaceCreateInput = {
  parentDirectory: string;
  name: string;
};

export type DesktopApi = {
  chooseWorkspaceDirectory: () => Promise<string | null>;
  createWorkspace?: (input: WorkspaceCreateInput) => Promise<WorkspaceDescriptor | null>;
  openWorkspace?: (directory: string) => Promise<WorkspaceDescriptor | null>;
  storeCredential?: (connectionId: string, secret: string) => Promise<boolean>;
  deleteCredential?: (connectionId: string) => Promise<boolean>;
};

declare global {
  interface Window {
    designhub: DesktopApi;
  }
}
