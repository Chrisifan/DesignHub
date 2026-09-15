export type ReleaseCheckStatus = 'passed' | 'failed' | 'blocked';

export type ReleaseCheckEntry = {
  name: string;
  status: ReleaseCheckStatus;
  exitCode?: number;
  elapsedMs?: number;
  reason?: string;
};

export type ReleaseCheckResult = {
  status: 'passed' | 'failed' | 'passed-with-blockers';
  platform: string;
  node: string;
  commands: ReleaseCheckEntry[];
  packageScan: {
    name: 'package-scan';
    status: 'passed' | 'failed';
    filesScanned: number;
    suspiciousPaths?: string[];
  };
  externalGates: ReleaseCheckEntry[];
};
