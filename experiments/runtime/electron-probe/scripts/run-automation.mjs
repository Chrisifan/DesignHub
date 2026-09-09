import { _electron as electron } from 'playwright';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import electronExecutablePath from 'electron';

const probeRoot = path.resolve(import.meta.dirname, '..');
const mainPath = path.join(probeRoot, 'main.mjs');
const resultPath = path.join(probeRoot, 'result.json');
const environment = { ...process.env };
const expectedMaterialMode = environment.DESIGNHUB_PROBE_FORCE_SOLID === '1' ? 'solid-fallback-requested' : 'platform-material-requested';
const requiredBridgeKeys = ['getSecuritySnapshot'];
const assertRequired = (condition, message) => {
  if (!condition) {
    throw new Error(`Required probe check failed: ${message}`);
  }
};
const sameStringArray = (actual, expected) => actual.length === expected.length && actual.every((value, index) => value === expected[index]);
const transitionFullScreen = async (browserWindow, eventName, desiredState) => browserWindow.evaluate((window, transition) => new Promise((resolve) => {
  const timeoutId = setTimeout(() => resolve(false), 3000);
  window.once(transition.eventName, () => {
    clearTimeout(timeoutId);
    resolve(true);
  });
  window.setFullScreen(transition.desiredState);
}), { eventName, desiredState });

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
  await page.waitForFunction((materialMode) => document.body.dataset.materialMode === materialMode, expectedMaterialMode);
  const browserWindow = await electronApp.browserWindow(page);
  const beforeSize = await browserWindow.evaluate((window) => window.getSize());
  await browserWindow.evaluate((window) => window.setSize(1000, 740));
  const afterSize = await browserWindow.evaluate((window) => window.getSize());
  await browserWindow.evaluate((window) => window.maximize());
  const maximized = await browserWindow.evaluate((window) => window.isMaximized());
  await browserWindow.evaluate((window) => window.unmaximize());
  const restored = await browserWindow.evaluate((window) => !window.isMaximized());
  const enteredFullScreenEvent = await transitionFullScreen(browserWindow, 'enter-full-screen', true);
  const enteredFullScreen = await browserWindow.evaluate((window) => window.isFullScreen());
  const leftFullScreenEvent = await transitionFullScreen(browserWindow, 'leave-full-screen', false);
  const exitedFullScreen = await browserWindow.evaluate((window) => !window.isFullScreen());
  await page.getByRole('button', { name: '测试无拖动按钮' }).click();
  await page.waitForFunction(() => document.body.dataset.noDragInteraction === 'clicked');
  const rendererExposure = await page.evaluate(async () => ({
    bridge: await window.desktopProbe.getSecuritySnapshot(),
    hasRequire: typeof window.require !== 'undefined',
    hasProcess: typeof window.process !== 'undefined',
    bridgeKeys: Object.keys(window.desktopProbe).sort(),
    dragRegion: document.querySelector('[data-probe-zone="drag"]').dataset.appRegion,
    noDragRegion: document.querySelector('[data-probe-zone="no-drag"]').dataset.appRegion,
    noDragInteraction: document.body.dataset.noDragInteraction,
    materialMode: document.body.dataset.materialMode,
    solidFallbackBackground: document.querySelector('main').dataset.solidFallback
  }));
  const requestedConfiguration = rendererExposure.bridge.requestedWindowConfiguration;
  const checks = {
    windowVisible: await browserWindow.evaluate((window) => window.isVisible()),
    resizable: await browserWindow.evaluate((window) => window.isResizable()),
    maximizable: await browserWindow.evaluate((window) => window.isMaximizable()),
    fullScreenable: await browserWindow.evaluate((window) => window.isFullScreenable()),
    resize: { beforeSize, afterSize, passed: afterSize[0] === 1000 && afterSize[1] === 740 },
    maximize: { passed: maximized && restored },
    fullScreen: { enteredFullScreenEvent, leftFullScreenEvent, passed: enteredFullScreenEvent && enteredFullScreen && leftFullScreenEvent && exitedFullScreen },
    security: {
      nodeIntegrationDisabled: rendererExposure.bridge.nodeIntegration === false,
      contextIsolationEnabled: rendererExposure.bridge.contextIsolation === true,
      sandboxEnabled: rendererExposure.bridge.sandbox === true,
      rendererHasNoRequire: rendererExposure.hasRequire === false,
      rendererHasNoProcess: rendererExposure.hasProcess === false,
      bridgeKeys: rendererExposure.bridgeKeys,
      exactBridgeAllowlist: sameStringArray(rendererExposure.bridgeKeys, requiredBridgeKeys)
    },
    fixture: {
      dragRegion: rendererExposure.dragRegion,
      noDragRegion: rendererExposure.noDragRegion,
      noDragInteraction: rendererExposure.noDragInteraction,
      materialMode: rendererExposure.materialMode,
      solidFallbackBackground: rendererExposure.solidFallbackBackground,
      requestedWindowConfiguration: requestedConfiguration,
      passed: rendererExposure.dragRegion === 'drag' && rendererExposure.noDragRegion === 'no-drag' && rendererExposure.noDragInteraction === 'clicked' && rendererExposure.materialMode === expectedMaterialMode && rendererExposure.solidFallbackBackground === requestedConfiguration.solidFallbackBackground && requestedConfiguration.transparent === false && requestedConfiguration.titleBarStyle === 'hidden'
    }
  };
  const requiredOutcomes = [
    checks.windowVisible,
    checks.resizable,
    checks.maximizable,
    checks.fullScreenable,
    checks.resize.passed,
    checks.maximize.passed,
    checks.fullScreen.passed,
    checks.security.nodeIntegrationDisabled,
    checks.security.contextIsolationEnabled,
    checks.security.sandboxEnabled,
    checks.security.rendererHasNoRequire,
    checks.security.rendererHasNoProcess,
    checks.security.exactBridgeAllowlist,
    checks.fixture.passed
  ];
  const requiredOutcomesPass = requiredOutcomes.every((outcome) => outcome === true);

  assertRequired(requiredOutcomesPass, JSON.stringify(checks));

  const result = {
    recordedAt: new Date().toISOString(),
    command: expectedMaterialMode === 'solid-fallback-requested' ? 'pnpm --dir experiments/runtime/electron-probe probe:automation:solid' : 'pnpm --dir experiments/runtime/electron-probe probe:automation',
    exitCode: requiredOutcomesPass ? 0 : 1,
    environment: {
      platform: process.platform,
      release: os.release(),
      arch: process.arch,
      cpu: os.cpus()[0]?.model ?? 'unknown',
      memoryBytes: os.totalmem(),
      node: process.version
    },
    checks,
    deliberatelyUnverified: [
      'visual confirmation of macOS vibrancy or any material effect',
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
