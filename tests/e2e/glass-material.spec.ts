import { expect, test } from 'playwright/test';

type MaterialSample = { backgroundAlpha: number; borderAlpha: number; blurRadius: number };

for (const theme of ['dark', 'light'] as const) {
  test(`${theme} glass surfaces keep a readable frosted material`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate((mode) => {
      document.documentElement.dataset.theme = mode;
      document.body.innerHTML = `
        <div class="conversation-dock" data-material="shell">Conversation</div>
        <div class="project-canvas-toolbar__actions" data-material="project-canvas-tools">Tools</div>
        <div class="project-canvas-toolbar__selection" data-material="project-canvas-selection">Selection</div>
      `;
    }, theme);

    const sample = async (name: string): Promise<MaterialSample> => page.locator(`[data-material="${name}"]`).evaluate((element) => {
      const style = getComputedStyle(element);
      const alpha = (color: string): number => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext('2d');
        if (!context) return 0;
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return context.getImageData(0, 0, 1, 1).data[3]! / 255;
      };
      const filter = style.backdropFilter
        || (style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter
        || '';
      return {
        backgroundAlpha: alpha(style.backgroundColor),
        borderAlpha: alpha(style.borderTopColor),
        blurRadius: Number(filter.match(/blur\((\d+(?:\.\d+)?)px\)/u)?.[1] ?? 0),
      };
    });

    const shell = await sample('shell');
    const projectCanvasTools = await sample('project-canvas-tools');
    const projectCanvasSelection = await sample('project-canvas-selection');

    expect(shell.backgroundAlpha).toBeGreaterThanOrEqual(0.76);
    expect(shell.borderAlpha).toBeGreaterThanOrEqual(theme === 'dark' ? 0.13 : 0.25);
    expect(shell.blurRadius).toBeGreaterThanOrEqual(28);
    expect(projectCanvasTools.backgroundAlpha).toBeGreaterThanOrEqual(0.76);
    expect(projectCanvasTools.borderAlpha).toBeGreaterThanOrEqual(theme === 'dark' ? 0.13 : 0.25);
    expect(projectCanvasTools.blurRadius).toBeGreaterThanOrEqual(28);
    expect(projectCanvasSelection.backgroundAlpha).toBeGreaterThanOrEqual(0.76);
    expect(projectCanvasSelection.borderAlpha).toBeGreaterThanOrEqual(theme === 'dark' ? 0.13 : 0.25);
    expect(projectCanvasSelection.blurRadius).toBeGreaterThanOrEqual(28);
  });
}
