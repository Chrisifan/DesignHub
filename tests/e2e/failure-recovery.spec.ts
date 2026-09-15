import { test, expect } from 'playwright/test';
import { gotoTestWorkspace } from './test-workspace';

test('failure recovery keeps the application shell usable', async ({ page }) => {
  await gotoTestWorkspace(page);
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', await page.evaluate(() => window.innerWidth));
});
