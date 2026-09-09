import type { BrowserWindowConstructorOptions } from 'electron';

export const createWindowOptions = (platform: string): BrowserWindowConstructorOptions => ({
  width: 1280,
  height: 800,
  minWidth: 1024,
  minHeight: 720,
  titleBarStyle: platform === 'darwin' ? 'hiddenInset' : 'hidden',
  titleBarOverlay: platform === 'win32',
  vibrancy: platform === 'darwin' ? 'sidebar' : undefined,
  backgroundMaterial: platform === 'win32' ? 'mica' : undefined,
  backgroundColor: '#0f131c',
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    preload: ''
  }
});
