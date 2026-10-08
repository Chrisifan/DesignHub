import { expect, test } from 'playwright/test';

test('generation batch keeps a full canvas gap between adjacent drafts', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    document.body.innerHTML = `
      <div class="workbench-canvas-world__row">
        <div class="workbench-candidate-batch">
          <button class="workbench-candidate-card" style="width: 320px; flex-basis: 320px">First</button>
          <button class="workbench-candidate-card" style="width: 320px; flex-basis: 320px">Second</button>
          <button class="workbench-candidate-card" style="width: 320px; flex-basis: 320px">Third</button>
        </div>
      </div>
    `;
  });

  const cards = page.locator('.workbench-candidate-card');
  const boxes = await Promise.all([0, 1, 2].map((index) => cards.nth(index).boundingBox()));
  expect(boxes.every(Boolean)).toBe(true);

  const [first, second, third] = boxes;
  expect(first!.width).toBe(320);
  expect(second!.x - (first!.x + first!.width)).toBeGreaterThanOrEqual(32);
  expect(third!.x - (second!.x + second!.width)).toBeGreaterThanOrEqual(32);
});
