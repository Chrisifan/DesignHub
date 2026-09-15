import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** @typedef {{ name: string, status: 'passed'|'failed'|'blocked', exitCode?: number, elapsedMs?: number, reason?: string }} ReleaseCheckEntry */
/** @typedef {{ status: 'passed'|'failed'|'passed-with-blockers', platform: string, node: string, commands: ReleaseCheckEntry[], packageScan: object, externalGates: ReleaseCheckEntry[] }} ReleaseCheckResult */

const localCommands = [
  ['test:unit', ['test:unit']],
  ['test:integration', ['test:integration']],
  ['test:e2e', ['test:e2e']],
  ['test:native', ['test:native']],
  ['lint', ['lint']],
  ['typecheck', ['typecheck']],
  ['build', ['build']],
];

export const getReleaseCommands = (runPackage = false) => [
  ...localCommands,
  ...(runPackage ? [['package', ['package']]] : []),
  ['diff-check', ['git', 'diff', '--check']],
];

export const run = (name, args, env = process.env) => {
  const started = Date.now();
  const child = spawnSync('pnpm', args, { stdio: 'inherit', env });
  return { name, status: child.status === 0 ? 'passed' : 'failed', exitCode: child.status ?? 1, elapsedMs: Date.now() - started };
};

const walk = (directory) => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
};

const credentialPathPattern = /(?:credentials?|secret|token|api[-_]?key|password)/iu;
const credentialValuePattern = /(?:sk|rk)-[A-Za-z0-9_-]{16,}|(?:api[-_]?key|token|secret|password)\s*[:=]\s*["'][^"']{8,}["']|Bearer\s+[A-Za-z0-9._-]{16,}/iu;
const textExtensions = new Set(['.js', '.cjs', '.mjs', '.ts', '.json', '.css', '.html', '.txt', '.map']);

export const scanPackageArtifacts = (roots = ['out', '.vite']) => {
  const files = roots.flatMap((root) => walk(resolve(root)));
  const suspicious = [];
  for (const file of files) {
    const relativePath = relative(process.cwd(), file);
    if (credentialPathPattern.test(relativePath)) {
      suspicious.push(relativePath);
      continue;
    }
    try {
      const stats = statSync(file);
      const extension = relativePath.slice(relativePath.lastIndexOf('.')).toLowerCase();
      if (textExtensions.has(extension) && stats.size <= 8 * 1024 * 1024 && credentialValuePattern.test(readFileSync(file, 'utf8'))) suspicious.push(relativePath);
    } catch {
      suspicious.push(relativePath);
    }
  }
  return {
    name: 'package-scan',
    status: suspicious.length === 0 ? 'passed' : 'failed',
    filesScanned: files.length,
    ...(suspicious.length > 0 ? { suspiciousPaths: suspicious } : {}),
  };
};

export const getExternalGates = (env = process.env, platform = process.platform) => {
  const gates = [];
  if (platform !== 'win32') gates.push({ name: 'windows-packaged', status: 'blocked', reason: 'Requires a Windows host.' });
  if (!(env.CSC_LINK || env.WIN_CSC_LINK)) gates.push({ name: 'signed-artifacts', status: 'blocked', reason: 'Signing certificate credentials are not configured.' });
  if (platform === 'darwin' && !(env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID)) {
    gates.push({ name: 'notarized-artifacts', status: 'blocked', reason: 'macOS notarization credentials are not configured.' });
  }
  const providerVars = ['DESIGNHUB_PROVIDER_BASE_URL', 'DESIGNHUB_PROVIDER_API_KEY', 'DESIGNHUB_CONVERSATION_MODEL', 'DESIGNHUB_IMAGE_MODEL'];
  if (env.DESIGNHUB_LIVE_PROVIDER !== '1') {
    gates.push({ name: 'live-provider', status: 'blocked', reason: 'Live provider smoke is opt-in.' });
  } else {
    const missing = providerVars.filter((key) => !env[key]);
    if (missing.length > 0) gates.push({ name: 'live-provider', status: 'blocked', reason: `Missing live provider variables: ${missing.join(', ')}.` });
  }
  if (!env.DESIGNHUB_PACKAGED_APP_PATH || !existsSync(env.DESIGNHUB_PACKAGED_APP_PATH)) {
    gates.push({ name: 'packaged-native', status: 'blocked', reason: 'Set DESIGNHUB_PACKAGED_APP_PATH to an existing packaged executable.' });
  }
  if (env.DESIGNHUB_KEYCHAIN_VERIFIED !== '1') {
    gates.push({ name: 'keychain-persistence', status: 'blocked', reason: 'Requires explicit native OS Keychain persistence evidence.' });
  }
  if (env.DESIGNHUB_INSTALL_UPGRADE_VERIFIED !== '1') {
    gates.push({ name: 'installer-upgrade', status: 'blocked', reason: 'Requires documented macOS/Windows install, upgrade and uninstall evidence.' });
  }
  return gates;
};

export const buildReleaseCheckReport = (commands, options = {}) => {
  const platform = options.platform ?? process.platform;
  const node = options.node ?? process.version;
  const env = options.env ?? process.env;
  const packageScan = options.packageScan ?? scanPackageArtifacts();
  const externalGates = options.externalGates ?? getExternalGates(env, platform);
  const localFailed = commands.some((entry) => entry.status === 'failed') || packageScan.status === 'failed';
  return {
    status: localFailed ? 'failed' : externalGates.length > 0 ? 'passed-with-blockers' : 'passed',
    platform,
    node,
    commands,
    packageScan,
    externalGates,
  };
};

const main = () => {
  const runPackage = process.argv.includes('--package') || process.env.DESIGNHUB_RUN_PACKAGE === '1';
  const commands = getReleaseCommands(runPackage).map(([name, args]) => run(name, args));
  const report = buildReleaseCheckReport(commands);
  process.stdout.write(`\n${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === 'failed' ? 1 : 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
