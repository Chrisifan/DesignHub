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
        const windowBar = page.locator('.window-bar');
        await expect(
          windowBar.getByRole('button', {
            name: english ? 'Switch workspace' : '切换工作区',
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          windowBar.getByRole('button', {
            name: english ? 'Switch theme' : '切换主题',
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          windowBar.getByRole('button', {
            name: english ? '切换中文' : 'Switch to English',
            exact: true,
          }),
        ).toBeVisible();
        await expect(windowBar.locator('.window-workspace-name')).toHaveCSS(
          'height',
          '17px',
        );
        await expect(page.locator('.studio-sidebar .sidebar-create')).toHaveCount(0);
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

for (const [theme, expectedTint] of [
  ['dark', 'rgba(20, 28, 46, 0.84)'],
  ['light', 'rgba(255, 255, 255, 0.86)'],
] as const) {
  test(`desktop ${theme} shell uses the approved dimensions and glass material`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript((mode) => {
      localStorage.setItem('designhub.ui.theme', mode);
    }, theme);
    await page.goto('/?preview=1');
    await expect(
      page.getByRole('heading', { name: '项目库', exact: true }),
    ).toBeVisible();
    const shell = await page.evaluate(() => {
      const inspect = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector)!;
        const style = getComputedStyle(element);
        return {
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
          backdropFilter: style.backdropFilter,
          backgroundImage: style.backgroundImage,
        };
      };
      return {
        sidebar: inspect('.studio-sidebar'),
        windowBar: inspect('.window-bar'),
        toolbar: inspect('.studio-toolbar'),
        backdrop: getComputedStyle(
          document.querySelector<HTMLElement>('.app-shell')!,
          '::before',
        ).backgroundImage,
      };
    });

    expect(shell.sidebar.width).toBe(280);
    expect(shell.windowBar.height).toBe(40);
    expect(shell.toolbar.height).toBe(44);
    for (const surface of [shell.sidebar, shell.windowBar, shell.toolbar]) {
      expect(surface.backdropFilter).toContain('blur(');
      expect(surface.backgroundImage).toContain(expectedTint);
    }
    expect(shell.backdrop).toContain('repeating-linear-gradient');

    await page.getByRole('button', { name: '春间市集', exact: true }).click();
    await page.getByRole('button', { name: '打开主海报', exact: true }).click();
    await expect(page.locator('.studio-sidebar')).toHaveCSS('width', '280px');
  });
}

test('reduced-transparency shell uses solid surfaces without blur', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  });
  await page.addInitScript(() => {
    localStorage.setItem('designhub.ui.theme', 'dark');
  });
  await page.goto('/?preview=1');

  const shell = await page.evaluate(() => {
    const inspect = (selector: string) => {
      const style = getComputedStyle(
        document.querySelector<HTMLElement>(selector)!,
      );
      return {
        backdropFilter: style.backdropFilter,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
      };
    };
    return {
      matchesReducedTransparency: matchMedia(
        '(prefers-reduced-transparency: reduce)',
      ).matches,
      surfaces: [
        inspect('.window-bar'),
        inspect('.studio-sidebar'),
        inspect('.studio-toolbar'),
      ],
    };
  });

  expect(shell.matchesReducedTransparency).toBe(true);
  for (const surface of shell.surfaces) {
    expect(surface.backdropFilter).toBe('none');
    expect(surface.backgroundImage).toBe('none');
    expect(surface.backgroundColor).toBe('rgb(14, 20, 36)');
  }
});

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
