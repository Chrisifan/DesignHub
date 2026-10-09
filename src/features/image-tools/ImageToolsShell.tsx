import type { ComponentProps } from "react";
import type { Locale } from "../../app/i18n";
import { Button, EmptyState, Select, t } from "../../app/studio/ui";
import type { BatchImageTool, ImageToolJob, ImageToolItem } from "./jobs";
import { imageToolPreviewSource } from "./view-model";
import { ImageToolJobList } from "./ImageToolJobList";
import { ImageToolJobDetails } from "./ImageToolJobDetails";
import { ImageToolItemDetails } from "./ImageToolItemDetails";
import { ImageToolConfigurator } from "./ImageToolConfigurator";
import { labels, toolDescription, toolLabel } from "./image-tools-copy";
import type { ImageToolCommands } from "./image-tool-commands";

export type ImageToolsShellProps = {
  locale: Locale;
  tool: BatchImageTool;
  onToolChange: (tool: BatchImageTool) => void;
  jobs: ReadonlyArray<{ job: ImageToolJob; items: ImageToolItem[] }>;
  selectedJob: { job: ImageToolJob; items: ImageToolItem[] } | null;
  selectedItem: ImageToolItem | null;
  selectedJobId: string | null;
  filter: "all" | "active" | "recent" | "archived";
  jobQuery: string;
  resultPreviewUrls: Readonly<Record<string, string>>;
  allowFileFallback: boolean;
  commands: ImageToolCommands;
  onSelectJob: (jobId: string) => void;
  onSelectItem: (itemId: string | null) => void;
  onFilterChange: (filter: ImageToolsShellProps["filter"]) => void;
  onQueryChange: (query: string) => void;
  configurator: ComponentProps<typeof ImageToolConfigurator> & { onOpen: () => void };
};

export const ImageToolsShell = ({
  locale,
  tool,
  onToolChange,
  jobs,
  selectedJob,
  selectedItem,
  selectedJobId,
  filter,
  jobQuery,
  resultPreviewUrls,
  allowFileFallback,
  commands,
  onSelectJob,
  onSelectItem,
  onFilterChange,
  onQueryChange,
  configurator,
}: ImageToolsShellProps) => (
  <section
    aria-label={t(locale, "图像工具", "Image tools")}
    className="page-content library-page image-tools-page"
  >
    <header className="page-heading image-tools-page__header">
      <div className="page-heading__content">
        <p className="section-kicker">{t(locale, "批量处理", "Batch processing")}</p>
        <h1 aria-label={toolLabel(locale, tool)}>
          {toolLabel(locale, tool)}
          <span className="image-tools-page__title-en">({labels[tool][1]})</span>
        </h1>
        <p>{toolDescription(locale, tool)}</p>
      </div>
      <div className="image-tools-page__actions">
        <Select
          ariaLabel={t(locale, "批量工具", "Batch tool")}
          value={tool}
          onChange={(value) => onToolChange(value as BatchImageTool)}
          options={[
            ["remove-background", "去除背景", "Remove background"],
            ["upscale", "放大图像", "Upscale image"],
            ["resize", "尺寸转换", "Resize"],
            ["format-convert", "格式转换", "Format conversion"],
          ].map(([value, zh, en]) => ({ value, label: t(locale, zh, en) }))}
        />
        <Button icon="plus" variant="primary" onClick={configurator.onOpen}>
          {t(locale, "新建作业 / 选择文件", "New job / Choose files")}
        </Button>
      </div>
    </header>
    <div className="image-tools-workbench">
      <ImageToolJobList
        locale={locale}
        jobs={jobs}
        selectedJobId={selectedJobId}
        filter={filter}
        query={jobQuery}
        onFilterChange={onFilterChange}
        onQueryChange={onQueryChange}
        onSelect={onSelectJob}
      />
      <main className="image-tools-workbench__main">
        {selectedJob ? (
          <ImageToolJobDetails
            locale={locale}
            job={selectedJob.job}
            items={selectedJob.items}
            resultPreviewUrls={resultPreviewUrls}
            allowFileFallback={allowFileFallback}
            onPause={() => { void commands.pause(selectedJob.job.id); }}
            onResume={() => { void commands.resume(selectedJob.job.id); }}
            onCancel={() => { void commands.cancel(selectedJob.job.id); }}
            onOpenOutput={() => { void commands.openOutput(selectedJob.job.outputRoot, selectedJob.job.id); }}
            onSelectItem={onSelectItem}
          />
        ) : (
          <div className="page-empty-state">
            <EmptyState
              icon="file-image"
              title={t(locale, "暂无图像作业", "No image jobs")}
              description={t(locale, "点击新建作业开始批量处理。", "Click New job to start batch processing.")}
            />
            <Button icon="folder-open" variant="primary" onClick={configurator.onOpen}>
              {t(locale, "选择文件开始", "Choose files to start")}
            </Button>
          </div>
        )}
      </main>
    </div>
    <ImageToolConfigurator {...configurator} />
    {selectedJob && (
      <ImageToolItemDetails
        locale={locale}
        job={selectedJob.job}
        item={selectedItem}
        resultPreview={selectedItem ? imageToolPreviewSource(selectedJob.job.id, selectedItem, resultPreviewUrls, allowFileFallback) : undefined}
        onClose={() => onSelectItem(null)}
        onRetry={() => {
          if (selectedItem) void commands.retryItem(selectedJob.job.id, selectedItem.id);
        }}
        onCancelItem={() => {
          if (selectedItem) void commands.cancelItem(selectedJob.job.id, selectedItem.id);
        }}
        onOpenResult={() => {
          if (selectedItem?.resultPath) void commands.openResult(selectedItem.resultPath, selectedJob.job.id);
        }}
        onRevealResult={() => {
          if (selectedItem?.resultPath) void commands.revealResult(selectedItem.resultPath, selectedJob.job.id);
        }}
        onImportResult={() => {
          if (selectedItem?.resultPath) void commands.importResult(selectedItem.resultPath, selectedJob.job.id);
        }}
      />
    )}
  </section>
);
