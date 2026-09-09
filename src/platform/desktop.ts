import type { DesktopApi } from './contracts';

const unavailableDesktopApi: DesktopApi = {
  chooseWorkspaceDirectory: async () => null
};

export const getDesktopApi = (): DesktopApi => {
  if (typeof window === 'undefined') return unavailableDesktopApi;
  return window.designhub ?? unavailableDesktopApi;
};
