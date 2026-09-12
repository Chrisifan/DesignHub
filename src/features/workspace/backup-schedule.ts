import type { BackupSchedule } from './settings';

export type { BackupSchedule } from './settings';

const DAY_MS = 24 * 60 * 60 * 1000;

export const backupIntervalMs = (schedule: BackupSchedule): number | null => {
  if (schedule === 'daily') return DAY_MS;
  if (schedule === 'weekly') return DAY_MS * 7;
  return null;
};

export const shouldRunScheduledBackup = (input: { schedule: BackupSchedule; lastRunAt: string | null; now: number }): boolean => {
  const interval = backupIntervalMs(input.schedule);
  if (interval === null) return false;
  if (!input.lastRunAt) return true;
  const lastRun = Date.parse(input.lastRunAt);
  return !Number.isFinite(lastRun) || input.now - lastRun >= interval;
};
