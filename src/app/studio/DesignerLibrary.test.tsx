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
  expect(screen.getByText("否定规则")).toBeInTheDocument();
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
  expect(within(dialog).queryByRole("textbox", { name: "作品集链接" })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "检查页面" })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "检查图片" })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "选择图片" })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "选择 ZIP" })).not.toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "上传作品集文件" }).closest(".ui-drawer__content")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "开始分析" }).closest(".ui-drawer__footer")).toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "描述" })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("textbox", { name: "风格描述" })).not.toBeInTheDocument();
});

it("keeps the portfolio creation drawer at one width", () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} preview initialProfiles={personaProfiles} />);

  fireEvent.click(screen.getByRole("button", { name: "从作品集创建" }));

  const drawer = screen.getByRole("dialog", { name: "导入作品集分析 · 生成 AI 设计师档案" });
  expect(drawer).toHaveClass("ui-drawer--portfolio");
  expect(drawer).not.toHaveClass("ui-drawer--compact", "ui-drawer--wide");
  expect(within(drawer).getByRole("list", { name: "生成流程" })).toHaveTextContent("1导入作品");
  expect(within(drawer).getByRole("button", { name: "开始分析" })).toBeInTheDocument();
});

it("keeps portfolio analysis in the drawer and shows a loading skeleton", async () => {
  const submission = createDeferred<{ id: string; requestId: string; state: "running"; cancelRequested: false; attempt: number; }>();
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    inspectPortfolioSources: vi.fn(async () => ({
      id: "inspection-loading",
      candidates: [{ id: "source-loading", label: "Portfolio", description: "Portfolio", origin: "local-image" as const, previewUrl: "" }],
    })),
    submitPortfolioSelection: vi.fn(() => submission.promise),
  };
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} workspaceId="workspace-loading" />);

  fireEvent.click(await screen.findByRole("button", { name: "从作品集创建" }));
  fireEvent.click(screen.getByRole("button", { name: "上传作品集文件" }));
  await screen.findByText("Portfolio");
  expect(screen.getByRole("checkbox", { name: "Portfolio" })).toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "我确认拥有分析这些来源的权利" }));
  fireEvent.click(screen.getByRole("button", { name: "开始分析" }));

  const drawer = screen.getByRole("dialog", { name: "导入作品集分析 · 生成 AI 设计师档案" });
  expect(drawer).toHaveClass("ui-drawer--portfolio");
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

it("selects local portfolio candidates by default and submits after an explicit deselection", async () => {
  const inspectPortfolioSources = vi.fn(async () => ({
    id: "inspection-1",
    candidates: [
      { id: "candidate-a", label: "Cover", description: "Cover", origin: "local-image" as const, previewUrl: "data:image/png;base64,cG5n" },
      { id: "candidate-b", label: "Detail", description: "Detail", origin: "local-image" as const, previewUrl: "data:image/png;base64,cG5n" },
    ],
  }));
  const submitPortfolioSelection = vi.fn(async () => ({
    id: "task-selected", requestId: "request-selected", state: "running" as const, cancelRequested: false, attempt: 1,
  }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, inspectPortfolioSources, submitPortfolioSelection };
  render(<DesignerLibrary locale="en" notify={vi.fn()} workspaceId="workspace-selected" />);

  fireEvent.click(await screen.findByRole("button", { name: "Create from portfolio" }));
  fireEvent.click(screen.getByRole("button", { name: "Upload portfolio files" }));
  await screen.findByText("Cover");
  expect(screen.getByRole("checkbox", { name: "Cover" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Detail" })).toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "Detail" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /I confirm/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start analysis" }));

  await waitFor(() => expect(submitPortfolioSelection).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId: "workspace-selected", selections: [{ inspectionId: "inspection-1", sourceIds: ["candidate-a"] }], rightsConfirmed: true,
  })));
  expect(inspectPortfolioSources).toHaveBeenCalledWith({ workspaceId: "workspace-selected", request: { kind: "local-files" } });
});

it("keeps an inspected selection available for retry when portfolio submission rejects", async () => {
  const inspectPortfolioSources = vi.fn(async () => ({
    id: "inspection-retry",
    candidates: [{ id: "candidate-retry", label: "Retry source", description: "Retry source", origin: "local-image" as const, previewUrl: "" }],
  }));
  const submitPortfolioSelection = vi.fn(async () => { throw new Error("TASK_ACCEPTANCE_FAILED"); });
  window.designhub = { chooseWorkspaceDirectory: async () => null, inspectPortfolioSources, submitPortfolioSelection };
  render(<DesignerLibrary locale="en" notify={vi.fn()} workspaceId="workspace-retry" />);

  fireEvent.click(await screen.findByRole("button", { name: "Create from portfolio" }));
  fireEvent.click(screen.getByRole("button", { name: "Upload portfolio files" }));
  await screen.findByText("Retry source");
  fireEvent.click(screen.getByRole("checkbox", { name: /I confirm/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start analysis" }));

  await screen.findByRole("alert");
  expect(screen.getByRole("checkbox", { name: "Retry source" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: /I confirm/ })).toBeChecked();
});

it("submits a rights-confirmed portfolio analysis task for a workspace designer draft", async () => {
  const inspectPortfolioSources = vi.fn(async () => ({
    id: "inspection-submit",
    candidates: [{ id: "source-submit", label: "Portfolio", description: "Portfolio", origin: "local-image" as const, previewUrl: "data:image/png;base64,cG5n" }],
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
  fireEvent.click(screen.getByRole("button", { name: "上传作品集文件" }));
  await screen.findByText("Portfolio");
  fireEvent.click(screen.getByRole("checkbox", { name: "我确认拥有分析这些来源的权利" }));
  fireEvent.click(screen.getByRole("button", { name: "开始分析" }));
  await waitFor(() =>
    expect(submitPortfolioSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        source: expect.objectContaining({ kind: "designer-draft" }),
        selections: [{ inspectionId: "inspection-submit", sourceIds: ["source-submit"] }],
        rightsConfirmed: true,
      }),
    ),
  );
});

it("inspects locally chosen portfolio images through the trusted main process", async () => {
  const longFilename = "a-very-long-portfolio-filename-that-must-not-overflow-the-drawer-layout.png";
  const inspectPortfolioSources = vi.fn(async () => ({
    id: "inspection-local",
    candidates: [{ id: "source-local", label: longFilename, description: "Reference", origin: "local-image" as const, previewUrl: "" }],
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
  fireEvent.click(screen.getByRole("button", { name: "Upload portfolio files" }));
  const filename = await screen.findByText(longFilename);
  expect(within(screen.getByRole("group", { name: "Portfolio candidates" })).queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: longFilename })).toBeChecked();
  expect(filename).toHaveClass("designer-portfolio-candidate__name");
  expect(filename).toHaveAttribute("title", longFilename);
  fireEvent.click(screen.getByRole("checkbox", { name: /I confirm/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start analysis" }));
  await waitFor(() => expect(submitPortfolioSelection).toHaveBeenCalledWith(expect.objectContaining({
    selections: [{ inspectionId: "inspection-local", sourceIds: ["source-local"] }], rightsConfirmed: true,
  })));
  expect(inspectPortfolioSources).toHaveBeenCalledWith({ workspaceId: "workspace-files", request: { kind: "local-files" } });
});

it("keeps the current local inspection when the next file picker is cancelled", async () => {
  const inspectPortfolioSources = vi.fn()
    .mockResolvedValueOnce({
      id: "inspection-kept",
      candidates: [{ id: "source-kept", label: "Keep me.png", description: "Keep me", origin: "local-image" as const, previewUrl: "" }],
    })
    .mockResolvedValueOnce(null);
  window.designhub = { chooseWorkspaceDirectory: async () => null, inspectPortfolioSources };
  render(<DesignerLibrary locale="en" notify={vi.fn()} workspaceId="workspace-cancel" />);

  fireEvent.click(await screen.findByRole("button", { name: "Create from portfolio" }));
  fireEvent.click(screen.getByRole("button", { name: "Upload portfolio files" }));
  await screen.findByText("Keep me.png");
  expect(screen.getByRole("checkbox", { name: "Keep me.png" })).toBeChecked();

  fireEvent.click(screen.getByRole("button", { name: "Upload portfolio files" }));
  await waitFor(() => expect(inspectPortfolioSources).toHaveBeenCalledTimes(2));
  expect(screen.getByText("Keep me.png")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Keep me.png" })).toBeChecked();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("keeps files, rights, and source selection when returning from analysis", async () => {
  const candidate = { ...personaProfiles[0]!, id: "retained-analysis" };
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    inspectPortfolioSources: vi.fn(async () => ({
      id: "inspection-retained",
      candidates: [
        { id: "cover", label: "Cover", description: "Cover", origin: "local-image" as const, previewUrl: "" },
        { id: "detail", label: "Detail", description: "Detail", origin: "local-image" as const, previewUrl: "" },
      ],
    })),
    submitPortfolioSelection: vi.fn(async () => ({
      id: "task-retained",
      requestId: "request-retained",
      state: "completed" as const,
      cancelRequested: false,
      attempt: 1,
      result: { text: JSON.stringify({ candidates: [candidate] }) },
    })),
  };
  render(<DesignerLibrary locale="en" notify={vi.fn()} workspaceId="workspace-retained" />);

  fireEvent.click(await screen.findByRole("button", { name: "Create from portfolio" }));
  fireEvent.click(screen.getByRole("button", { name: "Upload portfolio files" }));
  await screen.findByText("Cover");
  fireEvent.click(screen.getByRole("checkbox", { name: "Detail" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /I confirm/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start analysis" }));
  fireEvent.click(await screen.findByRole("button", { name: "Back to import" }));

  expect(screen.getByRole("checkbox", { name: "Cover" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Detail" })).not.toBeChecked();
  expect(screen.getByRole("checkbox", { name: /I confirm/ })).toBeChecked();
});

it("renders a completed portfolio candidate as a read-only analysis report", async () => {
  const saveDesignerState = vi.fn(async () => true);
  const notify = vi.fn();
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
      typography: { zh: "高对比衬线体配合紧凑说明文字，建立清晰而克制的阅读层级。", en: "High-contrast serif with compact supporting copy." },
      composition: { zh: "对称网格与非对称垂直流结合，主体沿明确基线推进。", en: "A grid combined with asymmetric vertical flow." },
      texture: { zh: "粗粝纸张、低对比颗粒与柔和漫反射共同构成触感。", en: "Rough paper, subtle grain, and soft diffusion." },
      signals: {
        contrast: 68,
        darkAiriness: 82,
        whitespace: 38,
        grain: 15,
        diffuseLight: 92,
        typeFamily: { zh: "宋体倾向", en: "Serif tendency" },
        typeWeight: { zh: "半粗体", en: "Semibold" },
        tracking: { zh: "紧凑", en: "Compact" },
        compositionTopology: { zh: "非对称垂直流", en: "Asymmetric vertical flow" },
        rendering: { zh: "柔和纸张漫反射", en: "Soft paper diffusion" },
      },
    },
    negativeRules: [{ zh: "避免霓虹渐变", en: "Avoid neon gradients" }],
    portfolioSheets: [],
  };
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    inspectPortfolioSources: vi.fn(async () => ({
      id: "inspection-complete",
      candidates: [{ id: "source-complete", label: "Portfolio", description: "Portfolio", origin: "local-image" as const, previewUrl: "" }],
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
      notify={notify}
      workspaceId="workspace-1"
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "从作品集创建" }));
  fireEvent.click(screen.getByRole("button", { name: "上传作品集文件" }));
  await screen.findByText("Portfolio");
  fireEvent.click(screen.getByRole("checkbox", { name: "我确认拥有分析这些来源的权利" }));
  fireEvent.click(screen.getByRole("button", { name: "开始分析" }));
  await screen.findByRole("heading", { name: "作品集候选" });
  const drawer = screen.getByRole("dialog", { name: "导入作品集分析 · 生成 AI 设计师档案" });
  expect(drawer).toHaveClass("ui-drawer--portfolio");
  const report = within(drawer).getByRole("region", { name: "作品集候选的视觉 DNA 分析" });
  expect(within(report).getByText("克制构成")).toBeInTheDocument();
  expect(within(report).getByText("保留层次")).toBeInTheDocument();
  expect(within(report).getByText("#F5F0E6")).toBeInTheDocument();
  expect(within(report).getByText(candidate.styleDna.typography.zh)).toBeInTheDocument();
  expect(within(report).getByText(candidate.styleDna.composition.zh)).toBeInTheDocument();
  expect(within(report).getByText(candidate.styleDna.texture.zh)).toBeInTheDocument();
  expect(within(report).getByText("柔和纸张漫反射")).toBeInTheDocument();
  const negativeRule = within(report).getByText("避免霓虹渐变");
  expect(negativeRule).toHaveAttribute("title", "避免霓虹渐变");
  expect(negativeRule).toHaveClass("portfolio-analysis-rule__text");
  expect(within(report).getAllByRole("progressbar")).toHaveLength(5);
  expect(within(report).queryByRole("textbox")).not.toBeInTheDocument();
  expect(within(report).queryByRole("spinbutton")).not.toBeInTheDocument();
  expect(within(report).queryByRole("button", { name: /自定义否定/ })).not.toBeInTheDocument();
  expect(within(drawer).getByRole("button", { name: "重新解析" })).toBeInTheDocument();
  expect(within(drawer).queryByRole("button", { name: "追加作品集" })).not.toBeInTheDocument();
  expect(notify).toHaveBeenCalledWith("作品集分析已完成，已生成视觉 DNA 报告。");
  expect(screen.getByRole("button", { name: "下一步：生成形象" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "发布预览" })).not.toBeInTheDocument();
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
      candidates: [{ id: "source-artwork", label: "作品集", description: "Artwork portfolio", origin: "local-image" as const, previewUrl: "" }],
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
  fireEvent.click(screen.getByRole("button", { name: "上传作品集文件" }));
  await screen.findByText("作品集");
  fireEvent.click(screen.getByRole("checkbox", { name: "我确认拥有分析这些来源的权利" }));
  fireEvent.click(screen.getByRole("button", { name: "开始分析" }));
  await screen.findByRole("heading", { name: "未来编辑" });
  const report = screen.getByRole("region", { name: "未来编辑的视觉 DNA 分析" });
  expect(within(report).getAllByText("未提取")).toHaveLength(5);
  expect(within(report).getAllByText("--")).toHaveLength(5);
  expect(within(report).queryByText("NaN%")).not.toBeInTheDocument();
  expect(within(report).getAllByRole("progressbar").every((metric) => !metric.hasAttribute("aria-valuenow"))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "下一步：生成形象" }));

  await waitFor(() => expect(submitDesignerArtworkGeneration).toHaveBeenCalledWith(expect.objectContaining({
    workspaceId: "workspace-1",
    source: { kind: "designer-draft", id: candidate.id },
    prompt: expect.stringContaining("Future editor"),
    count: 1,
  })));
  await waitFor(() => expect(readDesignerArtwork).toHaveBeenCalledWith({
    workspaceId: "workspace-1",
    artworkId: "artwork-portrait-1",
  }));
  expect(screen.getByRole("img", { name: "生成的设计师 Avatar" })).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "形象选项" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "返回分析" }));
  expect(screen.getByRole("region", { name: "未来编辑的视觉 DNA 分析" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "下一步：生成形象" }));
  expect(screen.getByRole("img", { name: "生成的设计师 Avatar" })).toBeInTheDocument();
  expect(submitDesignerArtworkGeneration).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "下一步：预览发布" }));
  const dossier = screen.getByRole("region", { name: "未来编辑设计师档案" });
  expect(within(dossier).getByRole("img", { name: /未来编辑形象/ })).toHaveAttribute("src", "designhub-artwork://artwork-portrait-1");
  expect(within(dossier).getByRole("region", { name: "核心指标" })).toBeInTheDocument();
  expect(within(dossier).getByRole("region", { name: "Style DNA" })).toBeInTheDocument();
  expect(within(dossier).getByRole("region", { name: "否定规则" })).toHaveTextContent("避免霓虹渐变");
  expect(submitDesignerArtworkGeneration).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "返回形象" }));
  expect(screen.getByRole("img", { name: "生成的设计师 Avatar" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "下一步：预览发布" }));
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
  expect(persistedProfiles[0]?.name.en).toBe("Future editor");
  expect(persistedProfiles[0]?.summary.en).toBe("Rational, bright digital typography");
});

it("keeps the review dossier visible when publishing fails", async () => {
  const candidate = { ...personaProfiles[0]!, id: "candidate-publish-failure" };
  const saveDesignerState = vi.fn(async () => {
    throw new Error("WRITE_FAILED");
  });
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    inspectPortfolioSources: vi.fn(async () => ({
      id: "inspection-publish-failure",
      candidates: [{ id: "source-publish-failure", label: "Portfolio", description: "Portfolio", origin: "local-image" as const, previewUrl: "" }],
    })),
    submitPortfolioSelection: vi.fn(async () => ({
      id: "task-analysis-publish-failure",
      requestId: "request-analysis-publish-failure",
      state: "completed" as const,
      cancelRequested: false,
      attempt: 1,
      result: { text: JSON.stringify({ candidates: [candidate] }) },
    })),
    submitDesignerArtworkGeneration: vi.fn(async () => ({
      id: "task-artwork-publish-failure",
      requestId: "request-artwork-publish-failure",
      state: "completed" as const,
      cancelRequested: false,
      attempt: 1,
      result: { assetIds: ["artwork-publish-failure"], imageCount: 1 },
    })),
    readDesignerArtwork: vi.fn(async ({ artworkId }) => ({ artworkId, dataUrl: "data:image/png;base64,AQID" })),
    saveDesignerState,
  } as typeof window.designhub;

  render(<DesignerLibrary locale="en" notify={vi.fn()} workspaceId="workspace-publish-failure" />);
  fireEvent.click(await screen.findByRole("button", { name: "Create from portfolio" }));
  fireEvent.click(screen.getByRole("button", { name: "Upload portfolio files" }));
  await screen.findByText("Portfolio");
  fireEvent.click(screen.getByRole("checkbox", { name: /I confirm/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start analysis" }));
  fireEvent.click(await screen.findByRole("button", { name: "Next: generate artwork" }));
  await screen.findByRole("img", { name: "Generated designer Avatar" });
  fireEvent.click(screen.getByRole("button", { name: "Next: preview and publish" }));
  const dossier = screen.getByRole("region", { name: "Paper & Type designer profile" });
  fireEvent.click(screen.getByRole("button", { name: "Publish preview" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Designer publishing failed; try again.");
  expect(dossier).toBeInTheDocument();
  expect(within(dossier).getByRole("img", { name: /Paper & Type/ })).toHaveAttribute("src", "designhub-artwork://artwork-publish-failure");
  expect(screen.queryByText("Published.")).not.toBeInTheDocument();
});

it("keeps the current Avatar when regeneration fails and replaces it after a successful retry", async () => {
  const candidate = { ...personaProfiles[0]!, id: "candidate-regenerate" };
  const submitDesignerArtworkGeneration = vi.fn()
    .mockResolvedValueOnce({
      id: "task-artwork-1", requestId: "request-artwork-1", state: "completed" as const,
      cancelRequested: false, attempt: 1, result: { assetIds: ["artwork-1"], imageCount: 1 },
    })
    .mockRejectedValueOnce(new Error("PROVIDER_REQUEST_FAILED"))
    .mockResolvedValueOnce({
      id: "task-artwork-2", requestId: "request-artwork-2", state: "completed" as const,
      cancelRequested: false, attempt: 1, result: { assetIds: ["artwork-2"], imageCount: 1 },
    });
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    inspectPortfolioSources: vi.fn(async () => ({
      id: "inspection-regenerate",
      candidates: [{ id: "source-regenerate", label: "Portfolio", description: "Portfolio", origin: "local-image" as const, previewUrl: "" }],
    })),
    submitPortfolioSelection: vi.fn(async () => ({
      id: "task-analysis-regenerate", requestId: "request-analysis-regenerate", state: "completed" as const,
      cancelRequested: false, attempt: 1, result: { text: JSON.stringify({ candidates: [candidate] }) },
    })),
    submitDesignerArtworkGeneration,
    readDesignerArtwork: vi.fn(async ({ artworkId }) => ({ artworkId, dataUrl: "data:image/png;base64,AQID" })),
  } as typeof window.designhub;
  render(<DesignerLibrary locale="en" notify={vi.fn()} workspaceId="workspace-regenerate" />);

  fireEvent.click(await screen.findByRole("button", { name: "Create from portfolio" }));
  fireEvent.click(screen.getByRole("button", { name: "Upload portfolio files" }));
  await screen.findByText("Portfolio");
  fireEvent.click(screen.getByRole("checkbox", { name: /I confirm/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start analysis" }));
  fireEvent.click(await screen.findByRole("button", { name: "Next: generate artwork" }));
  const avatar = await screen.findByRole("img", { name: "Generated designer Avatar" });
  expect(avatar).toHaveAttribute("src", "designhub-artwork://artwork-1");

  fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
  await screen.findByText("Character artwork generation failed; try again.");
  expect(screen.getByRole("img", { name: "Generated designer Avatar" })).toHaveAttribute("src", "designhub-artwork://artwork-1");

  fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
  await waitFor(() => expect(screen.getByRole("img", { name: "Generated designer Avatar" })).toHaveAttribute("src", "designhub-artwork://artwork-2"));
  expect(submitDesignerArtworkGeneration).toHaveBeenCalledTimes(3);
});

it("enters the artwork step immediately and keeps polling beyond six seconds until generation completes", async () => {
  try {
    const candidate = {
      id: "candidate-artwork-poll",
      name: { zh: "长时生成", en: "Long generation" },
      signature: { zh: "形象候选", en: "Artwork candidate" },
      summary: { zh: "等待完整生成", en: "Wait for complete generation" },
      principle: { zh: "保持视觉秩序", en: "Keep visual order" },
      personaCode: "LONG-1",
      version: "v0.1",
      status: "draft" as const,
      artworkUrl: "",
      artworkAlt: { zh: "长时生成形象", en: "Long generation portrait" },
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
      id: "task-artwork-poll",
      requestId: "request-artwork-poll",
      state: "running" as const,
      cancelRequested: false,
      attempt: 1,
      source: { kind: "designer-draft" as const, id: candidate.id },
    };
    const completedTask = {
      ...runningTask,
      state: "completed" as const,
      result: { assetIds: ["artwork-long-1"], imageCount: 1 },
    };
    const submission = createDeferred<typeof runningTask>();
    const listTasks = vi.fn();
    Array.from({ length: 13 }).forEach(() => listTasks.mockResolvedValueOnce([runningTask]));
    listTasks.mockResolvedValueOnce([completedTask]);
    window.designhub = {
      chooseWorkspaceDirectory: async () => null,
      inspectPortfolioSources: vi.fn(async () => ({
        id: "inspection-artwork-poll",
        candidates: [{ id: "source-artwork-poll", label: "作品集", description: "Artwork portfolio", origin: "local-image" as const, previewUrl: "" }],
      })),
      submitPortfolioSelection: vi.fn(async () => ({
        id: "task-analysis-artwork-poll",
        requestId: "request-analysis-artwork-poll",
        state: "completed" as const,
        cancelRequested: false,
        attempt: 1,
        result: { text: JSON.stringify({ candidates: [candidate] }) },
      })),
      submitDesignerArtworkGeneration: vi.fn(() => submission.promise),
      listTasks,
      readDesignerArtwork: vi.fn(async () => ({ artworkId: "artwork-long-1", dataUrl: "data:image/png;base64,AQID" })),
    } as typeof window.designhub;

    render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} workspaceId="workspace-artwork-poll" />);
    fireEvent.click(await screen.findByRole("button", { name: "从作品集创建" }));
    fireEvent.click(screen.getByRole("button", { name: "上传作品集文件" }));
    await screen.findByText("作品集");
    fireEvent.click(screen.getByRole("checkbox", { name: "我确认拥有分析这些来源的权利" }));
    fireEvent.click(screen.getByRole("button", { name: "开始分析" }));
    await screen.findByRole("heading", { name: "长时生成" });
    fireEvent.click(screen.getByRole("button", { name: "下一步：生成形象" }));

    expect(screen.getByText("正在生成设计师形象")).toBeInTheDocument();
    expect(screen.getByTestId("portfolio-artwork-skeleton")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "生成流程" }).children[2]).toHaveClass("is-active");

    vi.useFakeTimers();
    await act(async () => {
      submission.resolve(runningTask);
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_500);
    });
    expect(screen.queryByText("人物形象生成失败，请重试。")).not.toBeInTheDocument();
    expect(screen.getByText("正在生成设计师形象")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("img", { name: "生成的设计师 Avatar" })).toBeInTheDocument();
    expect(listTasks).toHaveBeenCalledTimes(14);
  } finally {
    vi.useRealTimers();
  }
});

it("does not show fabricated candidates when the completed portfolio task failed", async () => {
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    inspectPortfolioSources: vi.fn(async () => ({
      id: "inspection-failed",
      candidates: [{ id: "source-failed", label: "Portfolio", description: "Portfolio", origin: "local-image" as const, previewUrl: "" }],
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
  fireEvent.click(screen.getByRole("button", { name: "上传作品集文件" }));
  await screen.findByText("Portfolio");
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
        candidates: [{ id: "source-poll", label: "Portfolio", description: "Portfolio", origin: "local-image" as const, previewUrl: "" }],
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
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "上传作品集文件" }));
      await Promise.resolve();
    });
    expect(screen.getByText("Portfolio")).toBeInTheDocument();
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
      screen.getByRole("heading", { name: "轮询候选" }),
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
