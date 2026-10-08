import {
  projectCanvasLayoutLoadChannel,
  projectCanvasLayoutSaveChannel,
  projectCreateChannel,
  projectDesignsAddChannel,
  projectDesignsListChannel,
  projectDuplicateChannel,
  projectListChannel,
  projectListTrashChannel,
  projectMetadataGetChannel,
  projectMetadataUpdateChannel,
  projectPurgeTrashChannel,
  projectRestoreTrashChannel,
  projectTrashChannel,
} from './projects';
import { registerProjectHandlers } from './register-projects';

describe('registerProjectHandlers', () => {
  it('registers the project lifecycle channels as one domain group', () => {
    const registrations = new Map<string, (...args: unknown[]) => unknown>();
    const noop = vi.fn();
    registerProjectHandlers({
      ipc: { handle: (channel, listener) => { registrations.set(channel, listener as (...args: unknown[]) => unknown); } },
      getWindow: () => ({ webContents: {} } as never),
      getTrustedUrl: () => 'http://localhost:5173',
      getLibrary: () => null,
      listProjects: noop,
      createProject: noop,
      duplicateProject: noop,
      getMetadata: noop,
      updateMetadata: noop,
      addDesigns: noop,
      listDesigns: noop,
      loadCanvasLayout: noop,
      saveCanvasLayout: noop,
      listTrashed: noop,
      moveToTrash: noop,
      restoreFromTrash: noop,
      purgeFromTrash: noop,
    });

    expect([...registrations.keys()]).toEqual([
      projectListChannel,
      projectCreateChannel,
      projectDuplicateChannel,
      projectMetadataGetChannel,
      projectMetadataUpdateChannel,
      projectDesignsAddChannel,
      projectDesignsListChannel,
      projectCanvasLayoutLoadChannel,
      projectCanvasLayoutSaveChannel,
      projectListTrashChannel,
      projectTrashChannel,
      projectRestoreTrashChannel,
      projectPurgeTrashChannel,
    ]);
  });
});
