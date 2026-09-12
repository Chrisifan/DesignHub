import type { WorkspaceHandle } from '../../features/workspace/open-workspace';
import { isTrustedWorkspaceRequest } from './workspace';

export const projectPackageExportChannel = 'project:package-export';

type PackageSender = { mainFrame: { url: string }; getURL: () => string };
type PackageRequest = { sender: PackageSender; senderFrame: { url: string } | null };
type PackageWindow = { webContents: PackageSender };
type PackageResult = { path: string; sha256: string };

const isWorkspaceId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const exportProjectPackageHandler = (
  window: PackageWindow,
  trustedUrl: string,
  getWorkspace: () => WorkspaceHandle | null,
  exportPackage: (workspace: WorkspaceHandle, projectId: string) => Promise<PackageResult | null>,
) => async (event: PackageRequest, input: unknown): Promise<PackageResult | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  if (!isWorkspaceId(value.workspaceId) || !isWorkspaceId(value.projectId)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.workspace.workspaceId !== value.workspaceId) return null;
  return exportPackage(workspace, value.projectId);
};
