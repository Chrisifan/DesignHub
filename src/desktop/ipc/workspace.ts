type ProjectLibrarySender = {
  mainFrame: { url: string };
  getURL: () => string;
};

type ProjectLibraryRequest = {
  sender: ProjectLibrarySender;
  senderFrame: { url: string } | null;
};

type ProjectLibraryWindow = {
  webContents: ProjectLibrarySender;
};

const hasSameCanonicalRendererLocation = (candidateUrl: string, trustedUrl: string): boolean => {
  try {
    const candidate = new URL(candidateUrl);
    const trusted = new URL(trustedUrl);
    if (trusted.protocol === 'file:') return candidate.protocol === 'file:' && candidate.href === trusted.href;
    if (trusted.protocol !== 'http:' && trusted.protocol !== 'https:') return false;
    return candidate.protocol === trusted.protocol
      && candidate.host === trusted.host
      && candidate.pathname === trusted.pathname
      && candidate.search === trusted.search
      && candidate.hash === trusted.hash;
  } catch {
    return false;
  }
};

export const isTrustedProjectLibraryRequest = (event: ProjectLibraryRequest, window: ProjectLibraryWindow, trustedUrl: string): boolean => {
  const frame = event.senderFrame;
  if (event.sender !== window.webContents || frame !== window.webContents.mainFrame || frame === null) return false;
  return hasSameCanonicalRendererLocation(frame.url, trustedUrl);
};
