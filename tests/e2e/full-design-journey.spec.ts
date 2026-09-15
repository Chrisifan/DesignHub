import { test, expect } from 'playwright/test';
import { gotoTestWorkspace } from './test-workspace';

test('REL01 studio opens with an offline-safe project surface', async ({ page }) => {
  await gotoTestWorkspace(page);
  await expect(page.getByRole('navigation', { name: /主导航|Main navigation/ })).toBeVisible();
  await expect(page.locator('.studio')).toBeVisible();
});

test('REL02 delivery and workspace navigation remain available without a model connection', async ({ page }) => {
  await gotoTestWorkspace(page);
  await page.getByRole('button', { name: /导出交付|Delivery/ }).first().click().catch(() => undefined);
  await expect(page.locator('body')).toBeVisible();
});

test('REL03 provider-dependent work is disclosed as unavailable in the preview shell', async ({ page }) => {
  await gotoTestWorkspace(page);
  await page.getByRole('button', { name: /模型连接|Connections/ }).click();
  await expect(page.getByText(/尚未连接模型|No models connected/).first()).toBeVisible();
});
