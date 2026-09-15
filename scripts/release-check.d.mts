export type ReleaseCheckStatus = 'passed' | 'failed' | 'passed-with-blockers';
export type ReleaseCheckEntry = {
  name: string;
  status: 'passed' | 'failed' | 'blocked';
  exitCode?: number;
  elapsedMs?: number;
  reason?: string;
};
export type ReleaseCheckResult = {
  status: ReleaseCheckStatus;
  platform: string;
  node: string;
  commands: ReleaseCheckEntry[];
  packageScan: { name: string; status: 'passed' | 'failed'; filesScanned: number; suspiciousPaths?: string[] };
  externalGates: ReleaseCheckEntry[];
};
export function getReleaseCommands(runPackage?: boolean): Array<[string, string[]]>;
export function scanPackageArtifacts(roots?: string[]): ReleaseCheckResult['packageScan'];
export function getExternalGates(env?: NodeJS.ProcessEnv, platform?: string): ReleaseCheckEntry[];
export function buildReleaseCheckReport(commands: ReleaseCheckEntry[], options?: {
  platform?: string;
  node?: string;
  env?: NodeJS.ProcessEnv;
  packageScan?: ReleaseCheckResult['packageScan'];
  externalGates?: ReleaseCheckEntry[];
}): ReleaseCheckResult;
