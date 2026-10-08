import type { BatchImageTool, ToolParams } from './jobs';

export type ImageToolScanInput = {
  tool: BatchImageTool;
  params: ToolParams;
  sourcePath: string;
  outputRoot: string;
};

export type ImageToolCreateInput = ImageToolScanInput & { connectionId?: string };
export type ImageToolScanResult = {
  accepted: Array<{ relativePath: string }>;
  rejected: Array<{ path: string; code: string; detail?: string }>;
};

export type ImageToolCommandHandlers = {
  chooseInput?: () => Promise<{ path: string; displayName?: string } | null>;
  chooseOutput?: () => Promise<{ path: string; displayName?: string } | null>;
  scan?: (input: ImageToolScanInput) => Promise<ImageToolScanResult | null>;
  create?: (input: ImageToolCreateInput) => void | Promise<void>;
  pause?: (jobId: string) => void | Promise<void>;
  resume?: (jobId: string) => void | Promise<void>;
  cancel?: (jobId: string) => void | Promise<void>;
  retryItem?: (jobId: string, itemId: string) => void | Promise<void>;
  openResult?: (path: string, jobId: string) => void | Promise<void>;
  revealResult?: (path: string, jobId: string) => void | Promise<void>;
  openOutput?: (path: string, jobId: string) => void | Promise<void>;
  importResult?: (path: string, jobId: string) => void | Promise<void>;
};

export const createImageToolCommands = (handlers: ImageToolCommandHandlers) => ({
  chooseInput: async () => handlers.chooseInput?.() ?? null,
  chooseOutput: async () => handlers.chooseOutput?.() ?? null,
  scan: async (input: ImageToolScanInput) => handlers.scan?.(input) ?? null,
  create: async (input: ImageToolCreateInput) => { await handlers.create?.(input); },
  pause: async (jobId: string) => { await handlers.pause?.(jobId); },
  resume: async (jobId: string) => { await handlers.resume?.(jobId); },
  cancel: async (jobId: string) => { await handlers.cancel?.(jobId); },
  retryItem: async (jobId: string, itemId: string) => { await handlers.retryItem?.(jobId, itemId); },
  openResult: async (path: string, jobId: string) => { await handlers.openResult?.(path, jobId); },
  revealResult: async (path: string, jobId: string) => { await handlers.revealResult?.(path, jobId); },
  openOutput: async (path: string, jobId: string) => { await handlers.openOutput?.(path, jobId); },
  importResult: async (path: string, jobId: string) => { await handlers.importResult?.(path, jobId); },
});

export type ImageToolCommands = ReturnType<typeof createImageToolCommands>;
