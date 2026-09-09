import { expect, test } from 'playwright/test';

test.describe('offline welcome shell', () => {
  for (const viewport of [{ width: 1024, height: 720 }, { width: 1280, height: 800 }]) {
    test(`renders at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.getByRole('button', { name: '新建工作区' })).toBeEnabled();
      await expect(page.getByRole('button', { name: '打开工作区' })).toBeEnabled();
      await page.getByRole('button', { name: 'Switch to English' }).click();
      await expect(page.getByRole('button', { name: 'New workspace' })).toBeEnabled();
    });
  }
});
