import { test, expect } from 'playwright/test';

test('project handoff shell renders', async ({ page }) => {
  await page.goto('/?preview=1');
  await expect(page.locator('body')).toBeVisible();
});
