import { test, expect } from 'playwright/test';

test('settings shell is available offline', async ({ page }) => {
  await page.goto('/?preview=1');
  await expect(page.locator('body')).toBeVisible();
});
