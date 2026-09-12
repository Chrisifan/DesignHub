import { expect, it } from 'vitest';

import { backupIntervalMs, shouldRunScheduledBackup, type BackupSchedule } from './backup-schedule';

it('maps manual, daily and weekly backup schedules to explicit intervals', () => {
  expect(backupIntervalMs('manual')).toBeNull();
  expect(backupIntervalMs('daily')).toBe(24 * 60 * 60 * 1000);
  expect(backupIntervalMs('weekly')).toBe(7 * 24 * 60 * 60 * 1000);
});

it('runs a scheduled backup only after its interval has elapsed', () => {
  const now = Date.parse('2026-09-13T12:00:00.000Z');
  expect(shouldRunScheduledBackup({ schedule: 'daily', lastRunAt: null, now })).toBe(true);
  expect(shouldRunScheduledBackup({ schedule: 'daily', lastRunAt: '2026-09-13T11:00:00.000Z', now })).toBe(false);
  expect(shouldRunScheduledBackup({ schedule: 'daily', lastRunAt: '2026-09-12T12:00:00.000Z', now })).toBe(true);
  expect(shouldRunScheduledBackup({ schedule: 'manual' as BackupSchedule, lastRunAt: null, now })).toBe(false);
});
