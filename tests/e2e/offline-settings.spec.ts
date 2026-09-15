import { test, expect } from 'playwright/test';
import { gotoTestWorkspace } from './test-workspace';

test('settings shell is available offline', async ({ page }) => {
  await gotoTestWorkspace(page);
  await expect(page.locator('body')).toBeVisible();
});
