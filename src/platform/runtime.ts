import type { DesktopApi } from './contracts';

const unavailableDesktopApi: DesktopApi = {
  chooseWorkspaceDirectory: async () => null,
  createWorkspace: async () => null,
  openWorkspace: async () => null,
  listActiveProjects: async () => null,
  createProjectContainer: async () => null,
  getProjectMetadata: async () => null,
  updateProjectMetadata: async () => null,
  loadDesignerState: async () => null,
  saveDesignerState: async () => false,
  storeCredential: async () => false,
  deleteCredential: async () => false,
};

export const getDesktopApi = (): DesktopApi => {
  if (typeof window === 'undefined') return unavailableDesktopApi;
  return window.designhub ?? unavailableDesktopApi;
};
