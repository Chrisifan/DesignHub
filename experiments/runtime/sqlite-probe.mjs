// Disposable engine probe. This is not a Tauri SQL-plugin or production-code test.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync, backup } from 'node:sqlite';

const root = mkdtempSync(join(tmpdir(), 'designhub-sqlite-'));
const project = join(root, '中文工作区', '项目 A');
mkdirSync(project, { recursive: true });
const databasePath = join(project, 'project.sqlite');
const db = new DatabaseSync(databasePath);
const results = [];
const run = async (id, check) => {
  await check();
  results.push({ id, status: 'pass' });
};
const contentHash = (connection) => createHash('sha256')
  .update(JSON.stringify(connection.prepare('SELECT * FROM revisions ORDER BY id').all()))
  .digest('hex');

try {
  await run('P01a-unicode-path-live-wal-backup', async () => {
    assert.equal(db.prepare('PRAGMA journal_mode=WAL').get().journal_mode, 'wal');
    db.exec('PRAGMA wal_autocheckpoint=0; CREATE TABLE revisions (id INTEGER PRIMARY KEY, label TEXT NOT NULL); PRAGMA user_version=1;');
    db.prepare('INSERT INTO revisions(label) VALUES (?)').run('中文署名 · 设计稿');
    assert.ok(existsSync(`${databasePath}-wal`));
    const expected = contentHash(db);
    const backupPath = join(root, 'consistent-backup.sqlite');
    await backup(db, backupPath);
    const restored = new DatabaseSync(backupPath);
    try {
      assert.equal(contentHash(restored), expected);
      assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally {
      restored.close();
    }
  });

  await run('P01b-failed-migration-rollback', () => {
    const before = contentHash(db);
    db.exec('BEGIN IMMEDIATE; ALTER TABLE revisions ADD COLUMN incomplete TEXT; PRAGMA user_version=2;');
    assert.throws(() => db.exec('INSERT INTO missing_table VALUES (1)'));
    db.exec('ROLLBACK');
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
    assert.equal(db.prepare('PRAGMA table_info(revisions)').all().some((column) => column.name === 'incomplete'), false);
    assert.equal(contentHash(db), before);
  });

  await run('P01c-abrupt-migration-process-exit', () => {
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { DatabaseSync } from 'node:sqlite';
      const connection = new DatabaseSync(process.argv[1]);
      connection.exec('BEGIN IMMEDIATE; ALTER TABLE revisions ADD COLUMN interrupted TEXT; PRAGMA user_version=3;');
      process.exit(17);
    `, databasePath], { encoding: 'utf8' });
    assert.equal(child.status, 17, child.stderr);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
    assert.equal(db.prepare('PRAGMA table_info(revisions)').all().some((column) => column.name === 'interrupted'), false);
  });

  await run('P02-two-connection-write-contention', () => {
    const other = new DatabaseSync(databasePath);
    try {
      other.exec('PRAGMA busy_timeout=0');
      db.exec('BEGIN IMMEDIATE');
      assert.throws(() => other.exec("INSERT INTO revisions(label) VALUES ('blocked')"), /locked/);
      db.exec('ROLLBACK');
      other.exec("INSERT INTO revisions(label) VALUES ('after-release')");
    } finally {
      other.close();
    }
  });

  await run('P03-cross-connection-rollback-counterexample', () => {
    const other = new DatabaseSync(databasePath);
    try {
      db.exec('BEGIN');
      other.exec("INSERT INTO revisions(label) VALUES ('outside-transaction')");
      db.exec('ROLLBACK');
      assert.equal(db.prepare("SELECT COUNT(*) AS count FROM revisions WHERE label='outside-transaction'").get().count, 1);
    } finally {
      other.close();
    }
  });

  const expected = contentHash(db);
  db.close();
  await run('P01d-move-closed-project-and-reopen', () => {
    const moved = join(root, '移动后的项目 B');
    renameSync(project, moved);
    const reopened = new DatabaseSync(join(moved, 'project.sqlite'));
    try {
      assert.equal(contentHash(reopened), expected);
      assert.equal(reopened.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally {
      reopened.close();
    }
  });
  console.log(JSON.stringify({
    probe: 'SQLite engine only; not Tauri plugin',
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    root,
    results,
    retained: 'Disposable synthetic database files retained for inspection; no user data accessed.',
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ root, results, failure: error.message }, null, 2));
  process.exitCode = 1;
}
