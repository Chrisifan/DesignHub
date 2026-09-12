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
      'getProjectMetadata',
      'updateProjectMetadata',
      'loadDesignerState',
      'saveDesignerState',
      'listAssets',
      'importAssets',
      'readAsset',
      'loadDocumentScene',
      'saveDocumentScene',
      'storeCredential',
      'deleteCredential',
      'listTasks',
      'submitConversation',
      'cancelTask',
    ]);
  } finally {
    await electronApp.close();
  }
});
