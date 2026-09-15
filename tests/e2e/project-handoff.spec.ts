import { test, expect } from 'playwright/test';
import { gotoTestWorkspace } from './test-workspace';

test('project handoff shell renders', async ({ page }) => {
  await gotoTestWorkspace(page);
  await expect(page.locator('body')).toBeVisible();
});
