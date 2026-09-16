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
import { personaProfiles } from "../../../tests/fixtures/personas";

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

it("opens a selected persona in the inspector drawer and filters the repository", () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} preview initialProfiles={personaProfiles} />);
  fireEvent.click(screen.getByRole("button", { name: /纸感排版/ }));
  const dialog = screen.getByRole("dialog", { name: "设计师检查器" });
  expect(dialog).toBeInTheDocument();
  expect(dialog.querySelector('.persona-inspector__actions')?.closest('.ui-drawer__footer')).toBeInTheDocument();
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
  fireEvent.click(screen.getByRole("button", { name: "关闭" }));
  expect(screen.queryByRole("dialog", { name: "设计师检查器" })).not.toBeInTheDocument();
});

it("opens new designer creation with portfolio analysis only", () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} preview initialProfiles={personaProfiles} />);

  fireEvent.click(screen.getByRole("button", { name: "从作品集创建" }));

  const dialog = screen.getByRole("dialog", { name: "导入作品集分析 · 生成 AI 设计师档案" });
  expect(within(dialog).getByRole("textbox", { name: "作品集链接" })).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "检查页面" }).closest(".ui-drawer__content")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "检查图片" }).closest(".ui-drawer__content")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "选择图片" }).closest(".ui-drawer__content")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "选择 ZIP" }).closest(".ui-drawer__content")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "开始分析" }).closest(".ui-drawer__footer")).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "描述" })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("textbox", { name: "风格描述" })).not.toBeInTheDocument();
});

it("opens portfolio analysis in a compact drawer", () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} preview initialProfiles={personaProfiles} />);

  fireEvent.click(screen.getByRole("button", { name: "从作品集创建" }));

  const drawer = screen.getByRole("dialog", { name: "导入作品集分析 · 生成 AI 设计师档案" });
  expect(drawer).toHaveClass("ui-drawer--compact");
  expect(within(drawer).getByRole("list", { name: "生成流程" })).toHaveTextContent("1导入作品");
  expect(within(drawer).getByRole("button", { name: "开始分析" })).toBeInTheDocument();
});

it("keeps portfolio analysis in the drawer and shows a loading skeleton", async () => {
  const submission = createDeferred<{ id: string; requestId: string; state: "running"; cancelRequested: false; attempt: number; }>();
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    inspectPortfolioSources: vi.fn(async () => ({
      id: "inspection-loading",
      candidates: [{ id: "source-loading", label: "Portfolio", description: "Portfolio", origin: "page-image" as const, previewUrl: "" }],
    })),
    submitPortfolioSelection: vi.fn(() => submission.promise),
  };
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} workspaceId="workspace-loading" />);

  fireEvent.click(await screen.findByRole("button", { name: "从作品集创建" }));
  fireEvent.change(screen.getByRole("textbox", { name: "作品集链接" }), { target: { value: "https://example.com/loading.png" } });
  fireEvent.click(screen.getByRole("button", { name: "检查页面" }));
  await screen.findByText("Portfolio");
  fireEvent.click(screen.getByRole("checkbox", { name: "Portfolio" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "我确认拥有分析这些来源的权利" }));
  fireEvent.click(screen.getByRole("button", { name: "开始分析" }));

  const drawer = screen.getByRole("dialog", { name: "导入作品集分析 · 生成 AI 设计师档案" });
  expect(drawer).toHaveClass("ui-drawer--compact");
  expect(within(drawer).getByText("正在提炼视觉 DNA")).toBeInTheDocument();
  expect(within(drawer).getByTestId("portfolio-analysis-skeleton")).toBeInTheDocument();
});

it("supports default and use-for-new actions without a direct derivative-creation path", () => {
  const notify = vi.fn();
  const onUseForNew = vi.fn();
  render(
    <DesignerLibrary
      locale="zh-CN"
      notify={notify}
      onUseForNew={onUseForNew}
      preview
      initialProfiles={personaProfiles}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /清晰商业/ }));
  fireEvent.click(screen.getByRole("button", { name: "设默认" }));
  expect(screen.getByRole("button", { name: "当前默认" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "用于新建" }));
  expect(onUseForNew).toHaveBeenCalledWith("clear-commerce");
  expect(screen.queryByRole("button", { name: "派生" })).not.toBeInTheDocument();
});

it("requires portfolio rights confirmation before entering candidate review", () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} preview initialProfiles={personaProfiles} />);
  fireEvent.click(screen.getByRole("button", { name: "从作品集创建" }));
  fireEvent.click(screen.getByRole("button", { name: "开始分析" }));
  expect(
    screen.getByText("请先确认拥有分析这些来源的权利。"),
  ).toBeInTheDocument();
});

it("inspects portfolio candidates and submits only the explicitly checked sources", async () => {
  const inspectPortfolioSources = vi.fn(async () => ({
    id: "inspection-1",
    candidates: [
      { id: "candidate-a", label: "Cover", description: "Cover", origin: "remote-image" as const, previewUrl: "data:image/png;base64,cG5n" },
      { id: "candidate-b", label: "Detail", description: "Detail", origin: "remote-image" as const, previewUrl: "data:image/png;base64,cG5n" },
    ],
  }));
  const submitPortfolioSelection = vi.fn(async () => ({
    id: "task-selected", requestId: "request-selected", state: "running" as const, cancelRequested: false, attempt: 1,
  }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, inspectPortfolioSources, submitPortfolioSelection };
  render(<DesignerLibrary locale="en" notify={vi.fn()} workspaceId="workspace-selected" />);

  fireEvent.click(await screen.findByRole("button", { name: "Create from portfolio" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Portfolio URL" }), { target: { value: "https://public.test/portfolio" } });
  fireEvent.click(screen.getByRole("button", { name: "Inspect page" }));
  await screen.findByText("Cover");
  fireEvent.click(screen.getByRole("checkbox", { name: "Cover" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /I confirm/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start analysis" }));

  await waitFor(() => expect(submitPortfolioSelection).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId: "workspace-selected", inspectionId: "inspection-1", sourceIds: ["candidate-a"], rightsConfirmed: true,
  })));
  expect(inspectPortfolioSources).toHaveBeenCalledWith({ workspaceId: "workspace-selected", request: { kind: "remote-page", url: "https://public.test/portfolio" } });
});

it("keeps an inspected selection available for retry when portfolio submission rejects", async () => {
  const inspectPortfolioSources = vi.fn(async () => ({
    id: "inspection-retry",
    candidates: [{ id: "candidate-retry", label: "Retry source", description: "Retry source", origin: "page-image" as const, previewUrl: "" }],
  }));
  const submitPortfolioSelection = vi.fn(async () => { throw new Error("TASK_ACCEPTANCE_FAILED"); });
  window.designhub = { chooseWorkspaceDirectory: async () => null, inspectPortfolioSources, submitPortfolioSelection };
  render(<DesignerLibrary locale="en" notify={vi.fn()} workspaceId="workspace-retry" />);

  fireEvent.click(await screen.findByRole("button", { name: "Create from portfolio" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Portfolio URL" }), { target: { value: "https://public.test/retry" } });
  fireEvent.click(screen.getByRole("button", { name: "Inspect page" }));
  await screen.findByText("Retry source");
  fireEvent.click(screen.getByRole("checkbox", { name: "Retry source" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /I confirm/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start analysis" }));

  await screen.findByRole("alert");
  expect(screen.getByRole("checkbox", { name: "Retry source" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: /I confirm/ })).toBeChecked();
});

it("submits a rights-confirmed portfolio analysis task for a workspace designer draft", async () => {
  const inspectPortfolioSources = vi.fn(async () => ({
    id: "inspection-submit",
    candidates: [{ id: "source-submit", label: "Portfolio", description: "Portfolio", origin: "page-image" as const, previewUrl: "data:image/png;base64,cG5n" }],
  }));
  const submitPortfolioSelection = vi.fn(async () => ({
    id: "task-portfolio",
    requestId: "request-portfolio",
    state: "running" as const,
    cancelRequested: false,
    attempt: 1,
  }));
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    inspectPortfolioSources,
    submitPortfolioSelection,
  };
  render(
    <DesignerLibrary
      locale="zh-CN"
      notify={vi.fn()}
      workspaceId="workspace-1"
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "从作品集创建" }));
  fireEvent.change(screen.getByRole("textbox", { name: "作品集链接" }), {
    target: { value: "https://example.com/portfolio.png" },
  });
  fireEvent.click(screen.getByRole("button", { name: "检查页面" }));
  await screen.findByText("Portfolio");
  fireEvent.click(screen.getByRole("checkbox", { name: "Portfolio" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "我确认拥有分析这些来源的权利" }));
  fireEvent.click(screen.getByRole("button", { name: "开始分析" }));
  await waitFor(() =>
    expect(submitPortfolioSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        source: expect.objectContaining({ kind: "designer-draft" }),
        inspectionId: "inspection-submit",
        sourceIds: ["source-submit"],
        rightsConfirmed: true,
      }),
    ),
  );
});

it("inspects locally chosen portfolio images through the trusted main process", async () => {
  const inspectPortfolioSources = vi.fn(async () => ({
    id: "inspection-local",
    candidates: [{ id: "source-local", label: "Reference", description: "Reference", origin: "local-image" as const, previewUrl: "" }],
  }));
  const submitPortfolioSelection = vi.fn(async () => ({
    id: "task-file-portfolio",
    requestId: "request-file-portfolio",
    state: "running" as const,
    cancelRequested: false,
    attempt: 1,
  }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, inspectPortfolioSources, submitPortfolioSelection };
  render(<DesignerLibrary locale="en" notify={vi.fn()} workspaceId="workspace-files" />);
  fireEvent.click(await screen.findByRole("button", { name: "Create from portfolio" }));
  fireEvent.click(screen.getByRole("button", { name: "Choose images" }));
  await screen.findByText("Reference");
  expect(within(screen.getByRole("group", { name: "Portfolio candidates" })).queryByRole("img")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Reference" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /I confirm/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start analysis" }));
  await waitFor(() => expect(submitPortfolioSelection).toHaveBeenCalledWith(expect.objectContaining({
    inspectionId: "inspection-local", sourceIds: ["source-local"], rightsConfirmed: true,
  })));
  expect(inspectPortfolioSources).toHaveBeenCalledWith({ workspaceId: "workspace-files", request: { kind: "local-images" } });
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
    tags: [{ zh: "编辑感", en: "Editorial" }],
    referenceCount: 0,
    styleDna: {
      palette: ["#F5F0E6", "#242424"],
      typography: { zh: "高对比衬线体", en: "High-contrast serif" },
      composition: { zh: "对称网格", en: "Symmetrical grid" },
      texture: { zh: "粗粝纸张", en: "Rough paper" },
    },
    negativeRules: [{ zh: "避免霓虹渐变", en: "Avoid neon gradients" }],
    portfolioSheets: [],
  };
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    inspectPortfolioSources: vi.fn(async () => ({
      id: "inspection-complete",
      candidates: [{ id: "source-complete", label: "Portfolio", description: "Portfolio", origin: "page-image" as const, previewUrl: "" }],
    })),
    submitPortfolioSelection: vi.fn(async () => ({
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
  fireEvent.click(await screen.findByRole("button", { name: "从作品集创建" }));
  fireEvent.change(screen.getByRole("textbox", { name: "作品集链接" }), {
    target: { value: "https://example.com/portfolio.png" },
  });
  fireEvent.click(screen.getByRole("button", { name: "检查页面" }));
  await screen.findByText("Portfolio");
  fireEvent.click(screen.getByRole("checkbox", { name: "Portfolio" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "我确认拥有分析这些来源的权利" }));
  fireEvent.click(screen.getByRole("button", { name: "开始分析" }));
  const candidateButton = await screen.findByRole("button", {
    name: /作品集候选/,
  });
  const drawer = screen.getByRole("dialog", { name: "导入作品集分析 · 生成 AI 设计师档案" });
  expect(drawer).toHaveClass("ui-drawer--wide");
  expect(screen.getByRole("button", { name: "生成形象" }).closest(".ui-drawer__footer")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "发布预览" }).closest(".ui-drawer__footer")).toBeInTheDocument();
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
    tags: [{ zh: "编辑感", en: "Editorial" }],
    referenceCount: 0,
    styleDna: {
      palette: ["#F5F0E6", "#242424"],
      typography: { zh: "高对比衬线体", en: "High-contrast serif" },
      composition: { zh: "对称网格", en: "Symmetrical grid" },
      texture: { zh: "粗粝纸张", en: "Rough paper" },
    },
    negativeRules: [{ zh: "避免霓虹渐变", en: "Avoid neon gradients" }],
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
    inspectPortfolioSources: vi.fn(async () => ({
      id: "inspection-artwork",
      candidates: [{ id: "source-artwork", label: "作品集", description: "Artwork portfolio", origin: "page-image" as const, previewUrl: "" }],
    })),
    submitPortfolioSelection: vi.fn(async () => ({
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
  fireEvent.click(await screen.findByRole("button", { name: "从作品集创建" }));
  fireEvent.change(screen.getByRole("textbox", { name: "作品集链接" }), {
    target: { value: "https://example.com/artwork-portfolio" },
  });
  fireEvent.click(screen.getByRole("button", { name: "检查页面" }));
  await screen.findByText("作品集");
  fireEvent.click(screen.getByRole("checkbox", { name: "作品集" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "我确认拥有分析这些来源的权利" }));
  fireEvent.click(screen.getByRole("button", { name: "开始分析" }));
  fireEvent.click(await screen.findByRole("button", { name: /未来编辑/ }));
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

it("does not show fabricated candidates when the completed portfolio task failed", async () => {
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    inspectPortfolioSources: vi.fn(async () => ({
      id: "inspection-failed",
      candidates: [{ id: "source-failed", label: "Portfolio", description: "Portfolio", origin: "page-image" as const, previewUrl: "" }],
    })),
    submitPortfolioSelection: vi.fn(async () => ({
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
  fireEvent.click(await screen.findByRole("button", { name: "从作品集创建" }));
  fireEvent.change(screen.getByRole("textbox", { name: "作品集链接" }), {
    target: { value: "https://example.com/portfolio.png" },
  });
  fireEvent.click(screen.getByRole("button", { name: "检查页面" }));
  await screen.findByText("Portfolio");
  fireEvent.click(screen.getByRole("checkbox", { name: "Portfolio" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "我确认拥有分析这些来源的权利" }));
  fireEvent.click(screen.getByRole("button", { name: "开始分析" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: /候选/ }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("作品集分析失败");
});

it("keeps polling a portfolio task that completes after the initial six-second window", async () => {
  vi.useFakeTimers();
  try {
    const candidate = {
      id: "portfolio-candidate-poll",
      name: { zh: "轮询候选", en: "Polled candidate" },
      signature: { zh: "轮询分析草稿", en: "Polling analysis draft" },
      summary: { zh: "完成", en: "Ready" },
      principle: { zh: "保留清晰层次", en: "Keep a clear hierarchy" },
      personaCode: "POLL-1",
      version: "v0.1",
      status: "draft",
      artworkUrl: "",
      artworkAlt: { zh: "候选", en: "Candidate" },
      tags: [{ zh: "编辑感", en: "Editorial" }],
      referenceCount: 0,
      styleDna: {
        palette: ["#F5F0E6", "#242424"],
        typography: { zh: "高对比衬线体", en: "High-contrast serif" },
        composition: { zh: "对称网格", en: "Symmetrical grid" },
        texture: { zh: "粗粝纸张", en: "Rough paper" },
      },
      negativeRules: [{ zh: "避免霓虹渐变", en: "Avoid neon gradients" }],
      portfolioSheets: [],
    };
    const runningTask = {
      id: "task-poll",
      requestId: "request-poll",
      state: "running" as const,
      cancelRequested: false,
      attempt: 1,
      source: {
        kind: "designer-draft" as const,
        id: "designer-draft-poll",
      },
    };
    const completedTask = {
      ...runningTask,
      state: "completed" as const,
      result: { text: JSON.stringify({ candidates: [candidate] }) },
    };
    const listTasks = vi.fn();
    Array.from({ length: 13 }).forEach(() => {
      listTasks.mockResolvedValueOnce([runningTask]);
    });
    listTasks.mockResolvedValueOnce([completedTask]);
    window.designhub = {
      chooseWorkspaceDirectory: async () => null,
      inspectPortfolioSources: vi.fn(async () => ({
        id: "inspection-poll",
        candidates: [{ id: "source-poll", label: "Portfolio", description: "Portfolio", origin: "page-image" as const, previewUrl: "" }],
      })),
      submitPortfolioSelection: vi.fn(async () => ({
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
      fireEvent.click(screen.getByRole("button", { name: "从作品集创建" }));
    });
    fireEvent.change(screen.getByRole("textbox", { name: "作品集链接" }), {
      target: { value: "https://example.com/poll.png" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "检查页面" }));
      await Promise.resolve();
    });
    expect(screen.getByText("Portfolio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Portfolio" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "我确认拥有分析这些来源的权利" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始分析" }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_500);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(listTasks).toHaveBeenCalledTimes(14);
    expect(
      screen.getByRole("button", { name: /轮询候选/ }),
    ).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

it("hydrates and persists designer state through the desktop workspace bridge", async () => {
  const persistedProfile = { ...personaProfiles[0]!, id: "portfolio-persisted" };
  const loadDesignerState = vi.fn(async () => ({
    profiles: [persistedProfile],
    defaultId: persistedProfile.id,
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
  fireEvent.click(screen.getByRole("button", { name: /纸感排版/ }));
  fireEvent.click(screen.getByRole("button", { name: "编辑" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "名称" })).toHaveValue(
      "纸感排版",
    ),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "名称" }), {
    target: { value: "已保存档案" },
  });
  fireEvent.click(screen.getByRole("button", { name: "保留" }));
  await waitFor(() =>
    expect(saveDesignerState).toHaveBeenCalledWith(
      "workspace-1",
      expect.objectContaining({
        profiles: expect.arrayContaining([
          expect.objectContaining({ name: expect.objectContaining({ zh: "已保存档案" }) }),
        ]),
      }),
    ),
  );
});

it("does not inject built-in profiles into an empty workspace", async () => {
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
    expect(screen.getByText("暂无设计师档案", { exact: false })).toBeInTheDocument(),
  );
  expect(screen.queryByRole("button", { name: /纸感排版/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "当前默认" })).not.toBeInTheDocument();
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
  await waitFor(() => expect(screen.getByText("暂无设计师档案")).toBeInTheDocument());
  expect(
    screen.queryByRole("button", { name: "从作品集创建" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "编辑" })).not.toBeInTheDocument();
});

it("hides legacy seeded profiles in a read-only workspace without inventing a default", async () => {
  const profile = {
    id: 'paper-type', name: { zh: '纸感排版', en: 'Paper & Type' }, signature: { zh: '春间工作室', en: 'Spring Studio' },
    summary: { zh: '', en: '' }, principle: { zh: '', en: '' }, personaCode: 'INTP-A', version: 'v1.4', status: 'published' as const,
    artworkUrl: '/personas/paper-type.png', artworkAlt: { zh: '', en: '' }, tags: [], referenceCount: 5,
    styleDna: { palette: [], typography: { zh: '', en: '' }, composition: { zh: '', en: '' }, texture: { zh: '', en: '' } },
    negativeRules: [], portfolioSheets: [],
  };
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    loadDesignerState: vi.fn(async () => ({ profiles: [profile], defaultId: profile.id })),
  };
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} workspaceId="legacy-read-only" readOnly />);
  await waitFor(() => expect(screen.getByText('暂无设计师档案')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: /纸感排版/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '当前默认' })).not.toBeInTheDocument();
});

it("restores a referenced archived profile without changing its built-in or published status", () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} preview initialProfiles={personaProfiles} />);
  fireEvent.click(screen.getByRole("button", { name: /清晰商业/ }));
  fireEvent.click(screen.getByRole("button", { name: "删除" }));
  expect(screen.getByRole("button", { name: "恢复" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "恢复" }));
  expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument();
});

it("does not invoke a later save until the previous save settles", async () => {
  const firstSave = createDeferred<boolean>();
  const persistedProfile = { ...personaProfiles[0]!, id: "portfolio-queue" };
  const loadDesignerState = vi.fn(async () => ({
    profiles: [persistedProfile],
    defaultId: persistedProfile.id,
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
  fireEvent.click(screen.getByRole("button", { name: /纸感排版/ }));
  fireEvent.click(screen.getByRole("button", { name: "编辑" }));
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
  expect(screen.queryByRole("button", { name: "用于新建" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
});
