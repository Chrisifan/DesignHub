import { expect, test } from 'playwright/test';

import { gotoTestWorkspace } from './test-workspace';

for (const viewport of [{ width: 1280, height: 800 }, { width: 720, height: 720 }]) {
  test(`portfolio creation drawer adapts to content at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem('designhub.ui.theme', 'dark'));
    await gotoTestWorkspace(page);
    await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '设计师', exact: true }).click();
    await page.getByRole('button', { name: '从作品集创建' }).click();

    const drawer = page.getByRole('dialog', { name: '导入作品集分析 · 生成 AI 设计师档案' });
    await expect(drawer).toHaveClass(/ui-drawer--compact/);
    const compactBox = await drawer.boundingBox();
    const hostBox = await page.locator('[data-drawer-host]').boundingBox();
    expect(compactBox).not.toBeNull();
    expect(hostBox).not.toBeNull();
    expect(compactBox!.width).toBeLessThanOrEqual(461);
    expect(compactBox!.x).toBeGreaterThanOrEqual(hostBox!.x);
    const footerBox = await drawer.locator('.ui-drawer__footer').boundingBox();
    expect(footerBox).not.toBeNull();
    expect(Math.abs(footerBox!.y + footerBox!.height - (compactBox!.y + compactBox!.height))).toBeLessThanOrEqual(1);
    expect(await drawer.getByRole('button', { name: '检查页面' }).evaluate(
      (button) => Boolean(button.closest('.ui-drawer__content')),
    )).toBe(true);

    await page.getByRole('textbox', { name: '作品集链接' }).fill('https://example.com/portfolio');
    await page.getByRole('button', { name: '检查页面' }).click();
    await page.getByRole('checkbox', { name: '作品集封面' }).check();
    await page.getByRole('checkbox', { name: '我确认拥有分析这些来源的权利' }).check();
    await page.getByRole('button', { name: '开始分析' }).click();

    await expect(drawer).toHaveClass(/ui-drawer--compact/);
    await expect(drawer.getByText('正在提炼视觉 DNA')).toBeVisible();
    await expect(drawer.getByTestId('portfolio-analysis-skeleton')).toBeVisible();
    const stepHeights = await drawer.getByRole('list', { name: '生成流程' }).locator('li').evaluateAll(
      (steps) => steps.map((step) => step.getBoundingClientRect().height),
    );
    expect(stepHeights.every((height) => height <= 40)).toBe(true);
    const analysisBox = await drawer.boundingBox();
    expect(analysisBox).not.toBeNull();
    expect(analysisBox!.width).toBeLessThanOrEqual(461);
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

    await page.screenshot({ path: testInfo.outputPath('portfolio-analysis-drawer.png'), fullPage: true });
  });
}
