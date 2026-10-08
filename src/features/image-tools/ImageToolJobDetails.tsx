import { useState } from "react";
import type { Locale } from "../../app/i18n";
import { Badge, Button, EmptyState, Icon, t } from "../../app/studio/ui";
import type { ImageToolJob, ImageToolItem } from "./jobs";
import {
  getImageToolJobProgress,
  imageToolPreviewSource,
  isImageToolJobActive,
  joinImageToolPath,
} from "./view-model";
import {
  itemErrorMessage,
  itemStateLabel,
  stateLabel,
} from "./image-tools-copy";

type ResultFilter = "all" | ImageToolItem["state"];

export const ImageToolJobDetails = ({
  locale,
  job,
  items,
  onPause,
  onResume,
  onCancel,
  onOpenOutput,
  onSelectItem,
  resultPreviewUrls,
  allowFileFallback,
}: {
  locale: Locale;
  job: ImageToolJob;
  items: ImageToolItem[];
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onOpenOutput: () => void;
  onSelectItem: (itemId: string) => void;
  resultPreviewUrls: Readonly<Record<string, string>>;
  allowFileFallback: boolean;
}) => {
  const progress = getImageToolJobProgress(items);
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [cardSize, setCardSize] = useState<"compact" | "large">("compact");
  const failed = items.filter(
    (item) => item.state === "failed" || item.state === "unknown",
  ).length;
  const resultCounts = {
    all: items.length,
    completed: items.filter((item) => item.state === "completed").length,
    running: items.filter((item) => item.state === "running").length,
    queued: items.filter((item) => item.state === "queued").length,
    failed: items.filter((item) => item.state === "failed").length,
    unknown: items.filter((item) => item.state === "unknown").length,
    cancelled: items.filter((item) => item.state === "cancelled").length,
  };
  const visibleItems =
    resultFilter === "all"
      ? items
      : items.filter((item) => item.state === resultFilter);
  return (
    <div className="image-tools-job-detail">
      <div className="image-tools-job-detail__overview">
        <header className="image-tools-job-detail__header">
          <div className="image-tools-job-detail__eyebrow">
            <p className="panel-label">{t(locale, "当前作业", "Current job")}</p>
            {job.state === "completed" && (
              <Badge tone="success">{stateLabel(locale, job.state)}</Badge>
            )}
          </div>
          <div className="image-tools-job-detail__actions">
            {job.state === "paused" ? (
              <Button icon="play" variant="secondary" onClick={onResume}>
                {t(locale, "继续", "Resume")}
              </Button>
            ) : (
              isImageToolJobActive(job.state) && (
                <Button icon="pause" variant="secondary" onClick={onPause}>
                  {t(locale, "暂停", "Pause")}
                </Button>
              )
            )}
            {isImageToolJobActive(job.state) && (
              <Button icon="x" variant="ghost" onClick={onCancel}>
                {t(locale, "取消", "Cancel")}
              </Button>
            )}
            <Button icon="folder-open" variant="secondary" onClick={onOpenOutput}>
              {t(locale, "打开结果目录", "Open output")}
            </Button>
          </div>
        </header>
        <div className="image-tools-progress">
          <div className="image-tools-progress__label">
            <strong>{t(locale, "总计", "Total")} <b>{progress.total}</b></strong>
            <span>
              <b>{progress.percent}%</b> {t(locale, "完成", "COMPLETE")}
              <span className="sr-only">{progress.completed} / {progress.total}</span>
              {failed
                ? ` · ${failed} ${t(locale, "项需关注", "need attention")}`
                : ""}
            </span>
          </div>
          <div className="image-tools-progress__legend" aria-label={t(locale, "处理状态统计", "Processing status summary")}>
            {([
              ["completed", "完成", "Completed", "success"],
              ["running", "处理中", "Processing", "primary"],
              ["queued", "排队", "Queued", "muted"],
              ["failed", "失败", "Failed", "error"],
              ["unknown", "未知", "Unknown", "warning"],
              ["cancelled", "已取消", "Cancelled", "cancelled"],
            ] as const).map(([state, zh, en, tone]) => (
              <span key={state} className={`is-${tone}`}>
                <i /> {t(locale, zh, en)} <b>{resultCounts[state]}</b>
              </span>
            ))}
          </div>
          <div className="image-tools-progress__track">
            {(["completed", "running", "queued", "failed", "unknown", "cancelled"] as const).map((state) => (
              <span
                key={state}
                className={`is-${state}`}
                style={{ width: `${progress.total ? (resultCounts[state] / progress.total) * 100 : 0}%` }}
              />
            ))}
          </div>
        </div>
        <div className="image-tools-job-summary">
          <div>
            <span>{t(locale, "来源", "Source")}</span>
            <strong title={job.sourceRoot}>{job.sourceRoot}</strong>
          </div>
          <div>
            <span>{t(locale, "输出", "Output")}</span>
            <strong title={job.outputRoot}>{job.outputRoot}</strong>
          </div>
        </div>
      </div>
      <div className="image-tools-results-heading">
        <h3>{t(locale, "处理结果", "Results")}</h3>
        <div className="image-tools-results-heading__view-toggle">
          <span>{t(locale, "卡片缩放", "Card size")}</span>
          <button
            type="button"
            aria-label={t(locale, "紧凑卡片", "Compact cards")}
            aria-pressed={cardSize === "compact"}
            className={cardSize === "compact" ? "is-active" : ""}
            onClick={() => setCardSize("compact")}
          >
            <Icon name="layout-grid" size={15} />
          </button>
          <button
            type="button"
            aria-label={t(locale, "大图卡片", "Large preview cards")}
            aria-pressed={cardSize === "large"}
            className={cardSize === "large" ? "is-active" : ""}
            onClick={() => setCardSize("large")}
          >
            <Icon name="maximize-2" size={15} />
          </button>
        </div>
      </div>
      <div className="image-tools-result-filters" role="tablist" aria-label={t(locale, "结果筛选", "Result filters")}>
        {([
          ["all", "全部", "All"],
          ["completed", "完成", "Completed"],
          ["running", "处理中", "Processing"],
          ["queued", "排队", "Queued"],
          ["failed", "失败", "Failed"],
          ["unknown", "未知", "Unknown"],
        ] as const).map(([value, zh, en]) => (
          <button key={value} type="button" role="tab" aria-selected={resultFilter === value} className={resultFilter === value ? "is-active" : ""} onClick={() => setResultFilter(value)}>
            {t(locale, zh, en)} <small>{resultCounts[value]}</small>
          </button>
        ))}
      </div>
      {visibleItems.length === 0 ? (
        <EmptyState
          icon="file-image"
          title={t(locale, "暂无处理项", "No items")}
          description={t(
            locale,
            "这个作业还没有可显示的文件。",
            "This job has no files to display.",
          )}
        />
      ) : (
        <div className={`image-tools-result-grid is-${cardSize}`}>
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`image-tools-result-card is-${item.state} ${item.state === "completed" ? "is-complete" : ""}`}
              aria-label={item.relativePath}
              onClick={() => onSelectItem(item.id)}
            >
              <span
                className={`image-tools-result-card__preview ${item.state === "completed" ? "is-transparency-grid" : ""}`}
              >
                <span className="image-tools-result-card__status">{itemStateLabel(locale, item.state)}</span>
                {(imageToolPreviewSource(job.id, item, resultPreviewUrls, allowFileFallback) || item.state === "running") && (
                  <img
                    className="image-tools-result-card__image"
                    src={imageToolPreviewSource(job.id, item, resultPreviewUrls, allowFileFallback) ?? joinImageToolPath(job.sourceRoot, item.relativePath)}
                    alt=""
                    onError={(event) => { event.currentTarget.hidden = true; }}
                  />
                )}
                {!item.resultPath && <Icon name="file-image" size={30} />}
                {item.state === "running" && <strong>{t(locale, "抠图推理", "Inference")} {Math.max(1, Math.min(99, Math.round((item.attempt / 3) * 100)))}%</strong>}
                {item.state === "queued" && <strong>{t(locale, "等待处理队列", "Waiting in queue")}</strong>}
                {item.state === "failed" && <strong>{item.errorCode ? itemErrorMessage(locale, item.errorCode) : t(locale, "处理失败", "Processing failed")}</strong>}
                {item.state === "unknown" && <strong>{t(locale, "远端响应断开", "Remote response lost")}</strong>}
                {item.state === "cancelled" && <strong>{t(locale, "用户手动取消", "Cancelled by user")}</strong>}
                {item.state === "completed" && <small>{t(locale, "已生成结果", "Result ready")}</small>}
              </span>
              <span className="image-tools-result-card__body">
                <strong title={item.relativePath}>{item.relativePath}</strong>
                <span>
                  <small>{item.state === "completed" ? "2048 × 2048" : item.state === "running" ? "处理中" : item.state === "queued" ? "等待执行" : item.errorCode ? itemErrorMessage(locale, item.errorCode) : t(locale, `尝试 ${item.attempt}`, `Attempt ${item.attempt}`)}</small>
                  <em>{item.state === "completed" ? "PNG" : item.state === "running" ? "INFER" : item.state === "queued" ? "WAIT" : item.state === "unknown" ? "UNK" : item.state === "cancelled" ? "VOID" : "FAIL"}</em>
                </span>
              </span>
              {item.state === "failed" && <span className="image-tools-result-card__retry">{t(locale, "重试", "Retry")}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
