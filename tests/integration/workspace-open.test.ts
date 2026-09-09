// @vitest-environment node

import { mkdtemp, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import { afterEach, expect, it } from 'vitest';

import { createWorkspace, openWorkspace, workspaceManifestName } from '../../src/desktop/storage/workspace-store';

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
