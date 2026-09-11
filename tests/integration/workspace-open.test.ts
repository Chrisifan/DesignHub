// @vitest-environment node

import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, realpath, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import { afterEach, expect, it } from 'vitest';

import { createWorkspace, openWorkspace, workspaceManifestName, workspaceMigrationStateName } from '../../src/desktop/storage/workspace-store';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'designhub-workspace-'));
  temporaryDirectories.push(directory);
  return directory;
};

const waitForChildLock = async (child: ReturnType<typeof spawn>): Promise<string> => new Promise((resolvePromise, rejectPromise) => {
  const timeout = setTimeout(() => rejectPromise(new Error('LOCK_CHILD_TIMEOUT')), 5_000);
  const finish = (action: () => void) => {
    clearTimeout(timeout);
    action();
  };
  child.once('error', (error) => finish(() => rejectPromise(error)));
  child.stdout?.once('data', (output) => finish(() => resolvePromise(String(output))));
});

const sha256 = (content: string): string => createHash('sha256').update(content).digest('hex');

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

it('creates a movable workspace with stable identity under a Chinese path', async () => {
  const parent = await createTemporaryDirectory();
  const nestedParent = join(parent, '设计 工作区');
  await mkdir(nestedParent);
  const workspaceName = `春季物料 ${'长名称'.repeat(24)}`;
  const created = await createWorkspace({ parentDirectory: nestedParent, name: workspaceName });
  await writeFile(join(created.workspace.directory, 'projects', 'project-list-marker.json'), '[]');
  created.close();

  const movedDirectory = join(parent, '已移动 工作区');
  await rename(created.workspace.directory, movedDirectory);
  const reopened = await openWorkspace(movedDirectory);

  expect(reopened.workspace).toMatchObject({ workspaceId: created.workspace.workspaceId, directory: await realpath(movedDirectory), openMode: 'writable' });
  await expect(readFile(join(reopened.workspace.directory, 'projects', 'project-list-marker.json'), 'utf8')).resolves.toBe('[]');
  reopened.close();
});

it('does not overwrite an existing ordinary directory', async () => {
  const parent = await createTemporaryDirectory();
  const existing = join(parent, '已有目录');
  await mkdir(existing);
  await writeFile(join(existing, '用户文件.txt'), 'keep');

  await expect(createWorkspace({ parentDirectory: parent, name: '已有目录' })).rejects.toThrow('WORKSPACE_EXISTS');
  await expect(readFile(join(existing, '用户文件.txt'), 'utf8')).resolves.toBe('keep');
  await expect(createWorkspace({ parentDirectory: parent, name: '../escape' })).rejects.toThrow('INVALID_WORKSPACE_NAME');
  await expect(createWorkspace({ parentDirectory: parent, name: 'CON' })).rejects.toThrow('INVALID_WORKSPACE_NAME');
});

it('allows only one writer and releases the lock when the owner closes', async () => {
  const parent = await createTemporaryDirectory();
  const first = await createWorkspace({ parentDirectory: parent, name: '锁测试' });
  const second = await openWorkspace(first.workspace.directory);

  expect(first.workspace.openMode).toBe('writable');
  expect(second.workspace.openMode).toBe('read-only');
  second.close();
  first.close();

  const third = await openWorkspace(first.workspace.directory);
  expect(third.workspace.openMode).toBe('writable');
  third.close();
});

it('opens a newer manifest read-only without taking the writer lock', async () => {
  const parent = await createTemporaryDirectory();
  const created = await createWorkspace({ parentDirectory: parent, name: '未来格式' });
  created.close();
  const manifestPath = join(created.workspace.directory, workspaceManifestName);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
  await writeFile(manifestPath, `${JSON.stringify({ ...manifest, formatVersion: 2 }, null, 2)}\n`);

  const first = await openWorkspace(created.workspace.directory, 1);
  const second = await openWorkspace(created.workspace.directory, 1);
  const writer = await openWorkspace(created.workspace.directory, 2);

  expect(first.workspace.openMode).toBe('read-only');
  expect(second.workspace.openMode).toBe('read-only');
  expect(second.workspace.workspaceId).toBe(first.workspace.workspaceId);
  expect(writer.workspace.openMode).toBe('writable');
  first.close();
  second.close();
  writer.close();
});

it('opens a newer manifest read-only without recovering migration markers', async () => {
  const parent = await createTemporaryDirectory();
  const created = await createWorkspace({ parentDirectory: parent, name: '未来迁移标记' });
  created.close();
  const manifestPath = join(created.workspace.directory, workspaceManifestName);
  const originalManifest = await readFile(manifestPath, 'utf8');
  const original = JSON.parse(originalManifest) as Record<string, unknown>;
  const migrationId = randomUUID();
  const nextManifest = `${JSON.stringify({ ...original, formatVersion: 2 }, null, 2)}\n`;
  const statePath = join(created.workspace.directory, '.designhub', workspaceMigrationStateName);
  const temporaryPath = join(created.workspace.directory, `.${workspaceManifestName}.migration-${migrationId}`);
  const rollbackPath = join(created.workspace.directory, `.${workspaceManifestName}.rollback-${migrationId}`);
  await writeFile(statePath, `${JSON.stringify({
    kind: 'designhub-workspace-migration',
    migrationId,
    workspaceId: original.workspaceId,
    fromFormatVersion: 1,
    toFormatVersion: 2,
    originalManifestSha256: sha256(originalManifest),
  }, null, 2)}\n`);
  await writeFile(temporaryPath, nextManifest);
  await writeFile(rollbackPath, originalManifest);
  await writeFile(manifestPath, nextManifest);

  const opened = await openWorkspace(created.workspace.directory, 1);

  expect(opened.workspace.openMode).toBe('read-only');
  await expect(readFile(statePath, 'utf8')).resolves.toContain(migrationId);
  await expect(readFile(temporaryPath, 'utf8')).resolves.toBe(nextManifest);
  await expect(readFile(rollbackPath, 'utf8')).resolves.toBe(originalManifest);
  opened.close();
});

it('rejects unsupported missing-manifest migration recovery without mutating markers', async () => {
  const parent = await createTemporaryDirectory();
  const created = await createWorkspace({ parentDirectory: parent, name: '未知迁移中断' });
  created.close();
  const manifestPath = join(created.workspace.directory, workspaceManifestName);
  const originalManifest = await readFile(manifestPath, 'utf8');
  const original = JSON.parse(originalManifest) as Record<string, unknown>;
  const migrationId = randomUUID();
  const statePath = join(created.workspace.directory, '.designhub', workspaceMigrationStateName);
  const rollbackPath = join(created.workspace.directory, `.${workspaceManifestName}.rollback-${migrationId}`);
  await writeFile(statePath, `${JSON.stringify({
    kind: 'designhub-workspace-migration',
    migrationId,
    workspaceId: original.workspaceId,
    fromFormatVersion: 1,
    toFormatVersion: 2,
    originalManifestSha256: sha256(originalManifest),
  }, null, 2)}\n`);
  await writeFile(rollbackPath, originalManifest);
  await unlink(manifestPath);

  await expect(openWorkspace(created.workspace.directory, 1)).rejects.toThrow('WORKSPACE_MIGRATION_REQUIRES_NEWER_VERSION');
  expect(existsSync(manifestPath)).toBe(false);
  await expect(readFile(statePath, 'utf8')).resolves.toContain(migrationId);
  await expect(readFile(rollbackPath, 'utf8')).resolves.toBe(originalManifest);
  await expect(readdir(created.workspace.directory)).resolves.toContain(`.${workspaceManifestName}.rollback-${migrationId}`);
});

it('releases the operating-system writer lock after the owning process crashes', async () => {
  const parent = await createTemporaryDirectory();
  const created = await createWorkspace({ parentDirectory: parent, name: '崩溃恢复' });
  created.close();
  const lockPath = join(created.workspace.directory, '.designhub', 'writer-lock.sqlite');
  const childSource = [
    "const Database = require('better-sqlite3');",
    "const database = new Database(process.argv[1], { fileMustExist: true, timeout: 0 });",
    "database.pragma('journal_mode = DELETE');",
    "database.pragma('locking_mode = EXCLUSIVE');",
    "database.exec('BEGIN EXCLUSIVE');",
    "process.stdout.write('locked\\n');",
    "setInterval(() => {}, 1000);",
  ].join('\n');
  const child = spawn(process.execPath, ['-e', childSource, lockPath], { stdio: ['ignore', 'pipe', 'pipe'] });

  try {
    expect(await waitForChildLock(child)).toContain('locked');
    const blocked = await openWorkspace(created.workspace.directory);
    expect(blocked.workspace.openMode).toBe('read-only');
    blocked.close();
  } finally {
    child.kill('SIGKILL');
    await once(child, 'exit');
  }

  const recovered = await openWorkspace(created.workspace.directory);
  expect(recovered.workspace.openMode).toBe('writable');
  recovered.close();
});

it('does not clean writable staging while an older format requires migration', async () => {
  const parent = await createTemporaryDirectory();
  const created = await createWorkspace({ parentDirectory: parent, name: '待迁移' });
  created.close();
  const staging = join(created.workspace.directory, 'projects', '.00000000-0000-4000-8000-000000000000.creating-00000000-0000-4000-8000-000000000001');
  await mkdir(staging);

  const migration = await openWorkspace(created.workspace.directory, 2);
  expect(migration.workspace.openMode).toBe('migration-required');
  expect(await realpath(staging)).toBe(staging);
  migration.close();
});

it('releases the writer lock when writable staging cleanup fails', async () => {
  const parent = await createTemporaryDirectory();
  const created = await createWorkspace({ parentDirectory: parent, name: '清理失败' });
  created.close();
  const projectsDirectory = join(created.workspace.directory, 'projects');
  await rm(projectsDirectory, { recursive: true });

  await expect(openWorkspace(created.workspace.directory)).rejects.toThrow('ENOENT');
  await mkdir(projectsDirectory);

  const reopened = await openWorkspace(created.workspace.directory);
  expect(reopened.workspace.openMode).toBe('writable');
  reopened.close();
});

it('rejects project storage when the workspace manifest changes after opening', async () => {
  const parent = await createTemporaryDirectory();
  const workspace = await createWorkspace({ parentDirectory: parent, name: '格式漂移' });
  const manifestPath = join(workspace.workspace.directory, workspaceManifestName);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
  await writeFile(manifestPath, `${JSON.stringify({ ...manifest, formatVersion: 2 }, null, 2)}\n`);

  const { createProjectStore } = await import('../../src/desktop/storage/project-store');
  await expect(createProjectStore(workspace).createProjectContainer({
    workspaceId: workspace.workspace.workspaceId,
    operationId: 'format-drift',
    name: 'Format drift',
  })).rejects.toThrow('WORKSPACE_FORMAT_CHANGED');
  workspace.close();
});
