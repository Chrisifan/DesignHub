import type { WorkspaceOpenMode } from './open-mode';

export type WorkspaceDescriptor = {
  workspaceId: string;
  name: string;
  directory: string;
  formatVersion: number;
  openMode: WorkspaceOpenMode;
};

export type WorkspaceHandle = {
  workspace: WorkspaceDescriptor;
  close: () => void;
};
