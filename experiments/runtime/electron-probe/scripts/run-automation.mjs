import { _electron as electron } from 'playwright';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import electronExecutablePath from 'electron';

const probeRoot = path.resolve(import.meta.dirname, '..');
const mainPath = path.join(probeRoot, 'main.mjs');
const resultPath = path.join(probeRoot, 'result.json');
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;

const electronApp = await electron.launch({
  executablePath: electronExecutablePath,
  args: [mainPath],
  env: environment
});

try {
  const page = await electronApp.firstWindow();
  await page.waitForSelector('main[aria-label="Electron 宿主探针"]');
  await page.waitForFunction(() => document.body.dataset.bridge === 'isolated');
  const browserWindow = await electronApp.browserWindow(page);
  const beforeSize = await browserWindow.evaluate((window) => window.getSize());
  await browserWindow.evaluate((window) => window.setSize(1000, 740));
  const afterSize = await browserWindow.evaluate((window) => window.getSize());
  await browserWindow.evaluate((window) => window.maximize());
  const maximized = await browserWindow.evaluate((window) => window.isMaximized());
  await browserWindow.evaluate((window) => window.unmaximize());
  const restored = await browserWindow.evaluate((window) => !window.isMaximized());
  await browserWindow.evaluate((window) => window.setFullScreen(true));
  const enteredFullScreen = await browserWindow.evaluate((window) => window.isFullScreen());
  await browserWindow.evaluate((window) => window.setFullScreen(false));
  const exitedFullScreen = await browserWindow.evaluate((window) => !window.isFullScreen());
  const rendererExposure = await page.evaluate(async () => ({
    bridge: await window.desktopProbe.getSecuritySnapshot(),
    hasRequire: typeof window.require !== 'undefined',
    hasProcess: typeof window.process !== 'undefined',
    bridgeKeys: Object.keys(window.desktopProbe).sort()
  }));
  const result = {
    recordedAt: new Date().toISOString(),
    command: 'pnpm --dir experiments/runtime/electron-probe probe:automation',
    exitCode: 0,
    environment: {
      platform: process.platform,
      release: os.release(),
      arch: process.arch,
      cpu: os.cpus()[0]?.model ?? 'unknown',
      memoryBytes: os.totalmem(),
      node: process.version
    },
    checks: {
      windowVisible: await browserWindow.evaluate((window) => window.isVisible()),
      resizable: await browserWindow.evaluate((window) => window.isResizable()),
      maximizable: await browserWindow.evaluate((window) => window.isMaximizable()),
      fullScreenable: await browserWindow.evaluate((window) => window.isFullScreenable()),
      resize: { beforeSize, afterSize, passed: afterSize[0] === 1000 && afterSize[1] === 740 },
      maximize: { passed: maximized && restored },
      fullScreen: { passed: enteredFullScreen && exitedFullScreen },
      security: {
        nodeIntegrationDisabled: rendererExposure.bridge.nodeIntegration === false,
        contextIsolationEnabled: rendererExposure.bridge.contextIsolation === true,
        sandboxEnabled: rendererExposure.bridge.sandbox === true,
        rendererHasNoRequire: rendererExposure.hasRequire === false,
        rendererHasNoProcess: rendererExposure.hasProcess === false,
        bridgeKeys: rendererExposure.bridgeKeys,
        transparent: rendererExposure.bridge.transparent,
        vibrancy: rendererExposure.bridge.vibrancy,
        electron: rendererExposure.bridge.electron,
        chrome: rendererExposure.bridge.chrome,
        embeddedNode: rendererExposure.bridge.node
      }
    },
    deliberatelyUnverified: [
      'manual drag/no-drag hit-testing and traffic-light clicks',
      'macOS window snapping',
      'Windows Mica/Acrylic and solid-color fallback',
      'Windows resize/maximize/full-screen behavior',
      'signed/distributed packaging',
      'R01/R02 canvas workload',
      'R03 project store',
      'R04 credential store',
      'R05 task worker',
      'native file dialogs and Chinese IME'
    ]
  };

  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await electronApp.close();
}
