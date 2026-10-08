import { assetImportChannel, assetListChannel, assetReadChannel } from './assets';
import { brandLoadChannel, brandSaveChannel } from './brands';
import { designerArtworkReadChannel, designerLoadChannel, designerSaveChannel } from './designers';
import { revisionCommitChannel, revisionFinalizeChannel, revisionLoadChannel } from './revisions';
import { sceneLoadChannel, sceneSaveChannel } from './scenes';
import { registerContentHandlers } from './register-content-handlers';

describe('registerContentHandlers', () => {
  it('registers designer, brand, asset, scene, and revision channels', () => {
    const registrations = new Map<string, (...args: unknown[]) => unknown>();
    const noop = vi.fn();
    registerContentHandlers({
      ipc: { handle: (channel, listener) => { registrations.set(channel, listener as (...args: unknown[]) => unknown); } },
      getWindow: () => ({ webContents: {} } as never),
      getTrustedUrl: () => 'http://localhost:5173',
      getLibrary: () => null,
      loadDesigner: noop,
      saveDesigner: noop,
      readArtwork: noop,
      loadBrand: noop,
      saveBrand: noop,
      listAssets: noop,
      importAssets: noop,
      readAsset: noop,
      loadScene: noop,
      saveScene: noop,
      loadRevisions: noop,
      commitRevision: noop,
      finalizeRevision: noop,
    });

    expect([...registrations.keys()]).toEqual([
      designerLoadChannel,
      designerSaveChannel,
      designerArtworkReadChannel,
      brandLoadChannel,
      brandSaveChannel,
      assetListChannel,
      assetImportChannel,
      assetReadChannel,
      sceneLoadChannel,
      sceneSaveChannel,
      revisionLoadChannel,
      revisionCommitChannel,
      revisionFinalizeChannel,
    ]);
  });
});
