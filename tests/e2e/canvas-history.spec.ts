import { expect, test } from 'playwright/test';
import { gotoTestWorkspace } from './test-workspace';

test('canvas history entry point remains available without changing the saved example', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoTestWorkspace(page);
  await page.getByRole('button', { name: /春间市集|Spring in bloom/ }).click();
  await page.getByRole('button', { name: '打开主海报', exact: true }).click();

  const canvas = page.getByRole('region', { name: '设计画布', exact: true });
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('button', { name: '返回项目', exact: true })).toBeVisible();
  await expect(canvas.locator('.workbench-canvas__stage')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
