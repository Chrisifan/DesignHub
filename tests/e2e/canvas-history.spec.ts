import { expect, test } from 'playwright/test';
import { gotoTestWorkspace } from './test-workspace';

test('project canvas entry point exposes project actions without legacy document controls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoTestWorkspace(page);
  await page.getByRole('button', { name: /春间市集|Spring in bloom/ }).click();

  const canvas = page.getByRole('region', { name: '设计画布', exact: true });
  await expect(canvas).toBeVisible();
  await expect(canvas.getByRole('button', { name: '项目操作', exact: true })).toBeVisible();
  await expect(canvas.locator('.project-canvas-stage canvas')).toBeVisible();
  await expect(canvas.locator('.workbench-ruler--horizontal, .canvas-layer-float, .canvas-inspector-float')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
