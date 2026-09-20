import { _electron, expect, test } from 'playwright/test';

test('launches the welcome shell with only the DesignHub bridge', async () => {
  const electronApp = await _electron.launch({ args: ['.'] });

  try {
    const window = await electronApp.firstWindow();
    await expect(window.getByRole('heading', { name: '开始本地创作', exact: true })).toBeAttached();
    await expect(window.getByRole('button', { name: '新建工作区', exact: true })).toBeEnabled();
    await expect(window.getByRole('button', { name: '打开工作区', exact: true })).toBeEnabled();
    const bridgeNames = await window.evaluate(
      () => Object.keys((globalThis as unknown as { designhub: object }).designhub),
    );
    expect(bridgeNames).toEqual([
      'chooseWorkspaceDirectory',
      'createWorkspace',
      'openWorkspace',
      'listActiveProjects',
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
      'exportProjectPackage',
      'loadDesignerState',
      'saveDesignerState',
      'readDesignerArtwork',
      'loadBrandState',
      'saveBrandState',
      'listAssets',
      'importAssets',
      'readAsset',
      'loadDocumentScene',
      'saveDocumentScene',
      'loadDocumentRevisions',
      'commitDocumentRevision',
      'setFinalDocumentRevision',
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
      'exportDocument',
      'listExportHistory',
      'exportDiagnostics',
    ]);
  } finally {
    await electronApp.close();
  }
});
