import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron, expect, test } from 'playwright/test';

test('launches the welcome shell with only the DesignHub bridge', async () => {
  const userData = await mkdtemp(join(tmpdir(), 'designhub-electron-onboarding-'));
  const electronApp = await _electron.launch({ args: ['.'], env: { ...process.env, DESIGNHUB_TEST_USER_DATA: userData } });

  try {
    const window = await electronApp.firstWindow();
    await expect(window.getByRole('heading', { name: '设置你的资料', exact: true })).toBeVisible({ timeout: 10000 });
    const bridgeNames = await window.evaluate(
      () => Object.keys((globalThis as unknown as { designhub: object }).designhub),
    );
    expect(bridgeNames).toContain('loadProfile');
    expect(bridgeNames).toContain('saveProfile');
    expect(bridgeNames).toContain('getProjectLibraryStatus');
    expect(bridgeNames).toContain('chooseProjectLibrary');
    expect(bridgeNames).toContain('listActiveProjects');
    expect(bridgeNames).not.toContain('chooseWorkspaceDirectory');
    expect(bridgeNames).not.toContain('createWorkspace');
    expect(bridgeNames).not.toContain('openWorkspace');
    expect(bridgeNames).not.toContain('exportProjectPackage');
    expect(bridgeNames).toEqual(expect.arrayContaining([
      'createProjectContainer',
      'duplicateProject',
      'importProjectPackage',
      'getProjectMetadata',
      'updateProjectMetadata',
      'listTrashedProjects',
      'moveProjectToTrash',
      'restoreProjectFromTrash',
      'purgeProjectFromTrash',
      'createWorkspaceBackup',
      'restoreWorkspaceBackup',
      'loadWorkspaceSettings',
      'saveWorkspaceSettings',
      'rebuildSearchIndex',
      'searchProjects',
      'loadDesignerState',
      'saveDesignerState',
      'readDesignerArtwork',
      'listAssets',
      'importAssets',
      'readAsset',
      'addProjectDesigns',
      'listProjectDesigns',
      'loadProjectCanvasLayout',
      'saveProjectCanvasLayout',
      'storeCredential',
      'deleteCredential',
      'hasCredential',
      'loadProviderConfigs',
      'saveProviderConfig',
      'listTasks',
      'submitConversation',
      'submitDesignGeneration',
      'retryDesignGenerationSlot',
      'testConversation',
      'inspectPortfolioSources',
      'submitPortfolioSelection',
      'discardPortfolioInspection',
      'submitImageGeneration',
      'testImageGeneration',
      'submitDesignerArtworkGeneration',
      'submitImageEdit',
      'cancelTask',
      'retryTask',
      'exportProjectDesign',
      'listExportHistory',
      'exportDiagnostics',
    ]));
  } finally {
    await electronApp.close();
    await rm(userData, { recursive: true, force: true });
  }
});
