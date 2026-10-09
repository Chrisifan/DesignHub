import {
  imageToolCancelChannel,
  imageToolChooseInputChannel,
  imageToolChooseOutputChannel,
  imageToolCreateChannel,
  imageToolGetChannel,
  imageToolImportResultChannel,
  imageToolListChannel,
  imageToolOpenOutputChannel,
  imageToolOpenResultChannel,
  imageToolPauseChannel,
  imageToolReadResultChannel,
  imageToolResumeChannel,
  imageToolRetryChannel,
  imageToolQueryChannel,
  imageToolCancelItemChannel,
  imageToolRevealResultChannel,
  imageToolScanChannel,
} from './image-tools-channels';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};

type ImageToolIpcHandlersLike = {
  chooseInput: (...args: unknown[]) => unknown;
  chooseOutput: (...args: unknown[]) => unknown;
  scan: (...args: unknown[]) => unknown;
  create: (...args: unknown[]) => unknown;
  list: (...args: unknown[]) => unknown;
  get: (...args: unknown[]) => unknown;
  pause: (...args: unknown[]) => unknown;
  resume: (...args: unknown[]) => unknown;
  cancel: (...args: unknown[]) => unknown;
  retry: (...args: unknown[]) => unknown;
  queryItem?: (...args: unknown[]) => unknown;
  cancelItem?: (...args: unknown[]) => unknown;
  readResult: (...args: unknown[]) => unknown;
  openResult: (...args: unknown[]) => unknown;
  revealResult: (...args: unknown[]) => unknown;
  openOutput: (...args: unknown[]) => unknown;
  importResult: (...args: unknown[]) => unknown;
};

export type RegisterImageToolIpcHandlersOptions = {
  ipc: IpcMainLike;
  getWindow: () => unknown | null;
  handlers: ImageToolIpcHandlersLike;
};

export const registerImageToolIpcHandlers = ({
  ipc,
  getWindow,
  handlers,
}: RegisterImageToolIpcHandlersOptions): void => {
  ipc.handle(imageToolChooseInputChannel, (event) => {
    const window = getWindow();
    return window ? handlers.chooseInput(event, window) : null;
  });
  ipc.handle(imageToolChooseOutputChannel, (event) => {
    const window = getWindow();
    return window ? handlers.chooseOutput(event, window) : null;
  });
  ipc.handle(imageToolScanChannel, (event, input) => handlers.scan(event, input));
  ipc.handle(imageToolCreateChannel, (event, input) => handlers.create(event, input));
  ipc.handle(imageToolListChannel, (event, libraryId) => handlers.list(event, libraryId));
  ipc.handle(imageToolGetChannel, (event, input) => handlers.get(event, input));
  ipc.handle(imageToolPauseChannel, (event, input) => handlers.pause(event, input));
  ipc.handle(imageToolResumeChannel, (event, input) => handlers.resume(event, input));
  ipc.handle(imageToolCancelChannel, (event, input) => handlers.cancel(event, input));
  ipc.handle(imageToolRetryChannel, (event, input) => handlers.retry(event, input));
  ipc.handle(imageToolQueryChannel, (event, input) => handlers.queryItem?.(event, input) ?? null);
  ipc.handle(imageToolCancelItemChannel, (event, input) => handlers.cancelItem?.(event, input) ?? null);
  ipc.handle(imageToolReadResultChannel, (event, input) => handlers.readResult(event, input));
  ipc.handle(imageToolOpenResultChannel, (event, path) => handlers.openResult(event, path));
  ipc.handle(imageToolRevealResultChannel, (event, path) => handlers.revealResult(event, path));
  ipc.handle(imageToolOpenOutputChannel, (event, path) => handlers.openOutput(event, path));
  ipc.handle(imageToolImportResultChannel, (event, input) => handlers.importResult(event, input));
};
