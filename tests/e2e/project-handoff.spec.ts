import { test, expect } from 'playwright/test';
import { gotoTestWorkspace } from './test-workspace';

test('project handoff shell renders', async ({ page }) => {
  await gotoTestWorkspace(page);
  await expect(page.locator('body')).toBeVisible();
});

test('project package import exposes failure recovery through the bridge', async ({ page }) => {
  await gotoTestWorkspace(page, null, { failProjectPackageImportOnce: true });

  const openImport = async (): Promise<void> => {
    await page.getByRole('button', { name: '打开用户菜单', exact: true }).click();
    await page.getByRole('menuitem', { name: '导入项目包', exact: true }).click();
  };

  await openImport();
  await expect(page.getByRole('status')).toContainText('项目包导入失败');

  await openImport();
  await expect(page.getByRole('status')).toContainText('项目包已导入');
  await expect(page.getByRole('button', { name: '导入项目', exact: true })).toBeVisible();
});
