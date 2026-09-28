import { expect, test } from 'playwright/test';
import { gotoTestWorkspace, navigateFromUserMenu } from './test-workspace';

test('model connection setup remains inside its panel without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1962, height: 1000 });
  await gotoTestWorkspace(page);
  await navigateFromUserMenu(page, '模型连接');
  await page.getByRole('button', { name: '图片生成与编辑', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '连接配置' });
  const settings = drawer.locator('.provider-settings');
  const profile = drawer.getByRole('region', { name: '图片生成与编辑' });
  await expect(drawer).toBeVisible();
  await expect(settings).toBeVisible();
  await expect(profile).toBeVisible();
  await expect(settings).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('connections.png'), fullPage: true });

  const drawerBounds = await drawer.boundingBox();
  const settingsBounds = await settings.boundingBox();
  const profileBounds = await profile.boundingBox();
  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const drawerOverflow = await drawer.locator('.ui-drawer__content').evaluate((content) => content.scrollWidth - content.clientWidth);
  const headingFontSize = await drawer.getByRole('heading', { name: '连接配置' })
    .evaluate((heading) => getComputedStyle(heading).fontSize);

  expect(drawerBounds).not.toBeNull();
  expect(settingsBounds).not.toBeNull();
  expect(profileBounds).not.toBeNull();
  expect(pageOverflow).toBeLessThanOrEqual(0);
  expect(drawerOverflow).toBeLessThanOrEqual(0);
  expect(settingsBounds!.x).toBeGreaterThanOrEqual(drawerBounds!.x);
  expect(settingsBounds!.x + settingsBounds!.width).toBeLessThanOrEqual(drawerBounds!.x + drawerBounds!.width);
  expect(profileBounds!.x).toBeGreaterThanOrEqual(drawerBounds!.x);
  expect(profileBounds!.x + profileBounds!.width).toBeLessThanOrEqual(drawerBounds!.x + drawerBounds!.width);
  expect(headingFontSize).toBe('16px');
});
