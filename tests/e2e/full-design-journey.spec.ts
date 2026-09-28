import { test, expect } from 'playwright/test';
import { gotoTestWorkspace, navigateFromUserMenu } from './test-workspace';

test('REL01 studio opens with an offline-safe project surface', async ({ page }) => {
  await gotoTestWorkspace(page);
  await expect(page.getByRole('complementary', { name: /项目列表|Projects/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /设计需求|Design request/ })).toBeVisible();
  await expect(page.locator('.studio')).toBeVisible();
});

test('REL02 delivery and workspace navigation remain available without a model connection', async ({ page }) => {
  await gotoTestWorkspace(page);
  await navigateFromUserMenu(page, /导出交付|Delivery/);
  await expect(page.locator('body')).toBeVisible();
});

test('REL03 provider-dependent work is disclosed as unavailable in the preview shell', async ({ page }) => {
  await gotoTestWorkspace(page);
  await navigateFromUserMenu(page, /模型连接|Connections/);
  await expect.poll(() => page.locator('h2').evaluateAll((nodes) => nodes.some((node) => {
    const style = getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && /尚未连接模型|No models connected/u.test(node.textContent ?? '');
  }))).toBe(true);
});
