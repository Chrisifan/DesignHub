import { _electron, expect, test } from 'playwright/test';

test('launches the workspace shell with only the DesignHub bridge', async () => {
  const electronApp = await _electron.launch({ args: ['.'] });

  try {
    const window = await electronApp.firstWindow();
    await expect(
      window.getByRole('heading', { name: '项目库', exact: true }),
    ).toBeAttached();
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
      'submitPortfolioAnalysis',
      'submitImageGeneration',
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
