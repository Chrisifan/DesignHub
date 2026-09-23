import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { isTrustedWorkspaceRequest } from './workspace';

export const projectPackageExportChannel = 'project:package-export';
export const projectPackageImportChannel = 'project:package-import';

type PackageSender = { mainFrame: { url: string }; getURL: () => string };
type PackageRequest = { sender: PackageSender; senderFrame: { url: string } | null };
type PackageWindow = { webContents: PackageSender };
type PackageResult = { path: string; sha256: string };
type ImportResult = { projectId: string };

const isWorkspaceId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const exportProjectPackageHandler = (
  window: PackageWindow,
  trustedUrl: string,
  getWorkspace: () => ProjectLibraryHandle | null,
  exportPackage: (workspace: ProjectLibraryHandle, projectId: string) => Promise<PackageResult | null>,
) => async (event: PackageRequest, input: unknown): Promise<PackageResult | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  if (!isWorkspaceId(value.workspaceId) || !isWorkspaceId(value.projectId)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.library.libraryId !== value.workspaceId) return null;
  return exportPackage(workspace, value.projectId);
};

export const importProjectPackageHandler = (
  window: PackageWindow,
  trustedUrl: string,
  getWorkspace: () => ProjectLibraryHandle | null,
  importPackage: (workspace: ProjectLibraryHandle) => Promise<ImportResult | null>,
) => async (event: PackageRequest, input: unknown): Promise<ImportResult | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || typeof input !== 'object' || input === null) return null;
  const value = input as Record<string, unknown>;
  if (!isWorkspaceId(value.workspaceId)) return null;
  const workspace = getWorkspace();
  if (!workspace || workspace.library.libraryId !== value.workspaceId || workspace.library.openMode !== 'writable') return null;
  return importPackage(workspace);
};
