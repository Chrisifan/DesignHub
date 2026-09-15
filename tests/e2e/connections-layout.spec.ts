import { expect, test } from 'playwright/test';
import { gotoTestWorkspace } from './test-workspace';

test('model connection setup remains inside its panel without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1962, height: 1000 });
  await gotoTestWorkspace(page);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '模型连接', exact: true }).click();
  await page.getByRole('button', { name: '图片生成与编辑', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '连接配置' })).toBeVisible();
  await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLElement>('.connection-layout'))
    .some((element) => element.getBoundingClientRect().width > 0));
  await page.screenshot({ path: testInfo.outputPath('connections.png'), fullPage: true });

  const bounds = await page.evaluate(() => {
    const visibleBounds = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector))
      .map((element) => element.getBoundingClientRect())
      .find((bounds) => bounds.width > 0 && bounds.height > 0);
    const drawer = visibleBounds('.ui-drawer');
    const settings = visibleBounds('[aria-labelledby="provider-settings-title"]');
    const connection = visibleBounds('[aria-label="连接"]');
    const heading = document.querySelector<HTMLElement>('#provider-settings-title');
    return {
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      drawerRight: drawer?.right,
      settingsLeft: settings?.left,
      settingsRight: settings?.right,
      connectionRight: connection?.right,
      headingFontSize: heading ? getComputedStyle(heading).fontSize : undefined,
    };
  });

  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.viewportWidth);
  expect(bounds.settingsLeft).toBeGreaterThanOrEqual(0);
  expect(bounds.settingsRight).toBeLessThanOrEqual(bounds.drawerRight ?? 0);
  expect(bounds.connectionRight).toBeLessThanOrEqual(bounds.drawerRight ?? 0);
  expect(bounds.headingFontSize).toBe('16px');
});
