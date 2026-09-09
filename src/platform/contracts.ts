export type DesktopApi = {
  chooseWorkspaceDirectory: () => Promise<string | null>;
};

declare global {
  interface Window {
    designhub: DesktopApi;
  }
}
