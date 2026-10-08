import { expect, test } from 'playwright/test';

test('aligns the job columns and applies two real card sizes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.evaluate(() => {
    document.body.innerHTML = `
      <div class="image-tools-workbench" style="height: 640px">
        <aside class="image-tools-job-sidebar">Jobs</aside>
        <main class="image-tools-workbench__main">
          <div class="image-tools-job-detail">
            <div class="image-tools-job-detail__overview">Overview</div>
            <div class="image-tools-result-grid is-compact">
              <button class="image-tools-result-card is-completed" type="button">
                <span class="image-tools-result-card__preview is-transparency-grid"></span>
                <span class="image-tools-result-card__body">compact.png</span>
              </button>
            </div>
            <div class="image-tools-result-grid is-large">
              <button class="image-tools-result-card is-completed" type="button">
                <span class="image-tools-result-card__preview is-transparency-grid"></span>
                <span class="image-tools-result-card__body">large.png</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    `;
  });

  const sidebar = page.locator('.image-tools-job-sidebar');
  const overview = page.locator('.image-tools-job-detail__overview');
  const compactPreview = page.locator('.image-tools-result-grid.is-compact .image-tools-result-card__preview');
  const largePreview = page.locator('.image-tools-result-grid.is-large .image-tools-result-card__preview');
  const [sidebarBox, overviewBox, compactBox, largeBox] = await Promise.all([
    sidebar.boundingBox(),
    overview.boundingBox(),
    compactPreview.boundingBox(),
    largePreview.boundingBox(),
  ]);

  expect(overviewBox?.y).toBe(sidebarBox?.y);
  expect(compactBox?.height).toBeLessThan(largeBox?.height ?? 0);
});

test('uses theme-aware transparency-grid colors', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    document.body.innerHTML = `
      <button class="image-tools-result-card is-completed" type="button">
        <span class="image-tools-result-card__preview is-transparency-grid"></span>
      </button>
    `;
  });

  const preview = page.locator('.image-tools-result-card__preview');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  const darkBackground = await preview.evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.backgroundColor}|${style.backgroundImage}`;
  });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  const lightBackground = await preview.evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.backgroundColor}|${style.backgroundImage}`;
  });

  expect(lightBackground).not.toBe(darkBackground);
});

test('completed result preview fills the full media row', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    document.body.innerHTML = `
      <button class="image-tools-result-card is-completed is-complete" type="button">
        <span class="image-tools-result-card__preview is-transparency-grid">
          <span class="image-tools-result-card__status">Completed</span>
          <small>Result ready</small>
        </span>
        <span class="image-tools-result-card__body">result.png</span>
      </button>
    `;
  });

  const card = page.locator('.image-tools-result-card');
  const preview = card.locator('.image-tools-result-card__preview');
  const [cardRows, previewBox] = await Promise.all([
    card.evaluate((element) => getComputedStyle(element).gridTemplateRows),
    preview.boundingBox(),
  ]);

  expect(cardRows.split(' ')[0]).toBe('156px');
  expect(previewBox?.height).toBe(156);
});
