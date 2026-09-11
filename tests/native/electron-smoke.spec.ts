import { _electron, expect, test } from 'playwright/test';

test('launches the workspace shell with only the DesignHub bridge', async () => {
  const electronApp = await _electron.launch({ args: ['.'] });

  try {
    const window = await electronApp.firstWindow();
    await expect(
      window.getByRole('heading', { name: '项目库', exact: true }),
    ).toBeVisible();
    const bridgeNames = await window.evaluate(
      () => Object.keys((globalThis as unknown as { designhub: object }).designhub),
    );
    expect(bridgeNames).toEqual(['chooseWorkspaceDirectory']);
  } finally {
    await electronApp.close();
  }
});
