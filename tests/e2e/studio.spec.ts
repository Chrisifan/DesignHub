import { expect, test } from 'playwright/test';
import { gotoTestWorkspace, navigateFromUserMenu } from './test-workspace';

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
            name: english ? 'Creative library' : '创作中心',
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
        await expect(page.locator('.studio-sidebar')).toHaveCount(0);
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
        await expect(canvas.locator('.conversation-dock--compact')).toHaveCSS('position', 'absolute');
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
        const gridButton = page.getByRole('button', {
          name: english ? 'Grid' : '网格',
          exact: true,
        });
        await expect(gridButton).toBeVisible();
        await gridButton.hover();
        const gridTooltip = page.getByRole('tooltip');
        await expect(gridTooltip).toHaveText(english ? 'Grid' : '网格');
        const [gridButtonBox, gridTooltipBox] = await Promise.all([gridButton.boundingBox(), gridTooltip.boundingBox()]);
        expect(gridButtonBox).not.toBeNull();
        expect(gridTooltipBox).not.toBeNull();
        expect(gridTooltipBox!.y + gridTooltipBox!.height).toBeLessThanOrEqual(gridButtonBox!.y);
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
          await navigateFromUserMenu(page, name);
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

for (const theme of ['dark', 'light'] as const) {
  test(`desktop ${theme} shell uses the approved dimensions and glass material`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript((mode) => {
      localStorage.setItem('designhub.ui.theme', mode);
    }, theme);
    await gotoTestWorkspace(page);
    await expect(
      page.getByRole('heading', { name: '创作中心', exact: true }),
    ).toBeAttached();
    const shell = await page.evaluate(() => {
      const inspect = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector)!;
        const style = getComputedStyle(element);
        return {
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
          backdropFilter: style.backdropFilter,
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          borderBottomWidth: style.borderBottomWidth,
          boxShadow: style.boxShadow,
        };
      };
      return {
        windowBar: inspect('.window-bar'),
        projects: inspect('.studio-home-projects'),
        composer: inspect('.conversation-dock--expanded'),
        backdrop: getComputedStyle(
          document.querySelector<HTMLElement>('.app-shell')!,
          '::before',
        ).backgroundImage,
      };
    });

    expect(shell.windowBar.height).toBe(40);
    expect(shell.windowBar.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(shell.windowBar.borderBottomWidth).toBe('0px');
    expect(shell.projects.width).toBeGreaterThanOrEqual(260);
    for (const surface of [shell.projects, shell.composer]) {
      // Headless Chromium may expose reduced-transparency as the default; native
      // hosts still verify the blur path separately.
      expect(surface.backdropFilter === 'none' || surface.backdropFilter.includes('blur(')).toBe(true);
      expect(surface.backgroundImage !== 'none' || surface.backgroundColor !== 'rgba(0, 0, 0, 0)').toBe(true);
    }
    expect(shell.projects.boxShadow === 'none' || shell.projects.boxShadow.startsWith('rgba(255, 255, 255')).toBe(true);
    expect(shell.composer.boxShadow).not.toContain('14px 34px');
    await expect(page.locator('.studio-sidebar, .studio-toolbar')).toHaveCount(0);
    await expect(page.getByLabel('提示词建议')).toHaveCount(0);
    expect(shell.backdrop).toContain('radial-gradient');

    await page.getByRole('button', { name: /春间市集|Spring in bloom/ }).click();
    await page.getByRole('button', { name: '打开主海报', exact: true }).click();
    await expect(page.locator('.studio-sidebar')).toHaveCount(0);
    const dockStyle = await page.locator('.conversation-dock--compact').evaluate((element) => {
      const style = getComputedStyle(element);
      return { bottom: style.bottom, backdropFilter: style.backdropFilter };
    });
    expect(dockStyle.bottom).toBe('8px');
    expect(dockStyle.backdropFilter === 'none' || dockStyle.backdropFilter.includes('blur(')).toBe(true);
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
        inspect('.studio-home-projects'),
        inspect('.conversation-dock--expanded'),
      ],
    };
  });

  expect(shell.matchesReducedTransparency).toBe(true);
  for (const surface of shell.surfaces) {
    expect(surface.backdropFilter).toBe('none');
    expect(surface.backgroundImage).toBe('none');
    expect(surface.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  }
});

test('dot workspace follows the pointer without intercepting home controls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoTestWorkspace(page);

  const shell = page.locator('.app-shell');
  await page.mouse.move(820, 360);
  await expect(shell).toHaveAttribute('data-pointer-active', 'true');
  const coordinates = await shell.evaluate((element) => ({
    x: element.style.getPropertyValue('--pointer-x'),
    y: element.style.getPropertyValue('--pointer-y'),
  }));
  expect(parseFloat(coordinates.x)).toBeGreaterThan(700);
  expect(parseFloat(coordinates.y)).toBeGreaterThan(250);

  const textbox = page.getByRole('textbox', { name: '设计需求' });
  await textbox.click();
  await expect(textbox).toBeFocused();
});

test('reduced motion keeps static dots without pointer following', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoTestWorkspace(page);

  const shell = page.locator('.app-shell');
  await page.mouse.move(820, 360);
  await expect(shell).not.toHaveAttribute('data-pointer-active');
  const staticDots = await shell.evaluate(
    (element) => getComputedStyle(element, '::before').backgroundImage,
  );
  expect(staticDots).toContain('radial-gradient');
});

test('expanded dock creates a project with an attachment and hands analysis to the compact dock', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoTestWorkspace(page, null, { conversationConnected: true });

  await page.locator('.conversation-dock--expanded').getByLabel('选择图片文件').setInputFiles({
    name: 'conversation-reference.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw2X7wAAAABJRU5ErkJggg==', 'base64'),
  });
  await page.getByRole('textbox', { name: '设计需求' }).fill('为春季市集设计一张海报');
  await page.getByRole('button', { name: '发送并创建项目' }).click();

  await expect(page.getByRole('region', { name: '设计画布' })).toBeVisible();
  await expect(page.getByRole('form', { name: 'AI 操作坞' })).toHaveClass(/conversation-dock--compact/);
  await expect(page.getByRole('textbox', { name: '修改说明' })).toHaveValue('');
  await expect(page.getByText('已完成首轮设计分析。')).toBeVisible();
});

test('failed automatic project creation preserves the complete home draft', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoTestWorkspace(page, null, { conversationConnected: true, failProjectCreation: true });

  await page.locator('.conversation-dock--expanded').getByLabel('选择图片文件').setInputFiles({
    name: 'failed-reference.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw2X7wAAAABJRU5ErkJggg==', 'base64'),
  });
  const textbox = page.getByRole('textbox', { name: '设计需求' });
  await textbox.fill('失败后仍保留');
  await page.getByRole('button', { name: '发送并创建项目' }).click();

  await expect(page.getByRole('heading', { name: '创作中心', exact: true })).toBeAttached();
  await expect(textbox).toHaveValue('失败后仍保留');
  await expect(page.getByRole('button', { name: '预览 failed-reference.png' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('无法创建项目，请重试。');
});

test('project list scrolls independently while creation controls remain fixed', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 720 });
  await gotoTestWorkspace(page, null, { projectCount: 18 });

  const projectList = page.locator('.studio-home-projects__list');
  const dock = page.locator('.conversation-dock--expanded');
  const designerRail = page.locator('.home-designer-rail');
  const before = await Promise.all([dock.boundingBox(), designerRail.boundingBox()]);
  await projectList.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => projectList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const after = await Promise.all([dock.boundingBox(), designerRail.boundingBox()]);

  expect(after).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('home-1024x720.png'), fullPage: true });

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(dock).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('home-1280x800.png'), fullPage: true });
});

test('persona-led creation keeps the selected designer across pages', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoTestWorkspace(page);
  await navigateFromUserMenu(page, '设计师');
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
  const projectDrawer = page.getByRole('dialog', { name: '新建项目' });
  await expect(projectDrawer).toBeVisible();
  await expect(page.getByRole('dialog', { name: '设计师检查器' })).toHaveCount(0);
  await expect(projectDrawer.getByRole('button', { name: '清晰商业' })).toHaveAttribute('aria-pressed', 'true');
  await expect(projectDrawer.getByLabel('新建设计的当前设计师')).toHaveCount(0);
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
  await navigateFromUserMenu(page, '设计师');
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
  const inspectorRuleBox = await inspectorRule.boundingBox();
  expect(inspectorRuleBox).not.toBeNull();
  expect(inspectorTooltipBox!.y + inspectorTooltipBox!.height).toBeLessThanOrEqual(inspectorRuleBox!.y);
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
  const editorRuleBox = await editorRule.boundingBox();
  expect(editorRuleBox).not.toBeNull();
  expect(editorTooltipBox!.y + editorTooltipBox!.height).toBeLessThanOrEqual(editorRuleBox!.y);
  expect(editorTooltipBox!.x).toBeGreaterThanOrEqual(0);
  expect(editorTooltipBox!.x + editorTooltipBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: testInfo.outputPath('designer-editor-rule-tooltip.png'), fullPage: true });
});

test('designer dossier cards keep a stable responsive grid', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoTestWorkspace(page);
  await navigateFromUserMenu(page, '设计师');

  const repository = page.getByLabel('设计师档案库');
  const cards = repository.locator('.designer-profile-card--library');
  await expect(cards).toHaveCount(2);
  const desktopLayout = await repository.locator('.persona-repository__list').evaluate((grid) => ({
    columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    cardWidths: [...grid.querySelectorAll<HTMLElement>('.persona-repository-card-button')]
      .map((card) => card.getBoundingClientRect().width),
  }));
  expect(desktopLayout.columns).toBeGreaterThanOrEqual(4);
  expect(desktopLayout.cardWidths.every((width) => Math.abs(width - 216) <= 1)).toBe(true);

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

test('compact project rows keep cover, title, and metadata aligned', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoTestWorkspace(page);

  await navigateFromUserMenu(page, '新建空白项目');
  const drawer = page.getByRole('dialog', { name: '新建项目' });
  await drawer.getByRole('textbox', { name: '项目名称' }).fill('空简介项目');
  await drawer.getByRole('button', { name: '创建项目', exact: true }).click();
  await page.getByRole('button', { name: '返回首页', exact: true }).click();

  const metrics = await page.locator('.studio-home-project-row').evaluateAll((cards) => cards.map((card) => {
    const cardBounds = card.getBoundingClientRect();
    const readRect = (selector: string) => {
      const bounds = card.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      return { top: bounds.top - cardBounds.top, height: bounds.height };
    };
    return {
      height: cardBounds.height,
      cover: readRect('.studio-home-project-row__cover'),
      title: readRect('.studio-home-project-row__copy strong'),
      metadata: readRect('.studio-home-project-row__copy small'),
    };
  }));

  expect(metrics).toHaveLength(2);
  expect(new Set(metrics.map(({ height }) => height)).size).toBe(1);
  expect(new Set(metrics.map(({ title }) => title.top)).size).toBe(1);
  expect(new Set(metrics.map(({ metadata }) => metadata.top)).size).toBe(1);
  expect(metrics.every(({ cover }) => cover.height === 48)).toBe(true);
});

test('project detail uses the cover-led responsive document layout', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gotoTestWorkspace(page);
  await page.getByRole('button', { name: '春间市集', exact: true }).click();

  const detail = page.getByTestId('project-detail-page');
  const header = page.getByTestId('project-detail-header');
  const hero = page.getByTestId('project-detail-hero');
  const summary = page.locator('.project-detail-summary');
  const description = page.locator('.project-detail-summary__description');
  const layout = page.getByTestId('project-detail-layout');
  await expect(detail).toBeVisible();
  await expect(header).toBeVisible();
  await expect(hero).toBeVisible();
  await expect(page.getByRole('heading', { name: '春间市集', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '设计文档', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: '项目信息', exact: true })).toHaveCount(0);
  expect(await layout.evaluate((element) => getComputedStyle(element).display)).toBe('block');
  expect(await header.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(340);
  expect(await hero.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(160);
  expect(await hero.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(176);
  expect(await summary.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(164);
  expect(await description.evaluate((element) => getComputedStyle(element).webkitLineClamp)).toBe('1');
  expect(await detail.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('project-detail-wide.png'), fullPage: true });

  await page.setViewportSize({ width: 1024, height: 900 });
  expect(await layout.evaluate((element) => getComputedStyle(element).display)).toBe('block');
  expect(await header.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(340);
  expect(await hero.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(160);
  expect(await hero.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(176);
  expect(await detail.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('project-detail-narrow.png'), fullPage: true });

  const openCanvas = page.getByRole('button', { name: '打开主海报', exact: true });
  await openCanvas.click();
  await expect(page.getByRole('region', { name: '设计画布', exact: true })).toBeVisible();
});

test('new project uses a focused drawer without the duplicate callout or designer dossier', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoTestWorkspace(page);
  await expect(page.getByText('下一次创作，从这里开始')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开始创作' })).toHaveCount(0);
  await navigateFromUserMenu(page, '新建空白项目');

  const drawer = page.getByRole('dialog', { name: '新建项目' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('textbox', { name: '项目名称' })).toBeFocused();
  await expect(drawer.getByRole('img', { name: '项目封面' })).toHaveAttribute('src', '/project-default-cover.png');
  await expect(drawer.getByRole('textbox', { name: '设计目标' })).toBeVisible();
  await expect(drawer.getByRole('group', { name: '选择设计师' })).toBeVisible();
  await expect(drawer.getByRole('combobox', { name: '文档尺寸' })).toBeVisible();
  await expect(drawer.getByLabel('新建设计的当前设计师')).toHaveCount(0);
  await expect(drawer.locator('.designer-profile-card--review')).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: '取消' }).locator('xpath=../..')).toHaveClass(/ui-drawer__footer/);
  await expect(drawer.getByRole('button', { name: '创建项目' }).locator('xpath=../..')).toHaveClass(/ui-drawer__footer/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('new-project-drawer.png'), fullPage: true });

  await page.setViewportSize({ width: 1024, height: 720 });
  await drawer.scrollIntoViewIfNeeded();
  expect(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('new-project-drawer-narrow.png'), fullPage: true });
});

test('new-project drawer restores focus and retains a cancelled draft', async ({
  page,
}) => {
  await gotoTestWorkspace(page);
  const menuTrigger = page.getByRole('button', { name: '打开用户菜单', exact: true });
  await menuTrigger.click();
  const trigger = page.getByRole('menuitem', { name: '新建空白项目', exact: true });
  await trigger.click();
  await expect(page.getByRole('textbox', { name: '项目名称' })).toBeFocused();
  const drawer = page.getByRole('dialog', { name: '新建项目' });
  await drawer.getByLabel('选择项目封面').setInputFiles({
    name: 'project-cover.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw2X7wAAAABJRU5ErkJggg==', 'base64'),
  });
  await expect(drawer.getByRole('img', { name: '项目封面' })).toHaveAttribute('src', /^blob:/u);
  await page
    .getByRole('textbox', { name: '项目名称' })
    .fill('秋日漫游 / An unexpectedly long campaign title');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(menuTrigger).toBeFocused();
  await menuTrigger.click();
  await page.getByRole('menuitem', { name: '新建空白项目', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '项目名称' })).toHaveValue(
    '秋日漫游 / An unexpectedly long campaign title',
  );
  await expect(page.getByRole('dialog', { name: '新建项目' }).getByRole('img', { name: '项目封面', exact: true })).toHaveAttribute('src', /^blob:/u);
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: '秋日漫游 / An unexpectedly long campaign title',
    }),
  ).toBeAttached();
  await expect(page.locator('.project-detail-hero__status')).toContainText('进行中');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  const createdCard = page.getByRole('button', { name: '秋日漫游 / An unexpectedly long campaign title', exact: true });
  await expect(createdCard.locator('img')).toHaveAttribute('src', /^blob:/u);
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
    page.getByRole('heading', { name: 'Creative library', exact: true }),
  ).toBeAttached();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
