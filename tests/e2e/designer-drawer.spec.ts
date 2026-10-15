import { writeFile } from 'node:fs/promises';
import { expect, test } from 'playwright/test';

import type { PersonaProfile } from '../../src/app/studio/personas';
import type { DesignerLibraryState } from '../../src/features/designers/persistence';
import type { TaskRecord } from '../../src/features/tasks/state';
import type { DesktopApi, PortfolioSelectionInput } from '../../src/platform/contracts';
import { gotoTestWorkspace, navigateFromUserMenu } from './test-workspace';

type DesignerSaveInput = Parameters<NonNullable<DesktopApi['saveDesignerState']>>;
type DesignerWorkflowWindow = typeof window & {
  designhub: DesktopApi;
  artworkRequests: number;
  portfolioAnalysisRequests: number;
  portfolioSubmissions: PortfolioSelectionInput[];
  designerSaves: DesignerSaveInput[];
  designerState: DesignerLibraryState;
  resolvePortfolioAnalysis?: () => void;
};

const longFilename = 'portfolio-reference-2026-final-approved-editorial-grid-material-lighting-typography-composition-texture-art-direction-presentation-cover-detail-archive-version-18.png';
const longNegativeRule = '避免使用会破坏安全边距、信息层级与主体识别度的霓虹渐变、高强度装饰效果以及喧宾夺主的复杂背景纹理';
const avatarPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');

for (const viewport of [{ width: 1280, height: 800 }, { width: 720, height: 720 }]) {
  test(`portfolio creation drawer publishes generated artwork at ${viewport.width}px`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    await page.route('designhub-artwork://**', (route) => route.fulfill({ contentType: 'image/png', body: avatarPng }));
    await page.addInitScript(() => localStorage.setItem('designhub.ui.theme', 'dark'));
    await gotoTestWorkspace(page);
    await navigateFromUserMenu(page, '设计师');
    const initialDrawer = page.getByRole('dialog', { name: '导入作品集分析 · 生成 AI 设计师档案' });
    await expect(initialDrawer).toBeVisible();
    const fixture = await page.evaluate(async (longRule) => {
      const testHost = window as DesignerWorkflowWindow;
      const api = testHost.designhub;
      const initialState = await api.loadDesignerState?.('library-e2e');
      if (!initialState) throw new Error('DESIGNER_FIXTURE_STATE_REQUIRED');
      testHost.designerState = structuredClone(initialState);
      testHost.designerSaves = [];
      api.loadDesignerState = async () => structuredClone(testHost.designerState);
      api.saveDesignerState = async (libraryId, state) => {
        testHost.designerSaves.push(structuredClone([libraryId, state]));
        testHost.designerState = structuredClone(state);
        return true;
      };
      const candidate: PersonaProfile = {
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
        negativeRules: [{ zh: longRule, en: 'Avoid decorative effects that harm hierarchy and subject clarity' }, { zh: '避免破坏安全边距', en: 'Keep safe margins' }], portfolioSheets: [],
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
      const completedAnalysis: TaskRecord = { id: 'task-portfolio-e2e', requestId: 'request-portfolio-e2e', state: 'completed', cancelRequested: false, attempt: 1, result: { text: JSON.stringify({ candidates: [candidate] }) } };
      testHost.portfolioAnalysisRequests = 0;
      testHost.portfolioSubmissions = [];
      api.submitPortfolioSelection = async (input) => {
        testHost.portfolioSubmissions.push(structuredClone(input));
        testHost.portfolioAnalysisRequests += 1;
        if (testHost.portfolioAnalysisRequests > 1) return completedAnalysis;
        return new Promise((resolve) => {
          testHost.resolvePortfolioAnalysis = () => resolve(completedAnalysis);
        });
      };
      testHost.artworkRequests = 0;
      api.submitDesignerArtworkGeneration = async () => {
        testHost.artworkRequests += 1;
        const artworkId = `artwork-e2e-${testHost.artworkRequests}`;
        return { id: `task-${artworkId}`, requestId: `request-${artworkId}`, state: 'completed', cancelRequested: false, attempt: 1, result: { assetIds: [artworkId], imageCount: 1 } };
      };
      api.readDesignerArtwork = async ({ artworkId }) => ({ artworkId, dataUrl: 'data:image/png;base64,AQID' });
      return { candidate, initialState };
    }, longNegativeRule);

    const drawer = page.getByRole('dialog', { name: '导入作品集分析 · 生成 AI 设计师档案' });
    await expect(drawer).toHaveClass(/ui-drawer--portfolio/);
    const importBox = await drawer.boundingBox();
    const hostBox = await page.locator('[data-drawer-host]').boundingBox();
    expect(importBox).not.toBeNull();
    expect(hostBox).not.toBeNull();
    const expectedWidth = Math.min(520, viewport.width * 0.92, hostBox!.width);
    expect(Math.abs(importBox!.width - expectedWidth)).toBeLessThanOrEqual(5);
    expect(importBox!.x).toBeGreaterThanOrEqual(hostBox!.x);
    const footerBox = await drawer.locator('.ui-drawer__footer').boundingBox();
    expect(footerBox).not.toBeNull();
    expect(Math.abs(footerBox!.y + footerBox!.height - (importBox!.y + importBox!.height))).toBeLessThanOrEqual(4);
    await expect(drawer.getByRole('button', { name: '检查页面' })).toHaveCount(0);
    await expect(drawer.getByRole('textbox', { name: '作品集链接' })).toHaveCount(0);
    await expect(drawer.getByRole('button', { name: '选择图片' })).toHaveCount(0);
    await expect(drawer.getByRole('button', { name: '选择 ZIP' })).toHaveCount(0);

    const uploader = drawer.getByRole('button', { name: '上传作品集文件' });
    await expect(uploader).toBeVisible();
    await uploader.click();
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
    const rightsConfirmation = drawer.getByRole('checkbox', { name: '我确认拥有分析这些来源的权利' });
    await expect(rightsConfirmation).not.toBeChecked();
    await drawer.getByRole('button', { name: '开始分析' }).click();
    await expect(drawer.getByRole('alert')).toHaveText('请先确认拥有分析这些来源的权利。');
    expect(await page.evaluate(() => (window as DesignerWorkflowWindow).portfolioSubmissions)).toEqual([]);
    await expect(drawer.getByTestId('portfolio-analysis-skeleton')).toHaveCount(0);
    await rightsConfirmation.check();
    await page.screenshot({ path: testInfo.outputPath('portfolio-upload.png'), fullPage: true });
    await page.getByRole('button', { name: '开始分析' }).click();
    const [submission] = await page.evaluate(() => (window as DesignerWorkflowWindow).portfolioSubmissions);
    expect(submission).toEqual({
      libraryId: 'library-e2e',
      source: { kind: 'designer-draft', id: expect.stringMatching(/^designer-[0-9a-f-]{36}$/u) },
      connectionId: 'openai-compatible',
      selections: [{ inspectionId: 'inspection-e2e', sourceIds: ['source-e2e'] }],
      rightsConfirmed: true,
    });

    await expect(drawer).toHaveClass(/ui-drawer--portfolio/);
    const skeleton = drawer.getByTestId('portfolio-analysis-skeleton');
    await expect(skeleton).toBeVisible();
    const motion = await skeleton.locator('i').first().evaluate((element) => {
      const base = getComputedStyle(element);
      const shimmer = getComputedStyle(element, '::after');
      return {
        baseAnimation: base.animationName,
        shimmerAnimation: shimmer.animationName,
        shimmerWillChange: shimmer.willChange,
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      };
    });
    expect(motion.baseAnimation).toBe('none');
    expect(motion.shimmerAnimation).toBe('portfolio-skeleton');
    expect(motion.shimmerWillChange).toContain('transform');
    expect(motion.width).toBeGreaterThan(0);
    expect(motion.height).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath('portfolio-analysis-loading.png'), fullPage: true });
    await page.evaluate(() => {
      (window as typeof window & { resolvePortfolioAnalysis?: () => void }).resolvePortfolioAnalysis?.();
    });
    await expect(drawer.getByRole('region', { name: '纸间秩序的视觉 DNA 分析' })).toBeVisible();
    await expect(drawer.getByRole('region', { name: '色彩倾向与光影分布' })).toBeVisible();
    await expect(drawer.getByRole('region', { name: '排版韵律与构图骨架' })).toBeAttached();
    await expect(drawer.getByRole('region', { name: '材质肌理与感知参数' })).toBeAttached();
    await expect(drawer.getByRole('region', { name: '否定规则' })).toBeAttached();
    await expect(drawer.getByRole('progressbar')).toHaveCount(5);
    const ruleText = drawer.getByText(longNegativeRule, { exact: true });
    await expect(ruleText).not.toHaveAttribute('title');
    const ruleLayout = await ruleText.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      whiteSpace: getComputedStyle(element).whiteSpace,
      textOverflow: getComputedStyle(element).textOverflow,
    }));
    expect(ruleLayout.scrollWidth).toBeGreaterThan(ruleLayout.clientWidth);
    expect(ruleLayout.clientWidth).toBeGreaterThan(100);
    expect(ruleLayout.whiteSpace).toBe('nowrap');
    expect(ruleLayout.textOverflow).toBe('ellipsis');
    await ruleText.hover();
    await expect(page.getByRole('tooltip')).toHaveText(longNegativeRule);
    await page.screenshot({ path: testInfo.outputPath('portfolio-analysis-tooltip.png'), fullPage: true });
    const grainProgress = drawer.getByRole('progressbar', { name: '纹理颗粒度' });
    const grainPresentation = await grainProgress.evaluate((track) => {
      const fill = track.querySelector<HTMLElement>('i')!;
      return {
        token: getComputedStyle(document.documentElement).getPropertyValue('--accent-warm').trim(),
        color: getComputedStyle(fill).backgroundColor,
        ratio: fill.getBoundingClientRect().width / track.getBoundingClientRect().width,
      };
    });
    expect(grainPresentation.token).toBe('#fb923c');
    expect(grainPresentation.color).toBe('rgb(251, 146, 60)');
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
    await drawer.getByRole('button', { name: '返回导入' }).click();
    await expect(page.getByRole('checkbox', { name: longFilename })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: '我确认拥有分析这些来源的权利' })).toBeChecked();
    await page.getByRole('button', { name: '开始分析' }).click();
    await expect(drawer.getByRole('region', { name: '纸间秩序的视觉 DNA 分析' })).toBeVisible();
    await drawer.getByRole('button', { name: '下一步：生成形象' }).click();
    await expect.poll(() => drawer.locator('.ui-drawer__content').evaluate((content) => content.scrollTop)).toBeLessThanOrEqual(1);
    const avatar = drawer.getByRole('img', { name: '生成的设计师 Avatar' });
    await expect(avatar).toHaveAttribute('src', 'designhub-artwork://artwork-e2e-1');
    await expect.poll(() => avatar.evaluate((element) => {
      const image = element as HTMLImageElement;
      return image.complete && image.naturalWidth > 0;
    })).toBe(true);
    await expect.poll(() => page.evaluate(() => (window as typeof window & { artworkRequests: number }).artworkRequests)).toBe(1);
    const artworkBox = await drawer.boundingBox();
    expect(artworkBox).not.toBeNull();
    expect(Math.abs(artworkBox!.width - importBox!.width)).toBeLessThanOrEqual(1);
    const avatarBox = await avatar.boundingBox();
    expect(avatarBox).not.toBeNull();
    expect(avatarBox!.x).toBeGreaterThanOrEqual(artworkBox!.x);
    expect(avatarBox!.x + avatarBox!.width).toBeLessThanOrEqual(artworkBox!.x + artworkBox!.width + 1);
    await page.screenshot({ path: testInfo.outputPath('portfolio-avatar.png'), fullPage: true });
    await drawer.getByRole('button', { name: '返回分析' }).click();
    await expect(drawer.getByRole('region', { name: '纸间秩序的视觉 DNA 分析' })).toBeVisible();
    await drawer.getByRole('button', { name: '下一步：生成形象' }).click();
    await expect(avatar).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as typeof window & { artworkRequests: number }).artworkRequests)).toBe(1);
    await drawer.getByRole('button', { name: '下一步：预览发布' }).click();
    const dossier = drawer.getByRole('region', { name: '纸间秩序设计师档案' });
    await expect(dossier).toBeVisible();
    await expect(dossier.getByRole('region', { name: '核心指标' }).getByRole('progressbar')).toHaveCount(4);
    await expect(dossier.getByRole('region', { name: 'Style DNA' })).toBeVisible();
    await expect(dossier.getByRole('region', { name: '否定规则' })).toContainText(longNegativeRule);
    await expect(dossier.getByRole('progressbar')).toHaveCount(5);
    const reviewRule = dossier.getByText(longNegativeRule, { exact: true });
    await expect(reviewRule).not.toHaveAttribute('title');
    await expect(reviewRule).toHaveCSS('white-space', 'nowrap');
    await expect(reviewRule).toHaveCSS('text-overflow', 'ellipsis');
    expect(await reviewRule.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await reviewRule.hover();
    await expect(page.getByRole('tooltip')).toHaveText(longNegativeRule);
    await page.screenshot({ path: testInfo.outputPath('portfolio-review-tooltip.png'), fullPage: true });
    const reviewArtworkBox = await dossier.locator('.designer-profile-card__review-artwork').boundingBox();
    expect(reviewArtworkBox).not.toBeNull();
    if (viewport.width <= 720) expect(reviewArtworkBox!.height).toBeLessThanOrEqual(240);
    const reviewBox = await drawer.boundingBox();
    expect(reviewBox).not.toBeNull();
    expect(Math.abs(reviewBox!.width - importBox!.width)).toBeLessThanOrEqual(1);
    const reviewFooter = await drawer.locator('.ui-drawer__footer').boundingBox();
    expect(reviewFooter).not.toBeNull();
    expect(Math.abs(reviewFooter!.y + reviewFooter!.height - (reviewBox!.y + reviewBox!.height))).toBeLessThanOrEqual(1);
    const reviewOverflow = await drawer.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(reviewOverflow).toBeLessThanOrEqual(1);
    await expect(drawer.getByRole('button', { name: '发布预览' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('portfolio-review.png'), fullPage: true });
    await drawer.locator('.ui-drawer__content').evaluate((content) => { content.scrollTop = content.scrollHeight; });
    await expect(dossier.getByRole('region', { name: '否定规则' })).toBeVisible();
    await expect(drawer.getByRole('button', { name: '发布预览' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('portfolio-review-bottom.png'), fullPage: true });
    await drawer.getByRole('button', { name: '返回形象' }).click();
    await expect(avatar).toHaveAttribute('src', 'designhub-artwork://artwork-e2e-1');
    await drawer.getByRole('button', { name: '重新生成' }).click();
    await expect(avatar).toHaveAttribute('src', 'designhub-artwork://artwork-e2e-2');
    await expect.poll(() => page.evaluate(() => (window as typeof window & { artworkRequests: number }).artworkRequests)).toBe(2);
    await page.screenshot({ path: testInfo.outputPath('portfolio-avatar-regenerated.png'), fullPage: true });

    await drawer.getByRole('button', { name: '下一步：预览发布' }).click();
    await expect(dossier.getByRole('img', { name: '纸间秩序的人物形象' })).toHaveAttribute('src', 'designhub-artwork://artwork-e2e-2');
    expect(await page.evaluate(() => (window as DesignerWorkflowWindow).designerSaves)).toEqual([]);
    const publish = drawer.getByRole('button', { name: '发布预览' });
    await publish.click();
    await expect(drawer.getByText('已发布。', { exact: true })).toBeVisible();
    await expect(publish).toBeDisabled();
    await expect(page.getByRole('status')).toHaveText('设计师已发布并保存到当前工作区。');
    // Publishing keeps the review open; closing it exposes the updated home rail.
    await expect(drawer).toBeVisible();
    const saves = await page.evaluate(() => (window as DesignerWorkflowWindow).designerSaves);
    expect(saves).toEqual([['library-e2e', {
      profiles: [{
        ...fixture.candidate,
        id: expect.stringMatching(/^custom-[0-9a-f-]{36}$/u),
        status: 'published',
        referenceCount: 0,
        artworkAssetId: 'artwork-e2e-2',
        artworkUrl: 'designhub-artwork://artwork-e2e-2',
      }, ...fixture.initialState.profiles],
      defaultId: fixture.initialState.defaultId,
      drafts: {
        newDraft: {
          name: '', signature: '', summary: '', principle: '', personaCode: 'CUSTOM-A', version: 'v0.1',
          tags: '', palette: '#E8E4DC, #252525, #6C7A70', typography: '', composition: '', texture: '',
          negativeRules: '', contrast: '', darkAiriness: '', whitespace: '', grain: '', diffuseLight: '',
          typeFamily: '', typeWeight: '', tracking: '', compositionTopology: '', rendering: '',
        },
        editDrafts: {},
      },
    }]]);
    const publishedState = saves[0][1];
    const publishedProfile = publishedState.profiles[0];
    expect(publishedProfile.id).not.toBe(fixture.candidate.id);
    expect(await page.evaluate(() => (window as DesignerWorkflowWindow).designerState)).toEqual(publishedState);
    const saveEvidencePath = testInfo.outputPath('published-designer-save.json');
    await writeFile(saveEvidencePath, JSON.stringify(saves, null, 2));
    await testInfo.attach('published-designer-save.json', { path: saveEvidencePath, contentType: 'application/json' });
    await page.screenshot({ path: testInfo.outputPath('portfolio-published.png'), fullPage: true });
    await drawer.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(drawer).toHaveCount(0);

    const home = page.getByRole('main');
    const publishedCard = home.getByRole('button', { name: '查看设计师档案：纸间秩序', exact: true });
    await expect(publishedCard).toBeVisible();
    await expect(publishedCard.getByRole('img', { name: '纸间秩序的人物形象' })).toHaveAttribute('src', 'designhub-artwork://artwork-e2e-2');
    await publishedCard.click();
    const inspector = page.getByRole('dialog', { name: '设计师信息', exact: true });
    await expect(inspector.getByRole('region', { name: '纸间秩序设计师档案' })).toBeVisible();
    await expect(inspector.getByText('已发布', { exact: true })).toBeVisible();
    await expect(inspector.getByRole('img', { name: '纸间秩序的人物形象' })).toHaveAttribute('src', 'designhub-artwork://artwork-e2e-2');
    await inspector.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(inspector).toHaveCount(0);

    // The current shell requires an explicit choice for the next project.
    const designerSelect = home.getByRole('combobox', { name: '设计师', exact: true });
    await expect(designerSelect).toHaveValue('');
    await designerSelect.click();
    await home.getByRole('option', { name: '纸间秩序的人物形象 纸间秩序', exact: true }).click();
    await expect(designerSelect).toHaveValue(publishedProfile.id);
    await expect(publishedCard).toHaveClass(/is-selected/u);
    await page.screenshot({ path: testInfo.outputPath('published-designer-selected.png'), fullPage: true });
    expect(await page.evaluate(() => (window as DesignerWorkflowWindow).designerSaves)).toEqual(saves);
  });
}
