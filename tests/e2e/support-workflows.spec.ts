import { createHash } from 'node:crypto';
import { expect, test } from 'playwright/test';

import { gotoTestWorkspace, navigateFromUserMenu } from './test-workspace';
import { backupCreatedAt, installSupportBridge, readSupportCalls, supportPaths, supportTrash } from './support-workflows-workspace';

const libraryId = 'library-e2e';
const projectId = 'project-e2e';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw2X7wAAAABJRU5ErkJggg==', 'base64');

test.use({ timezoneId: 'UTC' });

for (const surface of ['file control', 'drop', 'paste'] as const) {
  test(`Assets imports PNG through the rendered ${surface} and reloads the managed copy`, async ({ page }) => {
    await installSupportBridge(page);
    await gotoTestWorkspace(page, null, { projectCount: 2 });
    await navigateFromUserMenu(page, '素材库');
    const active = page.locator('.destination--active');
    await expect(active.getByRole('heading', { name: '暂无素材', exact: true })).toBeVisible();
    const name = `${surface.replace(' ', '-')}.png`;
    if (surface === 'file control') {
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: '导入', exact: true }).click();
      await (await chooser).setFiles({ name, mimeType: 'image/png', buffer: png });
    } else {
      await active.getByLabel('素材导入区域', { exact: true }).evaluate((element, input) => {
        const transfer = new DataTransfer();
        transfer.items.add(new File([Uint8Array.from(input.bytes)], input.name, { type: 'image/png' }));
        element.dispatchEvent(input.surface === 'drop'
          ? new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer })
          : new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }));
      }, { name, surface, bytes: Array.from(png) });
    }
    await expect(page.getByRole('status')).toHaveText('1 项已导入');
    const asset = active.getByRole('button', { name: `${name} · PNG · 1 × 1`, exact: true });
    await expect(asset).toBeVisible();
    expect((await readSupportCalls(page)).filter(({ method }) => method === 'importAssets')).toEqual([
      { method: 'importAssets', input: { libraryId, projectId, items: [{ name, mimeType: 'image/png', data: Array.from(png) }] } },
    ]);
    // User-menu navigation clears the canvas selection; the first of two projects is the current fallback.
    const beforeReload = (await readSupportCalls(page)).filter(({ method }) => method === 'listAssets').length;
    await page.reload();
    await navigateFromUserMenu(page, '素材库');
    await expect(asset).toBeVisible();
    expect((await readSupportCalls(page)).filter(({ method }) => method === 'listAssets').length).toBeGreaterThan(beforeReload);
    expect((await readSupportCalls(page)).filter(({ method }) => method === 'listAssets').every(({ input }) => JSON.stringify(input) === JSON.stringify({ libraryId, projectId }))).toBe(true);
    await asset.click();
    const details = page.getByRole('dialog', { name: '素材详情', exact: true });
    await expect(details.getByText('本机导入 · 受管副本', { exact: true })).toBeVisible();
    await expect(details.getByRole('img', { name, exact: true })).toBeVisible();
    const assetId = `asset-${createHash('sha256').update(png).digest('hex').slice(0, 16)}`;
    expect(await readSupportCalls(page)).toContainEqual({ method: 'readAsset', input: { libraryId, projectId, assetId } });
  });
}

test('Trash shows real entry metadata, restores, and respects purge confirmation across reload', async ({ page }) => {
  await installSupportBridge(page);
  await gotoTestWorkspace(page);
  await navigateFromUserMenu(page, '废纸篓与备份');
  const active = page.locator('.destination--active');
  const restoreRow = active.locator('.trash-row').filter({ hasText: supportTrash[0].projectId });
  await expect(restoreRow.getByText(supportTrash[0].projectId, { exact: true })).toBeVisible();
  await expect(restoreRow.getByText(supportTrash[0].originalRelativePath, { exact: true })).toBeVisible();
  await expect(restoreRow).toContainText('2026/10/14 08:09:10');
  await restoreRow.getByRole('button', { name: '恢复', exact: true }).click();
  await expect(restoreRow).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('项目已恢复');
  expect(await readSupportCalls(page)).toContainEqual({ method: 'restoreProject', input: { libraryId, projectId: supportTrash[0].projectId } });
  const purgeRow = active.locator('.trash-row').filter({ hasText: supportTrash[1].projectId });
  const cancel = page.waitForEvent('dialog').then(async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('永久删除此项目？');
    await dialog.dismiss();
  });
  await purgeRow.getByRole('button', { name: '删除', exact: true }).click();
  await cancel;
  await expect(purgeRow).toBeVisible();
  expect((await readSupportCalls(page)).filter(({ method }) => method === 'purgeProject')).toEqual([]);
  const confirm = page.waitForEvent('dialog').then(async (dialog) => { await dialog.accept(); });
  await purgeRow.getByRole('button', { name: '删除', exact: true }).click();
  await confirm;
  await expect(active.getByRole('heading', { name: '废纸篓为空', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('项目已删除');
  expect((await readSupportCalls(page)).filter(({ method }) => method === 'purgeProject')).toEqual([
    { method: 'purgeProject', input: { libraryId, projectId: supportTrash[1].projectId } },
  ]);
  const beforeReload = (await readSupportCalls(page)).filter(({ method }) => method === 'listTrash').length;
  await page.reload();
  await navigateFromUserMenu(page, '废纸篓与备份');
  await expect(active.getByRole('heading', { name: '废纸篓为空', exact: true })).toBeVisible();
  expect((await readSupportCalls(page)).filter(({ method }) => method === 'listTrash').length).toBeGreaterThan(beforeReload);
});

test('Backup persists destination and schedule, creates an artifact, and restores to a selected parent', async ({ page }) => {
  await installSupportBridge(page, { directories: [supportPaths.destination, supportPaths.artifact, supportPaths.restoreParent] });
  await gotoTestWorkspace(page);
  await navigateFromUserMenu(page, '废纸篓与备份');
  const active = page.locator('.destination--active');
  await active.getByRole('button', { name: '备份', exact: true }).click();
  await expect(active.getByRole('heading', { name: '尚未配置备份位置', exact: true })).toBeVisible();
  await active.getByRole('button', { name: '选择备份位置', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('备份位置已更新');
  await expect(active.getByText(supportPaths.destination, { exact: true })).toBeVisible();
  await active.getByRole('combobox', { name: '备份周期', exact: true }).click();
  await active.getByRole('option', { name: '每周', exact: true }).click();
  const preferences = { destinationParentDirectory: supportPaths.destination, schedule: 'weekly', lastRunAt: null, lastArtifactPath: null };
  expect(await readSupportCalls(page)).toContainEqual({ method: 'saveSettings', input: { libraryId, settings: { formatVersion: 1, backup: preferences } } });
  // Force hydration from the persisted host setting, independently of the renderer fallback.
  await page.evaluate(() => localStorage.removeItem('designhub.backup.library-e2e'));
  await page.reload();
  await navigateFromUserMenu(page, '废纸篓与备份');
  await active.getByRole('button', { name: '备份', exact: true }).click();
  await expect(active.getByText(supportPaths.destination, { exact: true })).toBeVisible();
  await expect(active.getByRole('combobox', { name: '备份周期', exact: true })).toHaveValue('weekly');
  await active.getByRole('button', { name: '创建备份', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('备份已创建');
  await expect(active.getByText(supportPaths.artifact, { exact: true })).toBeVisible();
  await expect(active.getByText('已验证', { exact: true })).toBeVisible();
  await expect(active).toContainText('2026/10/15 01:02:03');
  const completed = { ...preferences, lastRunAt: backupCreatedAt, lastArtifactPath: supportPaths.artifact };
  expect(await readSupportCalls(page)).toContainEqual({ method: 'createBackup', input: { libraryId, destinationParentDirectory: supportPaths.destination } });
  expect(await readSupportCalls(page)).toContainEqual({ method: 'saveSettings', input: { libraryId, settings: { formatVersion: 1, backup: completed } } });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('designhub.backup.library-e2e') ?? '{}'))).toEqual(completed);
  await active.getByRole('button', { name: '恢复备份', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(`备份已恢复到 ${supportPaths.restored}`);
  expect((await readSupportCalls(page)).filter(({ method }) => method === 'chooseDirectory' || method === 'restoreBackup')).toEqual([
    { method: 'chooseDirectory', input: 'destination' },
    { method: 'chooseDirectory', input: 'source' },
    { method: 'chooseDirectory', input: 'destination' },
    { method: 'restoreBackup', input: { backupDirectory: supportPaths.artifact, destinationParentDirectory: supportPaths.restoreParent } },
  ]);
});

test('Cancelled backup destination, restore source and restore destination leave no false notice or mutation', async ({ page }) => {
  await installSupportBridge(page, { directories: [null, null, supportPaths.artifact, null] });
  await gotoTestWorkspace(page);
  await navigateFromUserMenu(page, '废纸篓与备份');
  const active = page.locator('.destination--active');
  await active.getByRole('button', { name: '备份', exact: true }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
  for (const action of ['选择备份位置', '恢复备份', '恢复备份']) {
    const button = active.getByRole('button', { name: action, exact: true });
    await button.click();
    await expect(button).toBeEnabled();
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(active.getByRole('heading', { name: '尚未配置备份位置', exact: true })).toBeVisible();
  }
  expect((await readSupportCalls(page)).filter(({ method }) => ['saveSettings', 'createBackup', 'restoreBackup'].includes(method))).toEqual([]);
  expect((await readSupportCalls(page)).filter(({ method }) => method === 'chooseDirectory')).toEqual([
    { method: 'chooseDirectory', input: 'destination' }, { method: 'chooseDirectory', input: 'source' },
    { method: 'chooseDirectory', input: 'source' }, { method: 'chooseDirectory', input: 'destination' },
  ]);
});

test('Settings exports only redacted diagnostics, handles cancellation and persists theme/language offline', async ({ page, context }) => {
  await installSupportBridge(page, { diagnosticDestinations: [null, supportPaths.diagnostics] });
  await gotoTestWorkspace(page);
  await context.setOffline(true);
  await navigateFromUserMenu(page, '设置');
  const active = page.locator('.destination--active');
  await expect(active.getByRole('heading', { name: '外观', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await active.getByRole('button', { name: '导出', exact: true }).click();
  await expect.poll(async () => (await readSupportCalls(page)).filter(({ method }) => method === 'exportDiagnostics').length).toBe(1);
  await expect(page.getByRole('status')).toHaveCount(0);
  await active.getByRole('button', { name: '导出', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(`诊断包已导出到 ${supportPaths.diagnostics}`);
  expect((await readSupportCalls(page)).filter(({ method }) => method === 'exportDiagnostics')).toEqual([
    { method: 'exportDiagnostics', input: { runtime: 'Electron', errorCode: null } },
    { method: 'exportDiagnostics', input: { runtime: 'Electron', errorCode: null } },
  ]);
  await active.locator('label').filter({ has: page.getByRole('radio', { name: '深色', exact: true }) }).click();
  await expect(active.getByRole('radio', { name: '深色', exact: true })).toBeChecked();
  await active.getByRole('combobox', { name: '语言', exact: true }).click();
  await active.getByRole('option', { name: 'English', exact: true }).click();
  // Existing locale hydration returns to Projects; re-enter Settings through its current route.
  await expect(page.getByRole('heading', { name: 'Creative library', exact: true })).toBeVisible();
  await navigateFromUserMenu(page, 'Settings');
  await expect(active.getByRole('heading', { name: 'Appearance', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => ({ theme: localStorage.getItem('designhub.ui.theme'), locale: localStorage.getItem('designhub.ui.locale') }))).toEqual({ theme: 'dark', locale: 'en' });
  await context.setOffline(false);
  await page.reload();
  await context.setOffline(true);
  await navigateFromUserMenu(page, 'Settings');
  await expect(active.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await expect(active.getByRole('combobox', { name: 'Language', exact: true })).toHaveValue('en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
