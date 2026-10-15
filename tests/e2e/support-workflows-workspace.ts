import type { Page } from 'playwright/test';

import type { DesktopApi } from '../../src/platform/contracts';
import type { ManagedAsset } from '../../src/features/assets/import-assets';
import type { TrashedProject } from '../../src/features/workspace/project-store';
import type { WorkspaceSettings } from '../../src/features/workspace/settings';

type BridgeCall = { method: string; input: unknown };
type SupportState = {
  calls: BridgeCall[];
  assets: ManagedAsset[];
  bytes: Record<string, number[]>;
  trash: TrashedProject[];
  settings: WorkspaceSettings;
  directories: Array<string | null>;
  diagnosticDestinations: Array<string | null>;
};
type FixtureWindow = Window & { supportFixture: SupportState };

export const supportPaths = {
  destination: '/tmp/designhub-browser-backups',
  artifact: '/tmp/designhub-browser-backups/library-e2e.designhub-backup',
  restoreParent: '/tmp/designhub-browser-restored',
  restored: '/tmp/designhub-browser-restored/E2E Project Library',
  diagnostics: '/tmp/designhub-browser-diagnostics.json',
};
export const backupCreatedAt = '2026-10-15T01:02:03.000Z';
export const supportTrash: TrashedProject[] = [
  { projectId: 'project-restore-browser', originalRelativePath: 'projects/project-restore-browser', deletedAt: '2026-10-14T08:09:10.000Z' },
  { projectId: 'project-purge-browser', originalRelativePath: 'projects/project-purge-browser', deletedAt: '2026-10-14T09:10:11.000Z' },
];

/** Installs a typed desktop boundary before Studio mounts, keeping host state across reloads.
 * The setter merges it with the shared workspace bootstrap regardless of init-script order.
 * No rendered markup or production localStorage preferences are seeded here.
 */
export const installSupportBridge = async (
  page: Page,
  options: { directories?: Array<string | null>; diagnosticDestinations?: Array<string | null> } = {},
): Promise<void> => {
  await page.addInitScript(({ paths, createdAt, trash, fixtureOptions }) => {
    const stateKey = 'designhub.e2e.support-host';
    const stored = sessionStorage.getItem(stateKey);
    const state: SupportState = stored ? JSON.parse(stored) : {
      calls: [], assets: [], bytes: {}, trash,
      settings: { formatVersion: 1, backup: { destinationParentDirectory: null, schedule: 'manual', lastRunAt: null, lastArtifactPath: null } },
      directories: fixtureOptions.directories ?? [],
      diagnosticDestinations: fixtureOptions.diagnosticDestinations ?? [paths.diagnostics],
    };
    (window as unknown as FixtureWindow).supportFixture = state;
    const persist = (): void => sessionStorage.setItem(stateKey, JSON.stringify(state));
    const record = (method: string, input: unknown): void => {
      state.calls.push({ method, input: structuredClone(input) });
      persist();
    };
    const bridge: Partial<DesktopApi> = {
      listAssets: async (input) => { record('listAssets', input); return structuredClone(state.assets); },
      importAssets: async (input) => {
        const items = await Promise.all(input.items.map(async (item) => {
          const data = item.data;
          const bytes = data instanceof ArrayBuffer ? new Uint8Array(data)
            : data instanceof Uint8Array ? data
              : data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : null;
          if (!bytes) throw new Error('EXPECTED_IMAGE_BYTES');
          return { name: item.name, mimeType: item.mimeType, data: Array.from(bytes) };
        }));
        record('importAssets', { ...input, items });
        const results = await Promise.all(items.map(async (item) => {
          const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(item.data));
          const contentHash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
          const asset: ManagedAsset = {
            id: `asset-${contentHash.slice(0, 16)}`, name: item.name, format: 'PNG', mimeType: 'image/png',
            contentHash, managed: true, decode: { width: 1, height: 1, animated: false },
          };
          state.assets.push(asset);
          state.bytes[asset.id] = item.data;
          return { status: 'success' as const, asset: structuredClone(asset) };
        }));
        persist();
        return results;
      },
      readAsset: async (input) => {
        record('readAsset', input);
        const bytes = state.bytes[input.assetId];
        return bytes ? Uint8Array.from(bytes) : null;
      },
      listTrashedProjects: async (libraryId) => { record('listTrash', libraryId); return structuredClone(state.trash); },
      restoreProjectFromTrash: async (input) => {
        record('restoreProject', input);
        const entry = state.trash.find(({ projectId }) => projectId === input.projectId);
        if (!entry) throw new Error('TRASH_ENTRY_MISSING');
        state.trash = state.trash.filter(({ projectId }) => projectId !== input.projectId);
        persist();
        return { projectId: entry.projectId, restoredRelativePath: entry.originalRelativePath };
      },
      purgeProjectFromTrash: async (input) => {
        record('purgeProject', input);
        state.trash = state.trash.filter(({ projectId }) => projectId !== input.projectId);
        persist();
        return true;
      },
      loadWorkspaceSettings: async (libraryId) => { record('loadSettings', libraryId); return structuredClone(state.settings); },
      saveWorkspaceSettings: async (libraryId, settings) => {
        state.settings = structuredClone(settings);
        record('saveSettings', { libraryId, settings });
        return true;
      },
      chooseWorkspaceBackupDirectory: async (kind) => {
        const result = state.directories.shift() ?? null;
        record('chooseDirectory', kind);
        return result;
      },
      createWorkspaceBackup: async (libraryId, destinationParentDirectory) => {
        record('createBackup', { libraryId, destinationParentDirectory });
        return { directory: paths.artifact, libraryId, createdAt };
      },
      restoreWorkspaceBackup: async (input) => {
        record('restoreBackup', input);
        return { directory: paths.restored, libraryId: 'library-restored-browser' };
      },
      exportDiagnostics: async (input) => {
        const destination = state.diagnosticDestinations.shift() ?? null;
        record('exportDiagnostics', input);
        return destination;
      },
    };
    let api: DesktopApi = { ...window.designhub, ...bridge };
    Object.defineProperty(window, 'designhub', {
      configurable: true,
      get: () => api,
      set: (base: DesktopApi) => { api = { ...base, ...bridge }; },
    });
  }, { paths: supportPaths, createdAt: backupCreatedAt, trash: supportTrash, fixtureOptions: options });
};

export const readSupportCalls = async (page: Page): Promise<BridgeCall[]> =>
  page.evaluate(() => (window as unknown as FixtureWindow).supportFixture.calls);
