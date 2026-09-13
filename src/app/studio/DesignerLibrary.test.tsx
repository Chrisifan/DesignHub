import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";

import type { DesignerLibraryState } from "../../features/designers/persistence";
import { DesignerLibrary } from "./DesignerLibrary";

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

it("filters personas and exposes structured style guidance in the inspector", () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} />);
  expect(screen.getByText("Style DNA")).toBeInTheDocument();
  expect(screen.getByText("禁用规则")).toBeInTheDocument();
  expect(screen.getByText("精选作品")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "搜索档案" }), {
    target: { value: "商品" },
  });
  expect(screen.getByRole("button", { name: /清晰商业/ })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /纸感排版/ }),
  ).not.toBeInTheDocument();
});

it("supports create, derive, default and use-for-new actions in session state", () => {
  const notify = vi.fn();
  const onUseForNew = vi.fn();
  render(
    <DesignerLibrary
      locale="zh-CN"
      notify={notify}
      onUseForNew={onUseForNew}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /清晰商业/ }));
  fireEvent.click(screen.getByRole("button", { name: "设默认" }));
  expect(screen.getByRole("button", { name: "当前默认" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "用于新建" }));
  expect(onUseForNew).toHaveBeenCalledWith("clear-commerce");
  fireEvent.click(screen.getByRole("button", { name: "派生" }));
  expect(
    screen.getByRole("button", { name: /清晰商业 派生版/ }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  expect(notify).toHaveBeenCalledWith("档案已移除");
  fireEvent.click(screen.getByRole("button", { name: "创建" }));
  const dialog = screen.getByRole("dialog", { name: "创建设计师" });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "名称" }), {
    target: { value: "夜间叙事" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "保留" }));
  expect(screen.getByRole("button", { name: /夜间叙事/ })).toBeInTheDocument();
});

it("requires portfolio rights confirmation before entering candidate review", () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "创建" }));
  fireEvent.click(screen.getByRole("button", { name: "作品集" }));
  fireEvent.click(screen.getByRole("button", { name: "生成" }));
  expect(
    screen.getByText("请先确认拥有分析这些来源的权利。"),
  ).toBeInTheDocument();
});

it("submits a rights-confirmed portfolio analysis task for a workspace designer draft", async () => {
  const submitPortfolioAnalysis = vi.fn(async () => ({
    id: "task-portfolio",
    requestId: "request-portfolio",
    state: "running" as const,
    cancelRequested: false,
    attempt: 1,
  }));
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    submitPortfolioAnalysis,
  };
  render(
    <DesignerLibrary
      locale="zh-CN"
      notify={vi.fn()}
      workspaceId="workspace-1"
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "创建" }));
  fireEvent.click(screen.getByRole("button", { name: "作品集" }));
  fireEvent.change(screen.getByRole("textbox", { name: "作品来源" }), {
    target: { value: "https://example.com/portfolio.png" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "生成" }));
  await waitFor(() =>
    expect(submitPortfolioAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        source: expect.objectContaining({ kind: "designer-draft" }),
        sources: expect.arrayContaining([
          expect.objectContaining({ id: expect.any(String), image: { url: "https://example.com/portfolio.png" } }),
        ]),
      }),
    ),
  );
});

it("imports selected portfolio image files as explicit base64 vision sources", async () => {
  const submitPortfolioAnalysis = vi.fn(async () => ({
    id: "task-file-portfolio",
    requestId: "request-file-portfolio",
    state: "running" as const,
    cancelRequested: false,
    attempt: 1,
  }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, submitPortfolioAnalysis };
  render(<DesignerLibrary locale="en" notify={vi.fn()} workspaceId="workspace-files" />);
  fireEvent.click(await screen.findByRole("button", { name: "Create" }));
  fireEvent.click(screen.getByRole("button", { name: "Portfolio" }));
  const file = new File(["image-bytes"], "reference.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Portfolio image files"), { target: { files: [file] } });
  fireEvent.change(screen.getByRole("textbox", { name: "Portfolio sources" }), { target: { value: "https://example.com/second.png" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));
  await waitFor(() => expect(submitPortfolioAnalysis).toHaveBeenCalledWith(expect.objectContaining({
    sources: expect.arrayContaining([
      expect.objectContaining({ description: "reference.png", image: expect.objectContaining({ mimeType: "image/png", base64: expect.any(String) }) }),
      expect.objectContaining({ image: { url: "https://example.com/second.png" } }),
    ]),
  })));
});

it("reviews a completed portfolio candidate and persists the published profile", async () => {
  const saveDesignerState = vi.fn(async () => true);
  const candidate = {
    id: "portfolio-candidate-1",
    name: { zh: "作品集候选", en: "Portfolio candidate" },
    signature: { zh: "分析草稿", en: "Analysis draft" },
    summary: { zh: "克制构成", en: "Restrained composition" },
    principle: { zh: "保留层次", en: "Keep hierarchy" },
    personaCode: "PORTFOLIO-1",
    version: "v0.1",
    status: "draft",
    artworkAssetId: "asset-portrait",
    artworkUrl: "asset://asset-portrait",
    artworkAlt: { zh: "候选形象", en: "Candidate portrait" },
    tags: [],
    referenceCount: 0,
    styleDna: {
      palette: [],
      typography: { zh: "", en: "" },
      composition: { zh: "", en: "" },
      texture: { zh: "", en: "" },
    },
    negativeRules: [],
    portfolioSheets: [],
  };
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    submitPortfolioAnalysis: vi.fn(async () => ({
      id: "task-complete",
      requestId: "request-1",
      state: "running" as const,
      cancelRequested: false,
      attempt: 1,
    })),
    listTasks: vi.fn(async () => [
      {
        id: "task-complete",
        requestId: "request-1",
        state: "completed" as const,
        cancelRequested: false,
        attempt: 1,
        source: { kind: "designer-draft" as const, id: "designer-draft-1" },
        result: { text: JSON.stringify({ candidates: [candidate] }) },
      },
    ]),
    saveDesignerState,
  };
  render(
    <DesignerLibrary
      locale="zh-CN"
      notify={vi.fn()}
      workspaceId="workspace-1"
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "创建" }));
  fireEvent.click(screen.getByRole("button", { name: "作品集" }));
  fireEvent.change(screen.getByRole("textbox", { name: "作品来源" }), {
    target: { value: "https://example.com/portfolio.png" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "生成" }));
  const candidateButton = await screen.findByRole("button", {
    name: /作品集候选/,
  });
  fireEvent.click(candidateButton);
  fireEvent.click(screen.getByRole("button", { name: "发布预览" }));
  await waitFor(() =>
    expect(saveDesignerState).toHaveBeenCalledWith(
      "workspace-1",
      expect.objectContaining({
        profiles: expect.arrayContaining([
          expect.objectContaining({
            status: "published",
            artworkAssetId: "asset-portrait",
            artworkUrl: "asset://asset-portrait",
          }),
        ]),
      }),
    ),
  );
});

it("requests artwork for a selected candidate and adopts the managed image before publishing", async () => {
  const saveDesignerState = vi.fn(
    async (...args: [string, DesignerLibraryState]) => args.length === 2,
  );
  const candidate = {
    id: "candidate-artwork-1",
    name: { zh: "未来编辑", en: "Future editor" },
    signature: { zh: "形象候选", en: "Artwork candidate" },
    summary: { zh: "理性、明亮的数字排版", en: "Rational, bright digital typography" },
    principle: { zh: "保留阅读秩序", en: "Keep reading order" },
    personaCode: "FUTURE-1",
    version: "v0.1",
    status: "draft" as const,
    artworkUrl: "",
    artworkAlt: { zh: "未来编辑形象", en: "Future editor portrait" },
    tags: [],
    referenceCount: 0,
    styleDna: {
      palette: [],
      typography: { zh: "", en: "" },
      composition: { zh: "", en: "" },
      texture: { zh: "", en: "" },
    },
    negativeRules: [],
    portfolioSheets: [],
  };
  const submitDesignerArtworkGeneration = vi.fn(async () => ({
    id: "task-artwork",
    requestId: "request-artwork",
    state: "completed" as const,
    cancelRequested: false,
    attempt: 1,
    source: { kind: "designer-draft" as const, id: candidate.id },
    result: { assetIds: ["artwork-portrait-1"], imageCount: 1 },
  }));
  const readDesignerArtwork = vi.fn(async () => ({
    artworkId: "artwork-portrait-1",
    dataUrl: "data:image/png;base64,AQID",
  }));
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    submitConversation: vi.fn(async () => ({
      id: "task-candidate",
      requestId: "request-candidate",
      state: "completed" as const,
      cancelRequested: false,
      attempt: 1,
      source: { kind: "designer-draft" as const, id: "draft-source" },
      result: { text: JSON.stringify({ candidates: [candidate] }) },
    })),
    submitDesignerArtworkGeneration,
    readDesignerArtwork,
    saveDesignerState,
  } as typeof window.designhub;

  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} workspaceId="workspace-1" />);
  fireEvent.click(await screen.findByRole("button", { name: "创建" }));
  fireEvent.change(screen.getByRole("textbox", { name: "风格描述" }), {
    target: { value: "理性、明亮的数字排版" },
  });
  fireEvent.click(screen.getByRole("button", { name: "生成" }));
  fireEvent.click(await screen.findByRole("button", { name: /候选 1/ }));
  fireEvent.click(screen.getByRole("button", { name: "生成形象" }));

  await waitFor(() => expect(submitDesignerArtworkGeneration).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId: "workspace-1",
    source: { kind: "designer-draft", id: candidate.id },
    prompt: expect.stringContaining("Future editor"),
  })));
  await waitFor(() => expect(readDesignerArtwork).toHaveBeenCalledWith({
    workspaceId: "workspace-1",
    artworkId: "artwork-portrait-1",
  }));
  expect(screen.getByRole("img", { name: "未来编辑形象的人物形象" })).toHaveAttribute(
    "src",
    "designhub-artwork://artwork-portrait-1",
  );
  fireEvent.click(screen.getByRole("button", { name: "发布预览" }));
  await waitFor(() =>
    expect(saveDesignerState).toHaveBeenCalledWith(
      "workspace-1",
      expect.objectContaining({
        profiles: expect.arrayContaining([
          expect.objectContaining({
            status: "published",
            artworkAssetId: "artwork-portrait-1",
            artworkUrl: "designhub-artwork://artwork-portrait-1",
          }),
        ]),
      }),
    ),
  );
  const persistedProfiles = saveDesignerState.mock.calls
    .flatMap(([, state]) => state.profiles)
    .filter((profile) => profile.artworkAssetId === "artwork-portrait-1");
  expect(persistedProfiles).toHaveLength(1);
  expect(persistedProfiles[0]?.artworkUrl).not.toMatch(/^data:/u);
});

it("disables artwork generation for offline example candidates", async () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "创建" }));
  fireEvent.change(screen.getByRole("textbox", { name: "风格描述" }), {
    target: { value: "克制的编辑风格" },
  });
  fireEvent.click(screen.getByRole("button", { name: "生成" }));
  fireEvent.click(await screen.findByRole("button", { name: /候选 1/ }));
  expect(screen.getByRole("button", { name: "生成形象" })).toBeDisabled();
});

it("does not show fabricated candidates when the completed portfolio task failed", async () => {
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    submitPortfolioAnalysis: vi.fn(async () => ({
      id: "task-failed",
      requestId: "request-1",
      state: "running" as const,
      cancelRequested: false,
      attempt: 1,
    })),
    listTasks: vi.fn(async () => [
      {
        id: "task-failed",
        requestId: "request-1",
        state: "failed" as const,
        cancelRequested: false,
        attempt: 1,
        source: { kind: "designer-draft" as const, id: "designer-draft-2" },
        errorCode: "PROVIDER_REQUEST_FAILED",
      },
    ]),
  };
  render(
    <DesignerLibrary
      locale="zh-CN"
      notify={vi.fn()}
      workspaceId="workspace-1"
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "创建" }));
  fireEvent.click(screen.getByRole("button", { name: "作品集" }));
  fireEvent.change(screen.getByRole("textbox", { name: "作品来源" }), {
    target: { value: "https://example.com/portfolio.png" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "生成" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: /候选/ }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("作品集分析失败");
});

it("polls a running portfolio task until completed candidates are available", async () => {
  vi.useFakeTimers();
  try {
    const candidate = {
      id: "portfolio-candidate-poll",
      name: { zh: "轮询候选", en: "Polled candidate" },
      signature: { zh: "", en: "" },
      summary: { zh: "完成", en: "Ready" },
      principle: { zh: "", en: "" },
      personaCode: "POLL-1",
      version: "v0.1",
      status: "draft",
      artworkUrl: "",
      artworkAlt: { zh: "候选", en: "Candidate" },
      tags: [],
      referenceCount: 0,
      styleDna: {
        palette: [],
        typography: { zh: "", en: "" },
        composition: { zh: "", en: "" },
        texture: { zh: "", en: "" },
      },
      negativeRules: [],
      portfolioSheets: [],
    };
    const listTasks = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "task-poll",
          requestId: "request-poll",
          state: "running" as const,
          cancelRequested: false,
          attempt: 1,
          source: {
            kind: "designer-draft" as const,
            id: "designer-draft-poll",
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "task-poll",
          requestId: "request-poll",
          state: "completed" as const,
          cancelRequested: false,
          attempt: 1,
          source: {
            kind: "designer-draft" as const,
            id: "designer-draft-poll",
          },
          result: { text: JSON.stringify({ candidates: [candidate] }) },
        },
      ]);
    window.designhub = {
      chooseWorkspaceDirectory: async () => null,
      submitPortfolioAnalysis: vi.fn(async () => ({
        id: "task-poll",
        requestId: "request-poll",
        state: "running" as const,
        cancelRequested: false,
        attempt: 1,
      })),
      listTasks,
    };
    render(
      <DesignerLibrary
        locale="zh-CN"
        notify={vi.fn()}
        workspaceId="workspace-poll"
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "创建" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "作品集" }));
    });
    fireEvent.change(screen.getByRole("textbox", { name: "作品来源" }), {
      target: { value: "https://example.com/poll.png" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "生成" }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(listTasks).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(listTasks).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: /轮询候选/ }),
    ).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

it("submits a description analysis task and reviews completed candidates in a workspace", async () => {
  const candidate = {
    id: "description-candidate-1",
    name: { zh: "描述候选", en: "Description candidate" },
    signature: { zh: "风格草稿", en: "Style draft" },
    summary: { zh: "克制排版", en: "Restrained type" },
    principle: { zh: "保留呼吸感", en: "Keep breathing room" },
    personaCode: "DESCRIPTION-1",
    version: "v0.1",
    status: "draft",
    artworkUrl: "",
    artworkAlt: { zh: "候选", en: "Candidate" },
    tags: [],
    referenceCount: 0,
    styleDna: {
      palette: [],
      typography: { zh: "", en: "" },
      composition: { zh: "", en: "" },
      texture: { zh: "", en: "" },
    },
    negativeRules: [],
    portfolioSheets: [],
  };
  const submitConversation = vi.fn(async () => ({
    id: "task-description",
    requestId: "request-description",
    state: "running" as const,
    cancelRequested: false,
    attempt: 1,
  }));
  const listTasks = vi.fn(async () => [
    {
      id: "task-description",
      requestId: "request-description",
      state: "completed" as const,
      cancelRequested: false,
      attempt: 1,
      source: { kind: "designer-draft" as const, id: "designer-draft-description" },
      result: { text: JSON.stringify({ candidates: [candidate] }) },
    },
  ]);
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    submitConversation,
    listTasks,
  };
  render(
    <DesignerLibrary
      locale="zh-CN"
      notify={vi.fn()}
      workspaceId="workspace-description"
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "创建" }));
  fireEvent.change(screen.getByRole("textbox", { name: "风格描述" }), {
    target: { value: "克制、纸张和清晰层级" },
  });
  fireEvent.click(screen.getByRole("button", { name: "生成" }));
  const candidateButton = await screen.findByRole("button", {
    name: /描述候选/,
  });
  expect(submitConversation).toHaveBeenCalledWith(
    expect.objectContaining({
      workspaceId: "workspace-description",
      source: expect.objectContaining({ kind: "designer-draft" }),
      message: expect.stringContaining("克制、纸张和清晰层级"),
    }),
  );
  expect(candidateButton).toBeInTheDocument();
});

it("reviews a description task that completes during submission without listing tasks", async () => {
  const candidate = {
    id: "description-immediate-candidate",
    name: { zh: "即时候选", en: "Immediate candidate" },
    signature: { zh: "即时草稿", en: "Immediate draft" },
    summary: { zh: "清晰层级", en: "Clear hierarchy" },
    principle: { zh: "克制", en: "Restrained" },
    personaCode: "DESCRIPTION-IMMEDIATE",
    version: "v0.1",
    status: "draft",
    artworkUrl: "",
    artworkAlt: { zh: "候选", en: "Candidate" },
    tags: [],
    referenceCount: 0,
    styleDna: {
      palette: [],
      typography: { zh: "", en: "" },
      composition: { zh: "", en: "" },
      texture: { zh: "", en: "" },
    },
    negativeRules: [],
    portfolioSheets: [],
  };
  const submitConversation = vi.fn(async () => ({
    id: "task-description-immediate",
    requestId: "request-description-immediate",
    state: "completed" as const,
    cancelRequested: false,
    attempt: 1,
    result: { text: JSON.stringify({ candidates: [candidate] }) },
  }));
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    submitConversation,
  };
  render(
    <DesignerLibrary
      locale="zh-CN"
      notify={vi.fn()}
      workspaceId="workspace-description-immediate"
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "创建" }));
  fireEvent.change(screen.getByRole("textbox", { name: "风格描述" }), {
    target: { value: "即时、清晰、克制" },
  });
  fireEvent.click(screen.getByRole("button", { name: "生成" }));
  expect(
    await screen.findByRole("button", { name: /即时候选/ }),
  ).toBeInTheDocument();
  expect(submitConversation).toHaveBeenCalledOnce();
});

it("presents three example candidates and marks preview publish as session-only", () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "创建" }));
  fireEvent.change(screen.getByRole("textbox", { name: "风格描述" }), {
    target: { value: "纸张、城市与留白" },
  });
  fireEvent.click(screen.getByRole("button", { name: "生成" }));
  const candidates = screen.getAllByRole("button", { name: /候选/ });
  expect(candidates).toHaveLength(3);
  fireEvent.click(candidates[1]!);
  expect(candidates[1]).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "发布预览" }));
  expect(
    screen.getByText("已在本次示例会话中发布，不会写入磁盘。"),
  ).toBeInTheDocument();
});

it("hydrates and persists designer state through the desktop workspace bridge", async () => {
  const loadDesignerState = vi.fn(async () => ({
    profiles: [],
    defaultId: "builtin-v1",
    drafts: { newDraft: { name: "工作区草稿" } },
  }));
  const saveDesignerState = vi.fn(async () => true);
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    loadDesignerState,
    saveDesignerState,
  };
  render(
    <DesignerLibrary
      locale="zh-CN"
      notify={vi.fn()}
      workspaceId="workspace-1"
    />,
  );
  await waitFor(() =>
    expect(loadDesignerState).toHaveBeenCalledWith("workspace-1"),
  );
  fireEvent.click(screen.getByRole("button", { name: "创建" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "名称" })).toHaveValue(
      "工作区草稿",
    ),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "名称" }), {
    target: { value: "已保存草稿" },
  });
  await waitFor(() =>
    expect(saveDesignerState).toHaveBeenCalledWith(
      "workspace-1",
      expect.objectContaining({
        drafts: expect.objectContaining({
          newDraft: expect.objectContaining({ name: "已保存草稿" }),
        }),
      }),
    ),
  );
});

it("keeps builtin profiles available when persisted state has no profiles", async () => {
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    loadDesignerState: vi.fn(async () => ({
      profiles: [],
      defaultId: "missing",
    })),
    saveDesignerState: vi.fn(async () => true),
  };
  render(
    <DesignerLibrary
      locale="zh-CN"
      notify={vi.fn()}
      workspaceId="workspace-empty"
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /纸感排版/ }),
    ).toBeInTheDocument(),
  );
  expect(screen.getByRole("button", { name: "当前默认" })).toBeInTheDocument();
});

it("disables mutation actions in a read-only workspace", async () => {
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    loadDesignerState: vi.fn(async () => null),
    saveDesignerState: vi.fn(async () => true),
  };
  render(
    <DesignerLibrary
      locale="zh-CN"
      notify={vi.fn()}
      workspaceId="workspace-readonly"
      readOnly
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /纸感排版/ }),
    ).toBeInTheDocument(),
  );
  expect(
    screen.queryByRole("button", { name: "创建" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "编辑" })).toBeDisabled();
});

it("does not allow a draft profile to become the session default", () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "创建" }));
  fireEvent.change(screen.getByRole("textbox", { name: "名称" }), {
    target: { value: "草稿设计师" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保留" }));
  expect(screen.getByRole("button", { name: "设默认" })).toBeDisabled();
});

it("restores a referenced archived profile without changing its built-in or published status", () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /清晰商业/ }));
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  expect(screen.getByRole("button", { name: "恢复" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "恢复" }));
  expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument();
});

it("does not invoke a later save until the previous save settles", async () => {
  const firstSave = createDeferred<boolean>();
  const loadDesignerState = vi.fn(async () => ({
    profiles: [],
    defaultId: "builtin-v1",
  }));
  const saveDesignerState = vi.fn(async () => {
    if (saveDesignerState.mock.calls.length === 1) return firstSave.promise;
    return true;
  });
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    loadDesignerState,
    saveDesignerState,
  };
  render(
    <DesignerLibrary
      locale="zh-CN"
      notify={vi.fn()}
      workspaceId="workspace-queue"
    />,
  );
  await waitFor(() => expect(saveDesignerState).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "创建" }));
  fireEvent.change(screen.getByRole("textbox", { name: "名称" }), {
    target: { value: "队列测试" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保留" }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(saveDesignerState).toHaveBeenCalledTimes(1);
  firstSave.resolve(true);
  await waitFor(() =>
    expect(saveDesignerState.mock.calls.length).toBeGreaterThan(1),
  );
});

it("disables using a designer for new work while loading has failed", async () => {
  const loadDesignerState = vi.fn(async () => {
    throw new Error("READ_FAILED");
  });
  const onUseForNew = vi.fn();
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    loadDesignerState,
    saveDesignerState: vi.fn(async () => true),
  };
  render(
    <DesignerLibrary
      locale="zh-CN"
      notify={vi.fn()}
      workspaceId="workspace-failed"
      onUseForNew={onUseForNew}
    />,
  );
  await waitFor(() =>
    expect(screen.getByText("设计师档案读取失败。")).toBeInTheDocument(),
  );
  expect(screen.getByRole("button", { name: "用于新建" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
});
