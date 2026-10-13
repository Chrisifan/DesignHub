import type { DesignScene } from '../../features/canvas/scene';
import type { ExportFormat } from '../../features/delivery/export-policy';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import { isTrustedProjectLibraryRequest } from './workspace';

export const exportProjectDesignChannel = 'project:design-export';

type ExportSender = { mainFrame: { url: string }; getURL: () => string };
type ExportRequest = { sender: ExportSender; senderFrame: { url: string } | null };
type ExportWindow = { webContents: ExportSender };
export type ExportBridgeInput = { libraryId: string; projectId: string; designId: string; format: ExportFormat; scene: DesignScene; background?: string; archiveCopy?: boolean };
export type ExportBridgeResult = { path: string; sha256: string; archived?: boolean; archiveError?: string };

const isFormat = (value: unknown): value is ExportFormat => value === 'png' || value === 'jpeg' || value === 'webp' || value === 'pdf';
const isInput = (value: unknown): value is ExportBridgeInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return [input.libraryId, input.projectId, input.designId].every((item) => typeof item === 'string' && item.trim().length > 0)
    && isFormat(input.format) && Boolean(input.scene && typeof input.scene === 'object');
};

export const exportProjectDesignHandler = (
  window: ExportWindow,
  trustedUrl: string,
  getLibrary: () => ProjectLibraryHandle | null,
  exportScene: (workspace: ProjectLibraryHandle, input: ExportBridgeInput) => Promise<ExportBridgeResult | null>,
) => async (event: ExportRequest, input: unknown): Promise<ExportBridgeResult | null> => {
  if (!isTrustedProjectLibraryRequest(event, window, trustedUrl) || !isInput(input)) return null;
  const workspace = getLibrary();
  if (!workspace || workspace.library.libraryId !== input.libraryId) return null;
  return exportScene(workspace, input);
};
