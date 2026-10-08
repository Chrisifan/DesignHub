import { expect, test } from 'playwright/test';

type MaterialSample = { backgroundAlpha: number; borderAlpha: number; blurRadius: number };

for (const theme of ['dark', 'light'] as const) {
  test(`${theme} glass surfaces keep a readable frosted material`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate((mode) => {
      document.documentElement.dataset.theme = mode;
      document.body.innerHTML = `
        <div class="conversation-dock" data-material="shell">Conversation</div>
        <div class="workbench">
          <div class="workbench-body--canvas-first">
            <div class="workbench-toolstrip" data-material="workbench">Tools</div>
          </div>
          <div class="workbench-properties-float" data-material="workbench-strong">Properties</div>
        </div>
        <div class="project-canvas-toolbar__selection" data-material="project-canvas">Selection</div>
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
    const workbench = await sample('workbench');
    const strong = await sample('workbench-strong');
    const projectCanvas = await sample('project-canvas');

    expect(shell.backgroundAlpha).toBeGreaterThanOrEqual(0.76);
    expect(shell.borderAlpha).toBeGreaterThanOrEqual(theme === 'dark' ? 0.13 : 0.25);
    expect(shell.blurRadius).toBeGreaterThanOrEqual(28);
    expect(workbench.backgroundAlpha).toBeGreaterThanOrEqual(0.62);
    expect(strong.backgroundAlpha).toBeGreaterThanOrEqual(0.72);
    expect(workbench.blurRadius).toBeGreaterThanOrEqual(28);
    expect(strong.blurRadius).toBeGreaterThanOrEqual(28);
    expect(projectCanvas.backgroundAlpha).toBeGreaterThanOrEqual(0.76);
    expect(projectCanvas.borderAlpha).toBeGreaterThanOrEqual(theme === 'dark' ? 0.13 : 0.25);
    expect(projectCanvas.blurRadius).toBeGreaterThanOrEqual(28);
  });
}
