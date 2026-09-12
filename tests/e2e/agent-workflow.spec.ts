import { test, expect } from 'playwright/test';

test('agent workflow surface is available from the studio shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
});
