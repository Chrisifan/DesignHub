import { expect, test } from 'playwright/test';

test.describe('first-launch shell', () => {
  for (const viewport of [{ width: 1024, height: 720 }, { width: 1280, height: 800 }]) {
    test(`renders at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: '设置你的资料' })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: '选择存储文件夹' })).toBeEnabled();
      await expect(page.getByRole('button', { name: '浏览示例' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Switch to English' }).click();
      await expect(page.getByRole('heading', { name: 'Set up your profile' })).toBeVisible();
    });
  }

  test('legacy preview URLs do not restore seeded content or workspace controls', async ({ page }) => {
    await page.goto('/?preview=1');
    await expect(page.getByRole('heading', { name: '设置你的资料' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('纸感排版')).toHaveCount(0);
    await expect(page.getByText('清晰商业')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '新建工作区' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '打开工作区' })).toHaveCount(0);
  });
});
