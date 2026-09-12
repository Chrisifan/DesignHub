import { isTrustedWorkspaceRequest } from './workspace';

export const diagnosticsExportChannel = 'diagnostics:export';

type DiagnosticInput = { runtime: string; errorCode?: string | null };
type DiagnosticSender = { mainFrame: { url: string }; getURL: () => string };
type DiagnosticRequest = { sender: DiagnosticSender; senderFrame: { url: string } | null };
type DiagnosticWindow = { webContents: DiagnosticSender };

const isInput = (value: unknown): value is DiagnosticInput => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return Object.keys(input).every((key) => key === 'runtime' || key === 'errorCode')
    && typeof input.runtime === 'string' && input.runtime.length > 0
    && (input.errorCode === undefined || input.errorCode === null || typeof input.errorCode === 'string');
};

export const exportDiagnosticsHandler = (
  window: DiagnosticWindow,
  trustedUrl: string,
  write: (input: DiagnosticInput) => Promise<string | null>,
) => async (event: DiagnosticRequest, input: unknown): Promise<string | null> => {
  if (!isTrustedWorkspaceRequest(event, window, trustedUrl) || !isInput(input)) return null;
  return write(input);
};
