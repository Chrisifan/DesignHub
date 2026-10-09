import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { ImageToolsPage } from "./ImageToolsPage";

it("uses the shared page container and centered empty-state region", () => {
  render(
    <ImageToolsPage
      locale="zh-CN"
      jobs={[]}
      onCreate={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
    />,
  );

  expect(screen.getByRole("region", { name: "图像工具" })).toHaveClass(
    "page-content",
    "library-page",
    "image-tools-page",
  );
  expect(
    screen
      .getByRole("heading", { name: "暂无图像作业" })
      .closest(".page-empty-state"),
  ).not.toBeNull();
});

const job = {
  id: "job-1",
  tool: "upscale" as const,
  params: { scale: 2, preserveDetails: "balanced" },
  sourceRoot: "/images/source",
  outputRoot: "/images/output/job-1",
  state: "running" as const,
  itemIds: ["item-1", "item-2"],
  createdAt: "2026-09-28T10:00:00.000Z",
  updatedAt: "2026-09-28T10:10:00.000Z",
};

const items = [
  {
    id: "item-1",
    jobId: "job-1",
    relativePath: "catalog/hero.png",
    state: "completed" as const,
    attempt: 1,
    resultPath: "/images/output/job-1/catalog/hero.png",
    updatedAt: "2026-09-28T10:10:00.000Z",
  },
  {
    id: "item-2",
    jobId: "job-1",
    relativePath: "catalog/detail.png",
    state: "running" as const,
    attempt: 1,
    updatedAt: "2026-09-28T10:10:00.000Z",
  },
];

it("offers all four batch tools from one workbench", () => {
  render(
    <ImageToolsPage
      locale="zh-CN"
      tool="upscale"
      jobs={[]}
      onCreate={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
    />,
  );

  expect(screen.getByRole("heading", { level: 1, name: "放大图像" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "批量工具" })).not.toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "批量工具" })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "批量工具" })).toHaveValue("upscale");
});

it("shows only the fixed tool parameters in the new job drawer", () => {
  render(
    <ImageToolsPage
      locale="zh-CN"
      tool="upscale"
      jobs={[]}
      onCreate={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "新建作业 / 选择文件" }));
  expect(screen.getByRole("dialog", { name: /新建作业/ })).toBeInTheDocument();
  expect(screen.getByLabelText("倍率")).toBeInTheDocument();
  expect(screen.queryByLabelText("宽度")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "尺寸转换" })).not.toBeInTheDocument();
});

it("exposes a JPEG background for local conversion tools", () => {
  render(
    <ImageToolsPage
      locale="zh-CN"
      tool="format-convert"
      jobs={[]}
      onCreate={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "新建作业 / 选择文件" }));
  expect(screen.getByLabelText("输出格式")).toBeInTheDocument();
  expect(screen.getByLabelText("JPEG 背景")).toBeInTheDocument();
});

it("allows creating accepted items when the scan also reports rejected items", async () => {
  const onScan = vi.fn(async () => ({
    accepted: [{ relativePath: "ok.png" }],
    rejected: [{ path: "bad.txt", code: "UNSUPPORTED_FORMAT" }],
  }));
  const onCreate = vi.fn();
  render(
    <ImageToolsPage
      locale="zh-CN"
      tool="resize"
      jobs={[]}
      onCreate={onCreate}
      onChooseInput={vi.fn(async () => ({ path: "/images/source", displayName: "source" }))}
      onChooseOutput={vi.fn(async () => ({ path: "/images/output", displayName: "output" }))}
      onScan={onScan}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "新建作业 / 选择文件" }));
  fireEvent.click(screen.getByRole("button", { name: "选择文件 / 文件夹" }));
  await waitFor(() => expect(screen.getByText("来源：source")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "选择输出位置" }));
  await waitFor(() => expect(screen.getByText("输出：output")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "扫描来源" }));
  await waitFor(() => expect(onScan).toHaveBeenCalledOnce());

  const createButton = screen.getByRole("button", { name: "创建作业" });
  expect(createButton).not.toBeDisabled();
  expect(screen.getByText(/bad\.txt/)).toBeInTheDocument();
});

it("exposes native source and output pickers for a new background-removal job", () => {
  const chooseInput = vi.fn(async () => ({ path: "/images/source", displayName: "source" }));
  const chooseOutput = vi.fn(async () => ({ path: "/images/output", displayName: "output" }));
  render(
    <ImageToolsPage
      locale="zh-CN"
      tool="remove-background"
      jobs={[]}
      onCreate={vi.fn()}
      onChooseInput={chooseInput}
      onChooseOutput={chooseOutput}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "新建作业 / 选择文件" }));
  fireEvent.click(screen.getByRole("button", { name: "选择文件 / 文件夹" }));
  fireEvent.click(screen.getByRole("button", { name: "选择输出位置" }));
  expect(chooseInput).toHaveBeenCalledOnce();
  expect(chooseOutput).toHaveBeenCalledOnce();
});

it("isolates jobs to the current tool entry", () => {
  const resizeJob = { ...job, id: "resize-job", tool: "resize" as const };
  render(
    <ImageToolsPage
      locale="zh-CN"
      tool="upscale"
      jobs={[{ job, items }, { job: resizeJob, items: [] }]}
      onCreate={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
    />,
  );

  expect(screen.getByRole("heading", { level: 1, name: "放大图像" })).toBeInTheDocument();
  expect(screen.getAllByText("/images/output/job-1").length).toBeGreaterThan(0);
  expect(screen.queryByText("resize-job")).not.toBeInTheDocument();
});

it("renders a job workbench with progress and result cards", () => {
  render(
    <ImageToolsPage
      locale="zh-CN"
      jobs={[{ job, items }]}
      onCreate={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
    />,
  );

  expect(
    screen.getByRole("complementary", { name: "图像作业" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "放大图像" })).toBeInTheDocument();
  expect(
    document.querySelector(".image-tools-progress__label")?.textContent,
  ).toContain("1 / 2");
  expect(
    screen.getByRole("button", { name: /catalog\/hero\.png/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /catalog\/detail\.png/ }),
  ).toBeInTheDocument();
  expect(document.querySelector(".image-tools-result-card.is-completed .ui-icon")).toBeNull();
  expect(document.querySelector(".image-tools-result-card.is-completed img")).toBeInTheDocument();
  expect(
    document.querySelector(".image-tools-result-card.is-completed .image-tools-result-card__preview"),
  ).toHaveClass("is-transparency-grid");
  expect(
    document.querySelector(".image-tools-result-card.is-running .image-tools-result-card__preview"),
  ).not.toHaveClass("is-transparency-grid");
  expect(document.querySelector(".image-tools-job-row")).toHaveClass("studio-home-project-row");
  const jobRow = document.querySelector(".image-tools-job-row");
  expect(jobRow?.querySelector("strong")).toHaveTextContent("hero.pn...");
  expect(jobRow?.querySelector(".image-tools-job-row__output")).toHaveTextContent(
    "/images/output/job-1",
  );
  const overview = document.querySelector(".image-tools-job-detail__overview");
  expect(overview).toBeInTheDocument();
  expect(overview?.querySelector("h2")).toBeNull();
  expect(overview?.querySelector(".badge")).toBeNull();
  expect(overview?.querySelector(".image-tools-progress")).toBeInTheDocument();
  expect(overview?.querySelector(".image-tools-job-summary")).toBeInTheDocument();
  expect(screen.queryByText("参数")).not.toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "处理结果" })).toHaveLength(1);
  expect(screen.queryByText("逐图结果")).not.toBeInTheDocument();

  const outputButton = screen.getByRole("button", { name: "打开结果目录" });
  expect(outputButton.querySelector(".ui-icon")).toHaveStyle({
    maskImage: "url(./icons/folder-open.svg)",
  });
});

it("renders persisted result metadata and accessible progress semantics", () => {
  render(
    <ImageToolsPage
      locale="zh-CN"
      jobs={[{ job, items: [{ ...items[0], resultWidth: 6, resultHeight: 4, resultFormat: "webp", resultBytes: 1234 }, items[1]] }]}
      onCreate={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
    />,
  );

  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "2");
  expect(screen.getByText("6 × 4 · 1.2 KB")).toBeInTheDocument();
  expect(screen.getByText("WEBP")).toBeInTheDocument();
});

it("changes result-card density with an accessible two-size control", () => {
  render(
    <ImageToolsPage
      locale="zh-CN"
      jobs={[{ job, items }]}
      onCreate={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
    />,
  );

  const grid = document.querySelector(".image-tools-result-grid");
  const compactButton = screen.getByRole("button", { name: "紧凑卡片" });
  const largeButton = screen.getByRole("button", { name: "大图卡片" });

  expect(grid).toHaveClass("is-compact");
  expect(compactButton).toHaveAttribute("aria-pressed", "true");
  expect(largeButton).toHaveAttribute("aria-pressed", "false");

  fireEvent.click(largeButton);
  expect(grid).toHaveClass("is-large");
  expect(compactButton).toHaveAttribute("aria-pressed", "false");
  expect(largeButton).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(compactButton);
  expect(grid).toHaveClass("is-compact");
});

it("keeps only the completed status tag in the job overview", () => {
  render(
    <ImageToolsPage
      locale="zh-CN"
      jobs={[{ job: { ...job, state: "completed" }, items }]}
      onCreate={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
    />,
  );

  const overview = document.querySelector(".image-tools-job-detail__overview");
  expect(overview?.querySelectorAll(".badge")).toHaveLength(1);
  expect(overview?.querySelector(".badge")).toHaveTextContent("已完成");
});

it("loads completed result previews through the result reader", async () => {
  const readResult = vi.fn(async () => "data:image/png;base64,ZmFrZQ==");
  render(
    <ImageToolsPage
      locale="zh-CN"
      jobs={[{ job, items }]}
      onCreate={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
      {...({ onReadResult: readResult } as { onReadResult: typeof readResult })}
    />,
  );

  await waitFor(() => {
    expect(readResult).toHaveBeenCalledWith(
      "/images/output/job-1/catalog/hero.png",
      "job-1",
    );
    expect(
      document.querySelector(".image-tools-result-card.is-completed img"),
    ).toHaveAttribute("src", "data:image/png;base64,ZmFrZQ==");
  });
});

it("shows a readable processing error for a failed item", () => {
  const failedJob = { ...job, state: "failed" as const };
  const failedItems = [{ ...items[0], state: "failed" as const, errorCode: "Provider request failed (524)." }];
  render(
    <ImageToolsPage
      locale="zh-CN"
      jobs={[{ job: failedJob, items: failedItems }]}
      onCreate={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
    />,
  );

  expect(screen.getAllByText("处理失败，请稍后重试。").length).toBeGreaterThan(0);
  expect(screen.queryByText("Provider request failed (524).")).not.toBeInTheDocument();
  expect(screen.queryByText("错误码")).not.toBeInTheDocument();
});

it("keeps the detail pane aligned with the selected job filter", () => {
  const archivedJob = {
    ...job,
    id: "job-archived",
    state: "cancelled" as const,
    outputRoot: "/images/output/archived",
  };
  render(
    <ImageToolsPage
      locale="zh-CN"
      jobs={[
        { job, items },
        { job: archivedJob, items: [] },
      ]}
      onCreate={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "已归档" }));
  expect(screen.getByRole("heading", { level: 1, name: "放大图像" })).toBeInTheDocument();
  expect(screen.getAllByText("/images/output/archived").length).toBeGreaterThan(0);
  expect(screen.queryByText("job-1")).not.toBeInTheDocument();
});

it("opens the selected result item in a detail drawer with file actions", async () => {
  render(
    <ImageToolsPage
      locale="zh-CN"
      jobs={[{ job, items }]}
      onCreate={vi.fn()}
      onPause={vi.fn()}
      onResume={vi.fn()}
      onCancel={vi.fn()}
      onRetryItem={vi.fn()}
      onOpenResult={vi.fn()}
      onRevealResult={vi.fn()}
      onImportResult={vi.fn()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /catalog\/hero\.png/ }));
  expect(
    screen.getByRole("dialog", { name: /catalog\/hero\.png/ }),
  ).toBeInTheDocument();
  expect(
    screen.getAllByText("/images/source/catalog/hero.png").length,
  ).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "打开结果" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "显示位置" })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "导入素材库" }),
  ).toBeInTheDocument();
});
