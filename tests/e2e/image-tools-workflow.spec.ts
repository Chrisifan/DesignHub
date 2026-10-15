import { expect, test } from 'playwright/test';

import type { ImageToolJobSnapshot } from '../../src/platform/contracts';
import { createImageToolJobFixture } from '../fixtures/image-tool-job';
import { gotoTestWorkspace, navigateFromUserMenu } from './test-workspace';
import { imageToolPaths, installImageToolBridge, publishImageToolSnapshot, readImageToolCalls } from './image-tools-workspace';

const libraryId = 'library-e2e';
const params = { width: 640, height: 480, fit: 'contain', format: 'png', background: '#ffffff' };
const createSnapshot = (): ImageToolJobSnapshot => {
  const snapshot = createImageToolJobFixture({
    id: 'persisted-resize-browser-job', libraryId, tool: 'resize', params,
    sourceRoot: imageToolPaths.source,
    outputRoot: `${imageToolPaths.output}/${imageToolPaths.folder}`,
    resultFolderName: imageToolPaths.folder, createdFrom: 'directory',
  }, { id: 'persisted-first-item', relativePath: 'portrait.png' });
  snapshot.items.push({ ...snapshot.items[0], id: 'persisted-second-item', relativePath: 'nested/product.png' });
  snapshot.job.itemIds = snapshot.items.map((item) => item.id);
  return snapshot;
};

for (const [tool, title, provider] of [
  ['remove-background', '去除背景', true],
  ['upscale', '放大图像', true],
  ['resize', '尺寸转换', false],
  ['format-convert', '格式转换', false],
] as const) {
  test(`user menu opens the production ${tool} batch page`, async ({ page }) => {
    await gotoTestWorkspace(page);
    await installImageToolBridge(page, createSnapshot());
    await navigateFromUserMenu(page, title);
    const active = page.locator('.destination--active');
    await expect(active.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(active.getByRole('combobox', { name: '批量工具', exact: true })).toHaveValue(tool);
    await expect(active.getByRole('heading', { name: '暂无图像作业' })).toBeVisible();
    await active.getByRole('button', { name: '新建作业 / 选择文件', exact: true }).click();
    const composer = page.getByRole('dialog', { name: `新建作业 · ${title}`, exact: true });
    await expect(composer).toBeVisible();
    await expect(composer.getByRole('combobox', { name: '模型连接', exact: true })).toHaveCount(provider ? 1 : 0);
    if (provider) await expect(composer.getByRole('combobox', { name: '模型连接', exact: true })).toHaveValue('openai-compatible');
    else await expect(composer.getByRole('combobox', { name: '输出格式', exact: true })).toBeVisible();
  });
}

test('local resize scans, creates, refreshes and opens/reveals/imports persisted results', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoTestWorkspace(page);
  const snapshot = createSnapshot();
  await installImageToolBridge(page, snapshot);
  await navigateFromUserMenu(page, '尺寸转换');
  const active = page.locator('.destination--active');
  await active.getByRole('button', { name: '新建作业 / 选择文件', exact: true }).click();
  const composer = page.getByRole('dialog', { name: '新建作业 · 尺寸转换', exact: true });
  const create = composer.getByRole('button', { name: '创建作业', exact: true });
  await expect(create).toBeDisabled();
  await expect(composer.getByRole('button', { name: '扫描来源', exact: true })).toBeDisabled();
  await composer.getByRole('button', { name: '选择文件 / 文件夹', exact: true }).click();
  await expect(composer.getByText('来源：Browser source', { exact: true })).toBeVisible();
  await composer.getByRole('button', { name: '选择输出位置', exact: true }).click();
  await expect(composer.getByRole('button', { name: '输出：Browser output', exact: true })).toBeVisible();
  await composer.getByRole('textbox', { name: '结果文件夹名', exact: true }).fill(imageToolPaths.folder);
  await composer.getByRole('spinbutton', { name: '宽度', exact: true }).fill('640');
  await composer.getByRole('spinbutton', { name: '高度', exact: true }).fill('480');
  await expect(create).toBeDisabled();
  await composer.getByRole('button', { name: '扫描来源', exact: true }).click();
  await expect(composer.getByText('2 个文件可处理', { exact: true })).toBeVisible();
  await expect(composer.getByText('notes.txt: Unsupported image format', { exact: true })).toBeVisible();
  await expect(create).toBeEnabled();
  await create.click();
  await expect(composer).toBeHidden();
  const progress = active.getByRole('progressbar', { name: '作业完成进度' });
  await expect(progress).toHaveAttribute('aria-valuetext', '0 / 2');
  await expect(active.getByRole('button', { name: 'portrait.png', exact: true })).toContainText('等待处理队列');
  const input = { libraryId, tool: 'resize', params, sourcePath: imageToolPaths.source, outputRoot: imageToolPaths.output, resultFolderName: imageToolPaths.folder };
  const calls = await readImageToolCalls(page);
  expect(calls.filter(({ method }) => method === 'chooseInput' || method === 'chooseOutput')).toEqual([
    { method: 'chooseInput', input: null }, { method: 'chooseOutput', input: null },
  ]);
  expect(calls.find(({ method }) => method === 'scan')?.input).toEqual(input);
  // The current page supplies its configured connection even for local tools;
  // the persisted executor remains local, as supplied by the desktop boundary.
  expect(calls.find(({ method }) => method === 'create')?.input).toEqual({ ...input, connectionId: 'openai-compatible' });
  const createIndex = calls.findIndex(({ method }) => method === 'create');
  expect(calls.slice(createIndex + 1)).toContainEqual({ method: 'list', input: libraryId });

  const completedAt = '2026-10-15T00:01:00.000Z';
  snapshot.items = snapshot.items.map((item) => ({
    ...item, state: 'completed', resultPath: `${snapshot.job.outputRoot}/${item.relativePath}`,
    resultWidth: 640, resultHeight: 480, resultFormat: 'png', resultBytes: 2048,
    resultHasAlpha: true, startedAt: completedAt, completedAt, updatedAt: completedAt,
  }));
  snapshot.job.updatedAt = completedAt;
  const beforeRefresh = (await readImageToolCalls(page)).filter(({ method }) => method === 'list').length;
  await publishImageToolSnapshot(page, snapshot);
  await expect(progress).toHaveAttribute('aria-valuetext', '2 / 2');
  expect((await readImageToolCalls(page)).filter(({ method }) => method === 'list').length).toBeGreaterThan(beforeRefresh);
  await expect(active.getByRole('button', { name: '新建作业 / 选择文件', exact: true })).toBeVisible();
  await expect(active.getByRole('button', { name: 'portrait.png', exact: true })).toContainText('640 × 480');
  await active.getByRole('button', { name: '打开结果目录', exact: true }).click();
  await active.getByRole('button', { name: 'portrait.png', exact: true }).click();
  const detail = page.getByRole('dialog', { name: 'portrait.png', exact: true });
  await expect(detail).toBeVisible();
  const path = snapshot.items[0].resultPath!;
  await expect(detail.getByRole('img', { name: '生成结果' })).toBeVisible();
  await expect(detail.getByText(path, { exact: true })).toHaveCount(2);
  await expect(detail.getByText('第 1 次尝试', { exact: true })).toBeVisible();
  for (const name of ['打开结果', '显示位置', '导入素材库']) await detail.getByRole('button', { name, exact: true }).click();
  const resultInput = { libraryId, jobId: snapshot.job.id, path };
  await expect.poll(async () => (await readImageToolCalls(page)).filter(({ method }) => ['open', 'reveal', 'import'].includes(method))).toEqual([
    { method: 'open', input: resultInput },
    { method: 'reveal', input: resultInput },
    // Studio currently falls back to the first existing project on this route.
    { method: 'import', input: { ...resultInput, projectId: 'project-e2e' } },
  ]);
  expect(await readImageToolCalls(page)).toContainEqual({ method: 'read', input: resultInput });
  expect(await readImageToolCalls(page)).toContainEqual({ method: 'openOutput', input: { ...resultInput, path: snapshot.job.outputRoot } });
  await detail.getByRole('button', { name: '关闭', exact: true }).click();
  await active.getByRole('button', { name: '新建作业 / 选择文件', exact: true }).click();
  await expect(composer).toBeVisible();
});

test('lifecycle controls refresh paused/resumed/cancelled jobs and retry failed and unknown items', async ({ page }) => {
  await gotoTestWorkspace(page);
  const snapshot = createSnapshot();
  // A separate persisted recovery job carries failed/unknown items; cancelling
  // the first job never fabricates failures or undoes terminal item states.
  const recovery = createSnapshot();
  recovery.job.id = 'persisted-recovery-browser-job';
  recovery.job.state = 'unknown';
  recovery.items = recovery.items.map((item, index) => ({
    ...item, id: `recovery-${index}`, jobId: recovery.job.id,
    relativePath: index === 0 ? 'recovery-failed.png' : 'recovery-unknown.png',
    state: index === 0 ? 'failed' : 'unknown',
    errorCode: index === 0 ? 'IMAGE_DECODE_FAILED' : 'RESULT_UNKNOWN_AFTER_RESTART',
  }));
  recovery.job.itemIds = recovery.items.map((item) => item.id);
  await installImageToolBridge(page, snapshot, [snapshot, recovery]);
  await navigateFromUserMenu(page, '尺寸转换');
  const active = page.locator('.destination--active');
  await active.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(active.getByRole('button', { name: '继续', exact: true })).toBeVisible();
  await active.getByRole('button', { name: '继续', exact: true }).click();
  await expect(active.getByRole('button', { name: '暂停', exact: true })).toBeVisible();
  await active.getByRole('button', { name: '取消', exact: true }).click();
  await expect(active.getByRole('button', { name: 'portrait.png', exact: true })).toContainText('用户手动取消');
  await expect(active.getByRole('button', { name: '暂停', exact: true })).toHaveCount(0);
  const jobInput = { libraryId, jobId: snapshot.job.id };
  expect((await readImageToolCalls(page)).filter(({ method }) => ['pause', 'resume', 'cancel'].includes(method))).toEqual([
    { method: 'pause', input: jobInput }, { method: 'resume', input: jobInput }, { method: 'cancel', input: jobInput },
  ]);
  await active.getByRole('complementary', { name: '图像作业', exact: true })
    .getByRole('button', { name: /^recover/ }).click();
  for (const item of recovery.items) {
    await expect(active.getByRole('button', { name: item.relativePath, exact: true })).toHaveClass(new RegExp(`is-${item.state}`));
    await active.getByRole('button', { name: item.relativePath, exact: true }).click();
    const detail = page.getByRole('dialog', { name: item.relativePath, exact: true });
    await expect(detail.getByText('第 1 次尝试', { exact: true })).toBeVisible();
    await detail.getByRole('button', { name: '重试', exact: true }).click();
    await expect(detail.getByText('第 2 次尝试', { exact: true })).toBeVisible();
    await expect(detail.getByRole('button', { name: '重试', exact: true })).toHaveCount(0);
    await detail.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(active.getByRole('button', { name: item.relativePath, exact: true })).toContainText('等待处理队列');
  }
  expect((await readImageToolCalls(page)).filter(({ method }) => method === 'retry')).toEqual(recovery.items.map((item) => ({
    method: 'retry', input: { libraryId, jobId: recovery.job.id, itemId: item.id },
  })));
});
