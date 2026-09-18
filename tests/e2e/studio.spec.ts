import { expect, test } from 'playwright/test';
import { gotoTestWorkspace } from './test-workspace';

test('long floating layers remain scrollable within a compact canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 720 });
  await gotoTestWorkspace(page, {
    version: 1, id: 'many-layers', width: 1080, height: 1440,
    layers: Array.from({ length: 30 }, (_, index) => ({
      id: `layer-${index}`, type: 'text' as const, text: `Layer ${index}`, fontFamily: 'sans-serif', fontSize: 24, fontWeight: 'normal', align: 'left' as const, color: '#24262b', x: 100, y: 100 + index * 30, width: 800, height: 30, rotation: 0, opacity: 1, visible: true, locked: false,
    })),
  });
  await page.getByRole('button', { name: '春间市集', exact: true }).click();
  await page.getByRole('button', { name: '打开主海报', exact: true }).click();
  await page.getByRole('button', { name: '图层', exact: true }).click();
  const canvas = page.getByRole('region', { name: '设计画布', exact: true });
  const panel = canvas.locator('.canvas-layer-float');
  const [canvasBox, panelBox] = await Promise.all([canvas.boundingBox(), panel.boundingBox()]);
  expect(Boolean(canvasBox && panelBox && panelBox.y + panelBox.height <= canvasBox.y + canvasBox.height)).toBe(true);
  await panel.getByRole('button', { name: 'Layer 0', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '文字内容', exact: true })).toHaveValue('Layer 0');
});

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
        await gotoTestWorkspace(page, {
          version: 1, id: 'layout-scene', width: 1080, height: 1440,
          layers: [
            { id: 'layout-shape', type: 'shape', kind: 'rect', fill: '#b8ddd0', stroke: '#b8ddd0', strokeWidth: 0, x: 100, y: 420, width: 880, height: 720, rotation: 0, opacity: 1, visible: true, locked: false },
            { id: 'layout-title', type: 'text', text: 'Spring Market', fontFamily: 'sans-serif', fontSize: 76, fontWeight: 'bold', align: 'left', color: '#24262b', x: 100, y: 180, width: 880, height: 120, rotation: 0, opacity: 1, visible: true, locked: false },
          ],
        });
        const english = locale === 'en';
        await expect(
          page.getByRole('heading', {
            name: english ? 'Projects' : '项目库',
            exact: true,
          }),
        ).toBeAttached();
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
            name: /Spring in bloom|春间市集/,
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
        const canvas = page.getByRole('region', {
          name: english ? 'Design canvas' : '设计画布',
          exact: true,
        });
        await expect(canvas.locator('.workbench-ruler--horizontal')).toBeVisible();
        await expect(canvas.locator('.workbench-ruler--vertical')).toBeVisible();
        await expect(page.getByRole('toolbar', { name: english ? 'Canvas tools' : '画布工具' })).toBeVisible();
        await expect(page.getByRole('toolbar', { name: english ? 'Context tools' : '上下文工具' })).toBeVisible();
        await expect(page.getByRole('form', { name: english ? 'AI command dock' : 'AI 操作坞' })).toBeVisible();
        await expect(canvas.locator('.workbench-command-dock')).toHaveCSS('position', 'absolute');
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
        await page.getByRole('button', { name: english ? 'Layers' : '图层', exact: true }).click();
        const layersPanel = page.getByRole('complementary', { name: english ? 'Layers' : '图层', exact: true });
        await expect(layersPanel).toBeVisible();
        await layersPanel.getByRole('button', { name: 'Spring Market', exact: true }).click();
        const inspector = page.getByRole('complementary', { name: english ? 'Inspector' : '检查器', exact: true });
        await expect(inspector).toBeVisible();
        await expect(inspector.getByRole('textbox', { name: english ? 'Text content' : '文字内容', exact: true })).toHaveValue('Spring Market');
        const [stageBox, inspectorBox] = await Promise.all([canvas.boundingBox(), canvas.locator('.canvas-inspector-float').boundingBox()]);
        expect(Boolean(stageBox && inspectorBox
          && inspectorBox.x >= stageBox.x
          && inspectorBox.x + inspectorBox.width <= stageBox.x + stageBox.width
          && inspectorBox.y >= stageBox.y
          && inspectorBox.y + inspectorBox.height <= stageBox.y + stageBox.height)).toBe(true);
        expect(await canvas.locator('canvas').evaluate((element: HTMLCanvasElement) => {
          const context = element.getContext('2d');
          if (!context) return false;
          const pixels = context.getImageData(0, 0, element.width, element.height).data;
          return pixels.some((value, index) => index % 4 === 3 && value > 0);
        })).toBe(true);
        await page.getByRole('button', { name: english ? 'Conversation' : '对话', exact: true }).click();
        await expect(page.getByRole('textbox', { name: english ? 'Edit request' : '修改说明' })).toBeFocused();
        const [canvasBox, layersBox] = await Promise.all([canvas.boundingBox(), layersPanel.boundingBox()]);
        const overlaysInsideCanvas = Boolean(canvasBox && layersBox
          && layersBox.x >= canvasBox.x
          && layersBox.x + layersBox.width <= canvasBox.x + canvasBox.width
          && layersBox.y >= canvasBox.y
          && layersBox.y + layersBox.height <= canvasBox.y + canvasBox.height);
        expect(overlaysInsideCanvas).toBe(true);
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
            ]
          : [
              '设计师',
              '素材库',
              '品牌包',
              '模型连接',
              '模型任务',
              '导出交付',
              '工作区管理',
            ]) {
          await nav.getByRole('button', { name, exact: true }).click();
          await expect(
            page.locator('.destination:not([hidden]) h1'),
          ).toBeAttached();
          const drawer = page.getByRole('dialog');
          if (await drawer.isVisible().catch(() => false)) {
            await drawer.getByRole('button', {
              name: english ? 'Close' : '关闭',
              exact: true,
            }).click();
          }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth > window.innerWidth,
            ),
          ).toBe(false);
          if (name === (english ? 'Designers' : '设计师')) {
            expect(
              await page.evaluate(
                () =>
                  document.documentElement.scrollHeight <= window.innerHeight &&
                  document.body.scrollHeight <= window.innerHeight,
              ),
            ).toBe(true);
          }
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
    await gotoTestWorkspace(page);
    await expect(
      page.getByRole('heading', { name: '项目库', exact: true }),
    ).toBeAttached();
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
      // Headless Chromium may expose reduced-transparency as the default; native
      // hosts still verify the blur path separately.
      expect(surface.backdropFilter === 'none' || surface.backdropFilter.includes('blur(')).toBe(true);
      expect(surface.backgroundImage).toContain(expectedTint);
    }
    expect(shell.backdrop).toContain('repeating-linear-gradient');

    await page.getByRole('button', { name: /春间市集|Spring in bloom/ }).click();
    await page.getByRole('button', { name: '打开主海报', exact: true }).click();
    await expect(page.locator('.studio-sidebar')).toHaveCSS('width', '64px');
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
  await gotoTestWorkspace(page);

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

test('persona-led creation keeps the selected designer across pages', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoTestWorkspace(page);
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await navigation.getByRole('button', { name: '设计师', exact: true }).click();
  await expect(page.getByRole('heading', { name: '设计师', exact: true })).toBeAttached();
  await page.getByRole('button', { name: /清晰商业/ }).click();
  const inspector = page.getByRole('dialog', { name: '设计师检查器' });
  const dossier = inspector.getByRole('region', { name: '清晰商业设计师档案' });
  await expect(dossier).toContainText('清晰商业');
  await expect(dossier.getByRole('region', { name: '核心指标' })).toBeVisible();
  await expect(dossier.getByRole('region', { name: 'Style DNA' })).toBeAttached();
  await expect(dossier.getByRole('region', { name: '否定规则' })).toBeAttached();
  await expect(inspector.getByRole('region', { name: '精选作品' })).toContainText('春生特刊');
  await expect(inspector.getByText('项目引用')).toHaveCount(0);
  const assertInspectorLayout = async () => {
    const drawerBox = await inspector.boundingBox();
    const hostBox = await page.locator('[data-drawer-host]').boundingBox();
    const footerBox = await inspector.locator('.ui-drawer__footer').boundingBox();
    expect(drawerBox).not.toBeNull();
    expect(hostBox).not.toBeNull();
    expect(footerBox).not.toBeNull();
    expect(Math.abs(drawerBox!.width - Math.min(520, page.viewportSize()!.width * 0.92, hostBox!.width))).toBeLessThanOrEqual(1);
    await expect.poll(async () => {
      const settledDrawer = await inspector.boundingBox();
      const settledHost = await page.locator('[data-drawer-host]').boundingBox();
      return settledDrawer!.x + settledDrawer!.width - (settledHost!.x + settledHost!.width);
    }).toBeLessThanOrEqual(1);
    const settledDrawer = await inspector.boundingBox();
    expect(settledDrawer!.x).toBeGreaterThanOrEqual(hostBox!.x);
    expect(Math.abs(footerBox!.y + footerBox!.height - (drawerBox!.y + drawerBox!.height))).toBeLessThanOrEqual(1);
    const overflow = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { className: element.className, left: rect.left, right: rect.right, width: rect.width, display: style.display, visibility: style.visibility };
      })
      .filter((entry) => entry.right > window.innerWidth + 1
        && entry.left < window.innerWidth
        && entry.width > 0
        && entry.display !== 'none'
        && entry.visibility !== 'hidden'));
    expect(overflow).toEqual([]);
  };
  await assertInspectorLayout();
  await page.screenshot({ path: testInfo.outputPath('designer-inspector.png'), fullPage: true });
  await inspector.locator('.ui-drawer__content').evaluate((content) => { content.scrollTop = content.scrollHeight; });
  await expect(inspector.getByRole('region', { name: '精选作品' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('designer-inspector-bottom.png'), fullPage: true });
  await inspector.locator('.ui-drawer__content').evaluate((content) => { content.scrollTop = 0; });

  await page.setViewportSize({ width: 1024, height: 720 });
  await assertInspectorLayout();
  await expect(inspector.getByRole('button', { name: '用于新建', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('designer-inspector-narrow.png'), fullPage: true });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollHeight <= window.innerHeight &&
        document.body.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: '用于新建', exact: true }).click();
  await expect(page.getByRole('heading', { name: '新建设计', exact: true })).toBeAttached();
  await expect(page.getByLabel('新建设计的当前设计师')).toContainText('清晰商业');
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= window.innerWidth &&
        document.documentElement.scrollHeight <= window.innerHeight &&
        document.body.scrollWidth <= window.innerWidth &&
        document.body.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
});

test('designer rules stay on one line with app tooltips in the inspector and editor', async ({ page }, testInfo) => {
  const longRule = '避免使用会破坏安全边距、信息层级与主体识别度的霓虹渐变、高强度装饰效果以及复杂背景纹理';
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoTestWorkspace(page);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '设计师', exact: true }).click();
  await page.getByRole('button', { name: /纸感排版/ }).click();

  const inspector = page.getByRole('dialog', { name: '设计师检查器' });
  const inspectorRule = inspector.locator('.designer-profile-rule__text');
  await expect(inspectorRule).toHaveText(longRule);
  await expect(inspectorRule).not.toHaveAttribute('title');
  await expect(inspectorRule).toHaveCSS('white-space', 'nowrap');
  await expect(inspectorRule).toHaveCSS('text-overflow', 'ellipsis');
  expect(await inspectorRule.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await inspectorRule.hover();
  await expect(page.getByRole('tooltip')).toHaveText(longRule);
  const inspectorTooltipBox = await page.getByRole('tooltip').boundingBox();
  expect(inspectorTooltipBox).not.toBeNull();
  expect(inspectorTooltipBox!.x).toBeGreaterThanOrEqual(0);
  expect(inspectorTooltipBox!.x + inspectorTooltipBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath('designer-inspector-rule-tooltip.png'), fullPage: true });

  await inspector.getByRole('button', { name: '编辑', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '编辑设计师' });
  const editorRule = editor.locator('.designer-draft-rule__text');
  await expect(editorRule).toHaveText(longRule);
  await expect(editorRule).not.toHaveAttribute('title');
  await expect(editorRule).toHaveCSS('white-space', 'nowrap');
  await expect(editorRule).toHaveCSS('text-overflow', 'ellipsis');
  expect(await editorRule.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await editorRule.hover();
  const editorTooltip = page.getByRole('tooltip');
  await expect(editorTooltip).toHaveText(longRule);
  await expect(editorTooltip).toBeVisible();
  expect(await editorTooltip.evaluate((element) => element.matches(':popover-open'))).toBe(true);
  const editorTooltipBox = await editorTooltip.boundingBox();
  expect(editorTooltipBox).not.toBeNull();
  expect(editorTooltipBox!.x).toBeGreaterThanOrEqual(0);
  expect(editorTooltipBox!.x + editorTooltipBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath('designer-editor-rule-tooltip.png'), fullPage: true });
});

test('designer dossier cards keep a stable responsive grid', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoTestWorkspace(page);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '设计师', exact: true }).click();

  const repository = page.getByLabel('设计师档案库');
  const cards = repository.locator('.designer-profile-card--library');
  await expect(cards).toHaveCount(2);
  const desktopColumns = await repository.locator('.persona-repository__list').evaluate(
    (grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length,
  );
  expect(desktopColumns).toBe(4);

  const firstCard = cards.first();
  await firstCard.locator('.designer-profile-card__identity strong').evaluate((element) => {
    element.textContent = '纸感排版与编辑网格系统设计师档案超长名称用于边界验证';
    element.setAttribute('title', element.textContent);
  });
  await firstCard.locator('.designer-profile-card__identity > span').evaluate((element) => {
    element.textContent = '一条非常长的设计师署名，不应突破档案卡片的可视边界';
    element.setAttribute('title', element.textContent);
  });
  const containment = await firstCard.evaluate((card) => {
    const bounds = card.getBoundingClientRect();
    const textNodes = [...card.querySelectorAll<HTMLElement>('.designer-profile-card__identity strong, .designer-profile-card__identity > span')];
    return {
      cardLeft: bounds.left,
      cardRight: bounds.right,
      textBounds: textNodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, title: node.title };
      }),
    };
  });
  expect(containment.textBounds.every((bounds) => bounds.left >= containment.cardLeft - 1 && bounds.right <= containment.cardRight + 1)).toBe(true);
  expect(containment.textBounds.every((bounds) => bounds.title.length > 0)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('designer-dossier-grid.png'), fullPage: true });

  await page.setViewportSize({ width: 680, height: 720 });
  const narrowColumns = await repository.locator('.persona-repository__list').evaluate(
    (grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length,
  );
  expect(narrowColumns).toBe(1);
  const narrowContainment = await repository.evaluate((element) => {
    const repositoryBounds = element.getBoundingClientRect();
    const cardBounds = [...element.querySelectorAll<HTMLElement>('.persona-repository-card-button')]
      .map((card) => card.getBoundingClientRect());
    return {
      noInternalOverflow: element.scrollWidth <= element.clientWidth,
      cardsContained: cardBounds.every((bounds) => bounds.left >= repositoryBounds.left - 1 && bounds.right <= repositoryBounds.right + 1),
    };
  });
  expect(narrowContainment).toEqual({ noInternalOverflow: true, cardsContained: true });
  await page.screenshot({ path: testInfo.outputPath('designer-dossier-grid-narrow.png'), fullPage: true });
});

test('new project uses the review designer dossier without a top divider', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoTestWorkspace(page);
  await page.getByRole('button', { name: '新建项目', exact: true }).first().click();

  const layout = page.locator('.new-design-layout');
  const dossier = page.getByLabel('新建设计的当前设计师');
  await expect(layout).toHaveCSS('border-top-width', '0px');
  await expect(dossier.locator('.designer-profile-card--review')).toBeVisible();
  await expect(dossier.getByRole('region', { name: '核心指标' })).toBeVisible();
  await expect(dossier.getByRole('region', { name: 'Style DNA' })).toBeVisible();
  await expect(dossier.getByRole('region', { name: '否定规则' })).toBeVisible();
  await expect(dossier).toHaveCSS('overflow-y', 'auto');
  expect(await dossier.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const pageContent = page.locator('.new-design-page');
  const pageScrollTop = await pageContent.evaluate((element) => element.scrollTop);
  await dossier.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  expect(await dossier.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await pageContent.evaluate((element) => element.scrollTop)).toBe(pageScrollTop);
  await dossier.evaluate((element) => { element.scrollTop = 0; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('new-project-designer-dossier.png'), fullPage: true });

  await page.setViewportSize({ width: 1024, height: 720 });
  await dossier.scrollIntoViewIfNeeded();
  expect(await layout.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('new-project-designer-dossier-narrow.png'), fullPage: true });
});

test('native dialog restores focus and retains a cancelled draft', async ({
  page,
}) => {
  await gotoTestWorkspace(page);
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
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: '秋日漫游 / An unexpectedly long campaign title',
    }),
  ).toBeAttached();
  await expect(page.getByText('进行中', { exact: true })).toBeVisible();
});

test('preferences survive reload and empty search can be cleared', async ({
  page,
}) => {
  await gotoTestWorkspace(page);
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
  ).toBeAttached();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
