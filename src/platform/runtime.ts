import type { DesktopApi } from './contracts';

const unavailableDesktopApi: DesktopApi = {
  chooseWorkspaceDirectory: async () => null,
  createWorkspace: async () => null,
  openWorkspace: async () => null,
  listActiveProjects: async () => null,
  createProjectContainer: async () => null,
  duplicateProject: async () => null,
  getProjectMetadata: async () => null,
  updateProjectMetadata: async () => null,
  listTrashedProjects: async () => null,
  moveProjectToTrash: async () => null,
  restoreProjectFromTrash: async () => null,
  purgeProjectFromTrash: async () => null,
  createWorkspaceBackup: async () => null,
  restoreWorkspaceBackup: async () => null,
  exportProjectPackage: async () => null,
  loadDesignerState: async () => null,
  saveDesignerState: async () => false,
  listAssets: async () => null,
  importAssets: async () => null,
  readAsset: async () => null,
  loadDocumentScene: async () => null,
  saveDocumentScene: async () => false,
  storeCredential: async () => false,
  deleteCredential: async () => false,
  listTasks: async () => null,
  submitConversation: async () => null,
  cancelTask: async () => false,
  retryTask: async () => null,
  exportDocument: async () => null,
  exportDiagnostics: async () => null,
};

export const getDesktopApi = (): DesktopApi => {
  if (typeof window === 'undefined') return unavailableDesktopApi;
  return window.designhub ?? unavailableDesktopApi;
};
