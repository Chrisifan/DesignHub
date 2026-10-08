import type { BrowserWindow } from 'electron';
import type { ProjectLibraryHandle } from '../../features/project-library/open-project-library';
import type { TaskRecord } from '../../features/tasks/state';
import type {
  ConversationBridgeInput,
  ConversationTestBridgeInput,
  DesignGenerationBridgeInput,
  ImageEditBridgeInput,
  ImageGenerationBridgeInput,
  ImageGenerationTestBridgeInput,
} from './agent';
import {
  cancelTaskHandler,
  conversationSubmitChannel,
  conversationTestChannel,
  createConversationHandler,
  createConversationTestHandler,
  createDesignGenerationHandler,
  createDesignGenerationSlotRetryHandler,
  createDesignerArtworkGenerationHandler,
  createImageEditHandler,
  createImageGenerationHandler,
  createImageGenerationTestHandler,
  designGenerationSlotRetryChannel,
  designGenerationSubmitChannel,
  designerArtworkGenerationSubmitChannel,
  imageEditSubmitChannel,
  imageGenerationSubmitChannel,
  imageGenerationTestChannel,
  retryTaskHandler,
  taskCancelChannel,
  taskRetryChannel,
} from './agent';
import type {
  ConversationTestResult,
  DesignerArtworkGenerationInput,
  DesignGenerationSlotRetryInput,
  ImageGenerationTestResult,
} from '../../features/agent/task-service';

type IpcMainLike = {
  handle: (channel: string, listener: (...args: unknown[]) => unknown) => unknown;
};

type AgentHandler = (...args: unknown[]) => unknown;

export type RegisterAgentOptions = {
  ipc: IpcMainLike;
  getWindow: () => BrowserWindow | null;
  getTrustedUrl: () => string | null;
  getLibrary: () => ProjectLibraryHandle | null;
  submitConversation: (workspace: ProjectLibraryHandle, input: ConversationBridgeInput) => Promise<TaskRecord>;
  submitDesignGeneration: (workspace: ProjectLibraryHandle, input: DesignGenerationBridgeInput) => Promise<TaskRecord>;
  retryDesignGenerationSlot: (workspace: ProjectLibraryHandle, input: DesignGenerationSlotRetryInput) => Promise<TaskRecord>;
  testConversation: (workspace: ProjectLibraryHandle, input: ConversationTestBridgeInput) => Promise<ConversationTestResult>;
  submitImageGeneration: (workspace: ProjectLibraryHandle, input: ImageGenerationBridgeInput) => Promise<TaskRecord>;
  testImageGeneration: (workspace: ProjectLibraryHandle, input: ImageGenerationTestBridgeInput) => Promise<ImageGenerationTestResult>;
  submitDesignerArtworkGeneration: (workspace: ProjectLibraryHandle, input: DesignerArtworkGenerationInput) => Promise<TaskRecord>;
  submitImageEdit: (workspace: ProjectLibraryHandle, input: ImageEditBridgeInput) => Promise<TaskRecord>;
  cancelTask: (workspace: ProjectLibraryHandle, taskId: string) => Promise<boolean>;
  retryTask: (workspace: ProjectLibraryHandle, taskId: string) => Promise<TaskRecord | undefined>;
};

export const registerAgentHandlers = ({
  ipc,
  getWindow,
  getTrustedUrl,
  getLibrary,
  submitConversation,
  submitDesignGeneration,
  retryDesignGenerationSlot,
  testConversation,
  submitImageGeneration,
  testImageGeneration,
  submitDesignerArtworkGeneration,
  submitImageEdit,
  cancelTask,
  retryTask,
}: RegisterAgentOptions): void => {
  const getContext = (): { window: BrowserWindow; trustedUrl: string } | null => {
    const window = getWindow();
    const trustedUrl = getTrustedUrl();
    return window && trustedUrl ? { window, trustedUrl } : null;
  };

  const getHandlers = (): Record<string, AgentHandler> | null => {
    const context = getContext();
    if (!context) return null;
    const { window, trustedUrl } = context;
    return {
      conversationSubmit: createConversationHandler(window, trustedUrl, getLibrary, submitConversation) as AgentHandler,
      designGenerationSubmit: createDesignGenerationHandler(window, trustedUrl, getLibrary, submitDesignGeneration) as AgentHandler,
      designGenerationSlotRetry: createDesignGenerationSlotRetryHandler(window, trustedUrl, getLibrary, retryDesignGenerationSlot) as AgentHandler,
      conversationTest: createConversationTestHandler(window, trustedUrl, getLibrary, testConversation) as AgentHandler,
      imageGenerationSubmit: createImageGenerationHandler(window, trustedUrl, getLibrary, submitImageGeneration) as AgentHandler,
      imageGenerationTest: createImageGenerationTestHandler(window, trustedUrl, getLibrary, testImageGeneration) as AgentHandler,
      designerArtworkGenerationSubmit: createDesignerArtworkGenerationHandler(window, trustedUrl, getLibrary, submitDesignerArtworkGeneration) as AgentHandler,
      imageEditSubmit: createImageEditHandler(window, trustedUrl, getLibrary, submitImageEdit) as AgentHandler,
      taskCancel: cancelTaskHandler(window, trustedUrl, getLibrary, cancelTask) as AgentHandler,
      taskRetry: retryTaskHandler(window, trustedUrl, getLibrary, retryTask) as AgentHandler,
    };
  };

  ipc.handle(conversationSubmitChannel, (event, input) => getHandlers()?.conversationSubmit(event, input) ?? null);
  ipc.handle(designGenerationSubmitChannel, (event, input) => getHandlers()?.designGenerationSubmit(event, input) ?? null);
  ipc.handle(designGenerationSlotRetryChannel, (event, input) => getHandlers()?.designGenerationSlotRetry(event, input) ?? null);
  ipc.handle(conversationTestChannel, (event, input) => getHandlers()?.conversationTest(event, input) ?? null);
  ipc.handle(imageGenerationSubmitChannel, (event, input) => getHandlers()?.imageGenerationSubmit(event, input) ?? null);
  ipc.handle(imageGenerationTestChannel, (event, input) => getHandlers()?.imageGenerationTest(event, input) ?? null);
  ipc.handle(designerArtworkGenerationSubmitChannel, (event, input) => getHandlers()?.designerArtworkGenerationSubmit(event, input) ?? null);
  ipc.handle(imageEditSubmitChannel, (event, input) => getHandlers()?.imageEditSubmit(event, input) ?? null);
  ipc.handle(taskCancelChannel, (event, input) => getHandlers()?.taskCancel(event, input) ?? false);
  ipc.handle(taskRetryChannel, (event, input) => getHandlers()?.taskRetry(event, input) ?? null);
};
