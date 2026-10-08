import type { BrowserWindow } from 'electron';
import type { PortfolioAnalysisInput } from '../../features/agent/task-service';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import type { TaskRecord } from '../../features/tasks/state';
import type { PortfolioSourceInspector } from '../portfolio-source-inspector';
import {
  createPortfolioDiscardHandler,
  createPortfolioInspectionHandler,
  createPortfolioSelectionHandler,
  portfolioDiscardChannel,
  portfolioInspectChannel,
  portfolioSelectChannel,
} from './portfolio';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};

type PortfolioHandler = (...args: unknown[]) => unknown;

export type RegisterPortfolioOptions = {
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  getLibrary: () => ProjectLibraryHandle | null;
  chooseFiles: (window: BrowserWindow) => Promise<string[] | null>;
  inspector: PortfolioSourceInspector;
  submit: (workspace: ProjectLibraryHandle, input: PortfolioAnalysisInput) => Promise<TaskRecord>;
};

export const registerPortfolioHandlers = ({
  ipc,
  getWindow,
  getTrustedUrl,
  getLibrary,
  chooseFiles,
  inspector,
  submit,
}: RegisterPortfolioOptions): void => {
  const getContext = (): { window: BrowserWindow; trustedUrl: string } | null => {
    const window = getWindow();
    const trustedUrl = getTrustedUrl();
    return window && trustedUrl ? { window, trustedUrl } : null;
  };

  const getHandlers = (): {
    inspect: PortfolioHandler;
    select: PortfolioHandler;
    discard: PortfolioHandler;
  } | null => {
    const context = getContext();
    if (!context) return null;
    return {
      inspect: createPortfolioInspectionHandler(
        context.window,
        context.trustedUrl,
        getLibrary,
        () => chooseFiles(context.window),
        inspector,
      ) as PortfolioHandler,
      select: createPortfolioSelectionHandler(
        context.window,
        context.trustedUrl,
        getLibrary,
        inspector,
        submit,
      ) as PortfolioHandler,
      discard: createPortfolioDiscardHandler(
        context.window,
        context.trustedUrl,
        getLibrary,
        inspector,
      ) as PortfolioHandler,
    };
  };

  ipc.handle(portfolioInspectChannel, (event, input) => getHandlers()?.inspect(event, input) ?? null);
  ipc.handle(portfolioSelectChannel, (event, input) => getHandlers()?.select(event, input) ?? null);
  ipc.handle(portfolioDiscardChannel, (event, input) => getHandlers()?.discard(event, input) ?? false);
};
