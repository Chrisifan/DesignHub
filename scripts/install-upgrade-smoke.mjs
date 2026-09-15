import { existsSync, readFileSync } from 'node:fs';

const print = (payload) => process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
const platformSupported = process.platform === 'darwin' || process.platform === 'win32';
const markerPath = process.env.DESIGNHUB_INSTALL_UPGRADE_MARKER ?? '';

if (process.env.DESIGNHUB_INSTALL_SMOKE !== '1') {
  print({ status: 'blocked', reason: 'Set DESIGNHUB_INSTALL_SMOKE=1 and provide a manual installer evidence marker.' });
  process.exitCode = 2;
} else if (!platformSupported) {
  print({ status: 'blocked', reason: 'Installer smoke requires a macOS or Windows host.' });
  process.exitCode = 2;
} else if (!markerPath || !existsSync(markerPath)) {
  print({ status: 'blocked', reason: 'Set DESIGNHUB_INSTALL_UPGRADE_MARKER to a reviewed install/upgrade/uninstall evidence JSON file.' });
  process.exitCode = 2;
} else {
  try {
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    const valid = marker?.installed === true && marker?.upgraded === true && marker?.uninstalled === true && marker?.workspaceRetained === true;
    print(valid ? { status: 'passed', platform: process.platform, evidence: 'manual-marker' } : { status: 'failed', reason: 'Evidence marker must confirm installed, upgraded, uninstalled and workspaceRetained.' });
    process.exitCode = valid ? 0 : 1;
  } catch {
    print({ status: 'failed', reason: 'Installer evidence marker is not valid JSON.' });
    process.exitCode = 1;
  }
}
