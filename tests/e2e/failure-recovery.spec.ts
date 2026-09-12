import { test, expect } from 'playwright/test';

test('failure recovery keeps the application shell usable', async ({ page }) => {
  await page.goto('/?preview=1');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', await page.evaluate(() => window.innerWidth));
});
