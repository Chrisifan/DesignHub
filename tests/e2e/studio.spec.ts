import { expect, test } from 'playwright/test';

for (const width of [1280, 1024]) {
  for (const theme of ['dark', 'light']) {
    for (const locale of ['zh-CN', 'en']) {
      test(`workspace navigation at ${width}px / ${theme} / ${locale}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({
          width,
          height: width === 1280 ? 800 : 720,
        });
        await page.addInitScript(
          ({ mode, language }) => {
            localStorage.setItem('designhub.ui.theme', mode);
            localStorage.setItem('designhub.ui.locale', language);
          },
          { mode: theme, language: locale },
        );
        await page.goto('/?preview=1');
        const english = locale === 'en';
        await expect(
          page.getByRole('heading', {
            name: english ? 'Projects' : '项目库',
            exact: true,
          }),
        ).toBeVisible();
        await page
          .getByRole('button', {
            name: english ? 'Spring in bloom' : '春间市集',
            exact: true,
          })
          .click();
        await page
          .getByRole('button', {
            name: english ? 'Open main poster' : '打开主海报',
            exact: true,
          })
          .click();
        await expect(
          page.getByRole('region', {
            name: english ? 'Design canvas' : '设计画布',
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', {
            name: english ? 'Back to project' : '返回项目',
            exact: true,
          }),
        ).toBeInViewport();
        await expect(
          page.getByRole('button', {
            name: english ? 'Zoom in' : '放大',
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', {
            name: english ? 'Grid' : '网格',
            exact: true,
          }),
        ).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflow).toBe(false);
        await page.screenshot({
          path: testInfo.outputPath('workbench.png'),
          fullPage: true,
        });
        await page
          .getByRole('button', {
            name: english ? 'Back to project' : '返回项目',
            exact: true,
          })
          .click();
        const nav = page.getByRole('navigation', {
          name: english ? 'Main navigation' : '主导航',
        });
        for (const name of english
          ? [
              'Designers',
              'Assets',
              'Brand kits',
              'Connections',
              'Model tasks',
              'Delivery',
              'Workspace',
              'Settings',
            ]
          : [
              '设计师',
              '素材库',
              '品牌包',
              '模型连接',
              '模型任务',
              '导出交付',
              '工作区管理',
              '设置',
            ]) {
          await nav.getByRole('button', { name, exact: true }).click();
          await expect(
            page.locator('.destination:not([hidden]) h1'),
          ).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth > window.innerWidth,
            ),
          ).toBe(false);
        }
      });
    }
  }
}

test('native dialog restores focus and retains a cancelled draft', async ({
  page,
}) => {
  await page.goto('/?preview=1');
  const trigger = page
    .getByRole('button', { name: '新建项目', exact: true })
    .first();
  await trigger.click();
  await expect(page.getByRole('textbox', { name: '项目名称' })).toBeFocused();
  await page
    .getByRole('textbox', { name: '项目名称' })
    .fill('秋日漫游 / An unexpectedly long campaign title');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByRole('textbox', { name: '项目名称' })).toHaveValue(
    '秋日漫游 / An unexpectedly long campaign title',
  );
  await page.getByRole('button', { name: '创建预览', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: '秋日漫游 / An unexpectedly long campaign title',
    }),
  ).toBeVisible();
  await expect(page.getByText('预览草稿', { exact: true })).toBeVisible();
});

test('preferences survive reload and empty search can be cleared', async ({
  page,
}) => {
  await page.goto('/?preview=1');
  await page
    .getByRole('searchbox', { name: '搜索项目' })
    .fill('does-not-exist');
  await expect(page.getByText('没有匹配的项目')).toBeVisible();
  await page.getByRole('button', { name: '清除搜索' }).click();
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await page.getByRole('button', { name: 'Switch theme' }).click();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Projects', exact: true }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
