export const recreateWindowOnActivate = (hasOpenWindow: () => boolean, createWindow: () => void): void => {
  if (!hasOpenWindow()) createWindow();
};
