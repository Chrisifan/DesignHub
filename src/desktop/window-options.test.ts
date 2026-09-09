import { expect, it } from 'vitest';

import { createWindowOptions } from './window-options';

it('keeps all renderer security flags enabled and uses a non-transparent window', () => {
  const options = createWindowOptions('darwin');

  expect(options.transparent).not.toBe(true);
  expect(options.webPreferences).toMatchObject({ nodeIntegration: false, contextIsolation: true, sandbox: true });
  expect(options.titleBarStyle).toBe('hiddenInset');
});

it('requests native platform material while retaining a solid background fallback', () => {
  const windowsOptions = createWindowOptions('win32');

  expect(windowsOptions.backgroundMaterial).toBe('mica');
  expect(windowsOptions.backgroundColor).toBe('#0f131c');
  expect(windowsOptions.titleBarOverlay).toBe(true);
});
