import { _electron, expect, test } from 'playwright/test';

test('launches the offline shell with only the DesignHub bridge', async () => {
  const electronApp = await _electron.launch({ args: ['.'] });

  try {
    const window = await electronApp.firstWindow();
    await expect(window.getByRole('button', { name: '新建工作区' })).toBeEnabled();
    await expect(window.getByRole('button', { name: '打开工作区' })).toBeEnabled();
    const bridgeNames = await window.evaluate(() => Object.keys((globalThis as unknown as { designhub: object }).designhub));
    expect(bridgeNames).toEqual(['chooseWorkspaceDirectory']);
  } finally {
    await electronApp.close();
  }
});
