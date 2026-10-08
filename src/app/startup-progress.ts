export type StartupCheckStatus = 'pending' | 'active' | 'complete' | 'error';

export type StartupCheck = {
  id: string;
  status: StartupCheckStatus;
};

export const getStartupProgress = (checks: readonly StartupCheck[]): number => {
  if (checks.length === 0) return 100;
  const settled = checks.filter((check) => check.status === 'complete' || check.status === 'error').length;
  return Math.round((settled / checks.length) * 100);
};
