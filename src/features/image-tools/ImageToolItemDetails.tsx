import type { Locale } from "../../app/i18n";
import { Drawer } from "../../app/studio/Drawer";
import { Badge, Button, Icon, t } from "../../app/studio/ui";
import type { BatchImageTool, ImageToolJob, ImageToolItem } from "./jobs";
import { joinImageToolPath } from "./view-model";
import { canRetryImageToolItem } from "./jobs";
import {
  itemErrorMessage,
  itemStateLabel,
  itemTone,
  toolLabel,
} from "./image-tools-copy";

export const ImageToolItemDetails = ({
  locale,
  job,
  item,
  onClose,
  onRetry,
  onCancelItem,
  resultPreview,
  onOpenResult,
  onRevealResult,
  onImportResult,
}: {
  locale: Locale;
  job: ImageToolJob;
  item: ImageToolItem | null;
  onClose: () => void;
  onRetry: () => void;
  onCancelItem?: () => void;
  onOpenResult?: () => void;
  onRevealResult?: () => void;
  onImportResult?: () => void;
  resultPreview?: string;
}) => {
  const sourcePath = item ? joinImageToolPath(job.sourceRoot, item.relativePath) : "";
  return (
    <Drawer
      open={Boolean(item)}
      title={item?.relativePath ?? t(locale, "处理项详情", "Item details")}
      onClose={onClose}
      locale={locale}
      className="image-tools-item-drawer"
      footer={
        item ? (
          <div className="image-tools-item-drawer__footer">
            {item.resultPath && (
              <>
                <Button
                  icon="external-link"
                  variant="secondary"
                  onClick={onOpenResult}
                >
                  {t(locale, "打开结果", "Open result")}
                </Button>
                <Button
                  icon="locate-fixed"
                  variant="secondary"
                  onClick={onRevealResult}
                >
                  {t(locale, "显示位置", "Reveal")}
                </Button>
                <Button
                  icon="download"
                  variant="primary"
                  onClick={onImportResult}
                >
                  {t(locale, "导入素材库", "Import asset")}
                </Button>
              </>
            )}
            {canRetryImageToolItem(item) && (
              <Button icon="rotate-ccw" variant="ghost" onClick={onRetry}>
                {t(locale, "重试", "Retry")}
              </Button>
            )}
            {item.state === "running" && onCancelItem && (
              <Button icon="x" variant="ghost" onClick={onCancelItem}>
                {t(locale, "取消此项", "Cancel item")}
              </Button>
            )}
          </div>
        ) : null
      }
    >
      <div className="image-tools-item-detail">
        {item && (
          <>
            <div
              className="image-tools-comparison"
              aria-label={t(
                locale,
                "原图与结果对比",
                "Before and after comparison",
              )}
            >
              <div>
                <span>{t(locale, "原图", "Original")}</span>
                <div className="image-tools-comparison__preview">
                  <Icon name="file-image" size={30} />
                  <small>{sourcePath}</small>
                </div>
              </div>
              <div>
                <span>{t(locale, "结果", "Result")}</span>
                <div
                  className={`image-tools-comparison__preview ${item.resultPath ? "is-ready" : ""}`}
                >
                  {resultPreview ? (
                    <img
                      className="image-tools-comparison__image"
                      src={resultPreview}
                      alt={t(locale, "生成结果", "Generated result")}
                    />
                  ) : (
                    <Icon name="clock" size={30} />
                  )}
                  <small>
                    {item.resultPath ?? itemStateLabel(locale, item.state)}
                  </small>
                </div>
              </div>
            </div>
            <div className="image-tools-item-detail__status">
              <Badge tone={itemTone(item.state)}>
                {itemStateLabel(locale, item.state)}
              </Badge>
              <span>
                {t(
                  locale,
                  `第 ${item.attempt} 次尝试`,
                  `Attempt ${item.attempt}`,
                )}
              </span>
            </div>
            <dl className="image-tools-item-detail__meta">
              <div>
                <dt>{t(locale, "来源路径", "Source path")}</dt>
                <dd>{sourcePath}</dd>
              </div>
              <div>
                <dt>{t(locale, "结果路径", "Result path")}</dt>
                <dd>
                  {item.resultPath ?? t(locale, "尚未生成", "Not generated")}
                </dd>
              </div>
              <div>
                <dt>{t(locale, "工具", "Tool")}</dt>
                <dd>{toolLabel(locale, job.tool as BatchImageTool)}</dd>
              </div>
              <div>
                <dt>{t(locale, "参数", "Parameters")}</dt>
                <dd><code>{JSON.stringify(job.params)}</code></dd>
              </div>
              {job.executor?.kind === "provider" && (
                <>
                  <div>
                    <dt>{t(locale, "模型连接", "Provider connection")}</dt>
                    <dd>{job.executor.connectionId}</dd>
                  </div>
                  <div>
                    <dt>{t(locale, "模型", "Model")}</dt>
                    <dd>{job.executor.modelId || t(locale, "未指定", "Not specified")}</dd>
                  </div>
                  <div>
                    <dt>{t(locale, "远端请求 ID", "Remote request ID")}</dt>
                    <dd>{item.remoteRequestId ?? t(locale, "尚未返回", "Not returned")}</dd>
                  </div>
                </>
              )}
              {item.modelTaskId && (
                <div>
                  <dt>{t(locale, "模型任务", "Model task")}</dt>
                  <dd>{item.modelTaskId}</dd>
                </div>
              )}
              <div>
                <dt>{t(locale, "作业目录", "Job folder")}</dt>
                <dd>{job.outputRoot}</dd>
              </div>
            </dl>
            {item.errorCode && (item.state === "failed" || item.state === "unknown") && (
              <p className="image-tools-item-detail__error">{itemErrorMessage(locale, item.errorCode)}</p>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
};
