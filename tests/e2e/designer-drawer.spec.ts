import { expect, test } from 'playwright/test';

import { gotoTestWorkspace } from './test-workspace';

const longFilename = 'portfolio-reference-2026-final-approved-editorial-grid-material-lighting-typography-composition-texture-art-direction-presentation-cover-detail-archive-version-18.png';

for (const viewport of [{ width: 1280, height: 800 }, { width: 720, height: 720 }]) {
  test(`portfolio creation drawer adapts to content at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem('designhub.ui.theme', 'dark'));
    await gotoTestWorkspace(page);
    await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '设计师', exact: true }).click();
    await page.getByRole('button', { name: '从作品集创建' }).click();
    await page.evaluate(() => {
      const api = (window as typeof window & { designhub: Record<string, unknown> }).designhub;
      const candidate = {
        id: 'candidate-e2e', name: { zh: '纸间秩序', en: 'Paper Order' }, signature: { zh: '纸张与网格', en: 'Paper and grid' },
        summary: { zh: '以克制留白、编辑网格与温和纸张质感建立清晰层级。', en: 'A restrained editorial system.' },
        principle: { zh: '先建立信息层级，再用材质与光影补充氛围。', en: 'Build hierarchy before atmosphere.' },
        personaCode: 'E2E-ANALYSIS', version: 'v0.1', status: 'draft', artworkUrl: '', artworkAlt: { zh: '纸间秩序', en: 'Paper Order' },
        tags: [{ zh: '编辑网格', en: 'Editorial grid' }], referenceCount: 0,
        styleDna: {
          palette: ['#F4F1EA', '#1A1C23', '#8C705F', '#06B6D4'],
          typography: { zh: '宋体标题配合半粗无衬线说明文字，形成清晰层级。', en: 'Serif display with semibold sans copy.' },
          composition: { zh: '非对称垂直流与稳定边距构成主要阅读路径。', en: 'Asymmetric vertical flow with stable margins.' },
          texture: { zh: '轻微纸张颗粒与柔和漫反射，避免塑料高光。', en: 'Subtle paper grain and soft diffusion.' },
          signals: {
            contrast: 68, darkAiriness: 82, whitespace: 38, grain: 15, diffuseLight: 92,
            typeFamily: { zh: '宋体倾向', en: 'Serif tendency' }, typeWeight: { zh: '半粗体', en: 'Semibold' }, tracking: { zh: '紧凑', en: 'Compact' },
            compositionTopology: { zh: '非对称垂直流', en: 'Asymmetric vertical flow' }, rendering: { zh: '纸张漫反射', en: 'Paper diffusion' },
          },
        },
        negativeRules: [{ zh: '避免霓虹渐变', en: 'Avoid neon gradients' }, { zh: '避免破坏安全边距', en: 'Keep safe margins' }], portfolioSheets: [],
      };
      api.inspectPortfolioSources = async () => ({
        id: 'inspection-e2e',
        candidates: [{
          id: 'source-e2e',
          label: 'portfolio-reference-2026-final-approved-editorial-grid-material-lighting-typography-composition-texture-art-direction-presentation-cover-detail-archive-version-18.png',
          description: '作品集封面',
          origin: 'local-image',
          previewUrl: '',
        }],
      });
      api.submitPortfolioSelection = async () => ({ id: 'task-portfolio-e2e', requestId: 'request-portfolio-e2e', state: 'completed', cancelRequested: false, attempt: 1, result: { text: JSON.stringify({ candidates: [candidate] }) } });
      api.submitDesignerArtworkGeneration = () => new Promise(() => undefined);
    });

    const drawer = page.getByRole('dialog', { name: '导入作品集分析 · 生成 AI 设计师档案' });
    await expect(drawer).toHaveClass(/ui-drawer--portfolio/);
    const importBox = await drawer.boundingBox();
    const hostBox = await page.locator('[data-drawer-host]').boundingBox();
    expect(importBox).not.toBeNull();
    expect(hostBox).not.toBeNull();
    const expectedWidth = Math.min(560, viewport.width * 0.92, hostBox!.width);
    expect(Math.abs(importBox!.width - expectedWidth)).toBeLessThanOrEqual(1);
    expect(importBox!.x).toBeGreaterThanOrEqual(hostBox!.x);
    const footerBox = await drawer.locator('.ui-drawer__footer').boundingBox();
    expect(footerBox).not.toBeNull();
    expect(Math.abs(footerBox!.y + footerBox!.height - (importBox!.y + importBox!.height))).toBeLessThanOrEqual(1);
    await expect(drawer.getByRole('button', { name: '检查页面' })).toHaveCount(0);
    await expect(drawer.getByRole('textbox', { name: '作品集链接' })).toHaveCount(0);

    await page.getByRole('button', { name: '选择图片' }).click();
    await expect(page.getByRole('checkbox', { name: longFilename })).toBeChecked();
    const filenameLayout = await drawer.locator('.designer-portfolio-candidate__name').evaluate((name) => {
      const nameBox = name.getBoundingClientRect();
      const rowBox = name.closest('.designer-portfolio-candidate')!.getBoundingClientRect();
      return {
        clientWidth: name.clientWidth,
        scrollWidth: name.scrollWidth,
        nameRight: nameBox.right,
        rowRight: rowBox.right,
        title: name.getAttribute('title'),
      };
    });
    expect(filenameLayout.scrollWidth).toBeGreaterThan(filenameLayout.clientWidth);
    expect(filenameLayout.nameRight).toBeLessThanOrEqual(filenameLayout.rowRight + 1);
    expect(filenameLayout.title).toBe(longFilename);
    await page.getByRole('checkbox', { name: '我确认拥有分析这些来源的权利' }).check();
    await page.getByRole('button', { name: '开始分析' }).click();

    await expect(drawer).toHaveClass(/ui-drawer--portfolio/);
    await expect(drawer.getByRole('region', { name: '纸间秩序的视觉 DNA 分析' })).toBeVisible();
    await expect(drawer.getByRole('region', { name: '色彩倾向与光影分布' })).toBeVisible();
    await expect(drawer.getByRole('region', { name: '排版韵律与构图骨架' })).toBeAttached();
    await expect(drawer.getByRole('region', { name: '材质肌理与感知参数' })).toBeAttached();
    await expect(drawer.getByRole('region', { name: '否定规则' })).toBeAttached();
    await expect(drawer.getByRole('progressbar')).toHaveCount(5);
    const grainProgress = drawer.getByRole('progressbar', { name: '纹理颗粒度' });
    const grainPresentation = await grainProgress.evaluate((track) => {
      const fill = track.querySelector<HTMLElement>('i')!;
      return {
        token: getComputedStyle(document.documentElement).getPropertyValue('--warning').trim(),
        color: getComputedStyle(fill).backgroundColor,
        ratio: fill.getBoundingClientRect().width / track.getBoundingClientRect().width,
      };
    });
    expect(grainPresentation.token).toBe('#f6bd60');
    expect(grainPresentation.color).toBe('rgb(246, 189, 96)');
    expect(grainPresentation.ratio).toBeCloseTo(0.15, 2);
    await expect(drawer.getByRole('textbox')).toHaveCount(0);
    await expect(drawer.getByRole('spinbutton')).toHaveCount(0);
    const stepHeights = await drawer.getByRole('list', { name: '生成流程' }).locator('li').evaluateAll(
      (steps) => steps.map((step) => step.getBoundingClientRect().height),
    );
    expect(stepHeights.every((height) => height <= 40)).toBe(true);
    const analysisColumns = await drawer.locator('.portfolio-analysis-report__grid').evaluate(
      (grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    );
    expect(analysisColumns).toBe(1);
    const analysisBox = await drawer.boundingBox();
    expect(analysisBox).not.toBeNull();
    expect(Math.abs(analysisBox!.width - importBox!.width)).toBeLessThanOrEqual(1);
    expect(analysisBox!.x).toBeGreaterThanOrEqual(hostBox!.x);
    expect(analysisBox!.x + analysisBox!.width).toBeLessThanOrEqual(hostBox!.x + hostBox!.width + 1);
    const overflow = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { className: element.className, left: rect.left, right: rect.right, width: rect.width, height: rect.height, display: style.display, visibility: style.visibility };
      })
      .filter((entry) => entry.right > window.innerWidth + 1
        && entry.left < window.innerWidth
        && entry.width > 0
        && entry.height > 0
        && entry.display !== 'none'
        && entry.visibility !== 'hidden'));
    expect(overflow).toEqual([]);

    await page.screenshot({ path: testInfo.outputPath('portfolio-analysis-result.png'), fullPage: true });
    await drawer.locator('.ui-drawer__content').evaluate((content) => { content.scrollTop = content.scrollHeight; });
    await expect(drawer.getByRole('region', { name: '否定规则' })).toBeVisible();
    await expect(drawer.getByRole('button', { name: '下一步：生成形象' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('portfolio-analysis-result-bottom.png'), fullPage: true });
    await drawer.getByRole('button', { name: '下一步：生成形象' }).click();
    await expect.poll(() => drawer.locator('.ui-drawer__content').evaluate((content) => content.scrollTop)).toBeLessThanOrEqual(1);
    await expect(drawer.getByText('正在生成设计师形象')).toBeVisible();
    await expect(drawer.getByTestId('portfolio-artwork-skeleton')).toBeVisible();
    const artworkBox = await drawer.boundingBox();
    expect(artworkBox).not.toBeNull();
    expect(Math.abs(artworkBox!.width - importBox!.width)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath('portfolio-artwork-loading.png'), fullPage: true });
  });
}
