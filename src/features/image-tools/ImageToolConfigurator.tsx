import type { Locale } from "../../app/i18n";
import { Drawer } from "../../app/studio/Drawer";
import { Button, Field, Icon, Select, t } from "../../app/studio/ui";
import type { BatchImageTool } from "./jobs";
import { ImageToolScanPreview } from "./ImageToolScanPreview";
import { toolDescription, toolLabel } from "./image-tools-copy";

export type ImageToolScanResult = {
  accepted: Array<{ relativePath: string }>;
  rejected: Array<{ path: string; code: string; detail?: string }>;
} | null;
type ParamProps = {
  locale: Locale;
  tool: BatchImageTool;
  connectionId: string;
  connections: string[];
  width: number;
  height: number;
  scale: number;
  preserveDetails: "balanced" | "details" | "texture";
  fit: "contain" | "cover" | "stretch";
  format: "png" | "jpeg" | "webp";
  background: string;
  setConnectionId: (value: string) => void;
  setWidth: (value: number) => void;
  setHeight: (value: number) => void;
  setScale: (value: number) => void;
  setPreserveDetails: (value: "balanced" | "details" | "texture") => void;
  setFit: (value: "contain" | "cover" | "stretch") => void;
  setFormat: (value: "png" | "jpeg" | "webp") => void;
  setBackground: (value: string) => void;
};
const ParameterFields = ({
  locale,
  tool,
  connectionId,
  connections,
  width,
  height,
  scale,
  preserveDetails,
  fit,
  format,
  background,
  setConnectionId,
  setWidth,
  setHeight,
  setScale,
  setPreserveDetails,
  setFit,
  setFormat,
  setBackground,
}: ParamProps) => (
  <div className="image-tools-composer__params">
    {(tool === "remove-background" || tool === "upscale") && (
      <Field
        label={t(locale, "模型连接", "Model connection")}
        hint={t(
          locale,
          "对应“模型连接 → 图片生成与编辑 → 编辑模型”。",
          "Uses the Image editing model from Model connections.",
        )}
      >
        <Select
          ariaLabel={t(locale, "模型连接", "Model connection")}
          value={connectionId}
          onChange={setConnectionId}
          options={[
            {
              value: "",
              label: t(
                locale,
                "请选择已配置连接",
                "Select a configured connection",
              ),
            },
            ...connections.map((id) => ({ value: id, label: id })),
          ]}
        />
      </Field>
    )}
    {tool === "upscale" && (
      <>
        <Field label={t(locale, "倍率", "Scale")}>
          <input
            aria-label={t(locale, "倍率", "Scale")}
            type="number"
            min="1"
            step="0.5"
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
          />
        </Field>
        <Field label={t(locale, "细节模式", "Detail mode")}>
          <Select
            ariaLabel={t(locale, "细节模式", "Detail mode")}
            value={preserveDetails}
            onChange={(value) =>
              setPreserveDetails(value as typeof preserveDetails)
            }
            options={[
              { value: "balanced", label: t(locale, "平衡", "Balanced") },
              { value: "details", label: t(locale, "细节", "Details") },
              { value: "texture", label: t(locale, "纹理", "Texture") },
            ]}
          />
        </Field>
      </>
    )}
    {tool === "resize" && (
      <>
        <Field label={t(locale, "宽度", "Width")}>
          <input
            aria-label={t(locale, "宽度", "Width")}
            type="number"
            min="1"
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
          />
        </Field>
        <Field label={t(locale, "高度", "Height")}>
          <input
            aria-label={t(locale, "高度", "Height")}
            type="number"
            min="1"
            value={height}
            onChange={(event) => setHeight(Number(event.target.value))}
          />
        </Field>
        <Field label={t(locale, "适配", "Fit")}>
          <Select
            ariaLabel={t(locale, "适配", "Fit")}
            value={fit}
            onChange={(value) => setFit(value as typeof fit)}
            options={[
              { value: "contain", label: t(locale, "完整保留", "Contain") },
              { value: "cover", label: t(locale, "裁切填充", "Cover") },
              { value: "stretch", label: t(locale, "拉伸", "Stretch") },
            ]}
          />
        </Field>
      </>
    )}
    {(tool === "resize" || tool === "format-convert") && (
      <Field label={t(locale, "输出格式", "Output format")}>
        <Select
          ariaLabel={t(locale, "输出格式", "Output format")}
          value={format}
          onChange={(value) => setFormat(value as typeof format)}
          options={[
            { value: "png", label: "PNG" },
            { value: "jpeg", label: "JPEG" },
            { value: "webp", label: "WebP" },
          ]}
        />
      </Field>
    )}
    {(tool === "resize" || tool === "format-convert") && (
      <Field label={t(locale, "JPEG 背景", "JPEG background")}>
        <input
          aria-label={t(locale, "JPEG 背景", "JPEG background")}
          type="color"
          value={background}
          onChange={(event) => setBackground(event.target.value)}
        />
      </Field>
    )}
  </div>
);

export const ImageToolConfigurator = ({
  locale,
  tool,
  open,
  sourcePath,
  outputRoot,
  sourceLabel,
  outputLabel,
  resultFolderName,
  scan,
  connectionId,
  connections,
  width,
  height,
  scale,
  preserveDetails,
  fit,
  format,
  background,
  error,
  onOpenConnections,
  canCreate,
  onClose,
  onChooseInput,
  onChooseOutput,
  onScan,
  onCreate,
  setConnectionId,
  setWidth,
  setHeight,
  setScale,
  setPreserveDetails,
  setFit,
  setFormat,
  setBackground,
  setResultFolderName,
}: {
  locale: Locale;
  tool: BatchImageTool;
  open: boolean;
  sourcePath: string;
  outputRoot: string;
  sourceLabel: string;
  outputLabel: string;
  resultFolderName: string;
  scan: ImageToolScanResult;
  connectionId: string;
  connections: string[];
  width: number;
  height: number;
  scale: number;
  preserveDetails: "balanced" | "details" | "texture";
  fit: "contain" | "cover" | "stretch";
  format: "png" | "jpeg" | "webp";
  background: string;
  error: string;
  onOpenConnections?: () => void;
  canCreate: boolean;
  onClose: () => void;
  onChooseInput: () => void;
  onChooseOutput: () => void;
  onScan: () => void;
  onCreate: () => void;
  setConnectionId: (value: string) => void;
  setWidth: (value: number) => void;
  setHeight: (value: number) => void;
  setScale: (value: number) => void;
  setPreserveDetails: (value: "balanced" | "details" | "texture") => void;
  setFit: (value: "contain" | "cover" | "stretch") => void;
  setFormat: (value: "png" | "jpeg" | "webp") => void;
  setBackground: (value: string) => void;
  setResultFolderName: (value: string) => void;
}) => (
  <Drawer
    open={open}
    title={`${t(locale, "新建作业", "New job")} · ${toolLabel(locale, tool)}`}
    onClose={onClose}
    locale={locale}
    className="image-tools-composer-drawer"
    footer={
      <div className="image-tools-composer__footer">
        <Button variant="secondary" onClick={onClose}>
          {t(locale, "取消", "Cancel")}
        </Button>
        <Button
          icon="play"
          variant="primary"
          disabled={!canCreate}
          onClick={onCreate}
        >
          {t(locale, "创建作业", "Create job")}
        </Button>
      </div>
    }
  >
    <div className="image-tools-composer">
      <div className="image-tools-composer__step">
        <span>01</span>
        <div>
          <strong>{t(locale, "选择来源", "Choose source")}</strong>
          <small>
            {t(
              locale,
              "支持单张图片或整个文件夹。",
              "Use one image or a folder.",
            )}
          </small>
        </div>
      </div>
      <div className="image-tools-composer__source-actions">
        <div className="image-tools-source-picker">
          <div className="image-tools-source-picker__copy">
            <Icon name="file-image" size={20} />
            <div>
              <strong>{sourceLabel ? `${t(locale, "来源", "Source")}：${sourceLabel}` : t(locale, "还没有选择来源", "No source selected")}</strong>
              <small>{t(locale, "支持单张图片或整个文件夹", "Choose one image or an entire folder")}</small>
            </div>
          </div>
          <Button icon="folder-open" variant="secondary" onClick={onChooseInput}>
            {t(locale, "选择文件 / 文件夹", "Choose file / folder")}
          </Button>
        </div>
        <Button
          icon="folder-open"
          variant="secondary"
          onClick={onChooseOutput}
        >
          {outputLabel ? `${t(locale, "输出", "Output")}：${outputLabel}` : t(locale, "选择输出位置", "Choose output location")}
        </Button>
      </div>
      {error && <p className="image-tools-composer__error" role="alert">{error}</p>}
      <ImageToolScanPreview locale={locale} scan={scan} />
      <Field label={t(locale, "结果文件夹名", "Result folder name")}>
        <input
          aria-label={t(locale, "结果文件夹名", "Result folder name")}
          value={resultFolderName}
          onChange={(event) => setResultFolderName(event.target.value)}
        />
      </Field>
      <div className="image-tools-composer__step">
        <span>02</span>
        <div>
          <strong>{t(locale, "设置参数", "Set parameters")}</strong>
          <small>{toolDescription(locale, tool)}</small>
        </div>
      </div>
      <ParameterFields
        locale={locale}
        tool={tool}
        connectionId={connectionId}
        connections={connections}
        width={width}
        height={height}
        scale={scale}
        preserveDetails={preserveDetails}
        fit={fit}
        format={format}
        background={background}
        setConnectionId={setConnectionId}
        setWidth={setWidth}
        setHeight={setHeight}
        setScale={setScale}
        setPreserveDetails={setPreserveDetails}
        setFit={setFit}
        setFormat={setFormat}
        setBackground={setBackground}
      />
      {(tool === "remove-background" || tool === "upscale") && connections.length === 0 && (
        <div className="image-tools-composer__connection-warning" role="alert">
          <div>
            <strong>{t(locale, "还没有可用的图片编辑连接", "No image editing connection is available")}</strong>
            <small>{t(locale, "请在“模型连接 → 图片生成与编辑”中填写“编辑模型”，例如 gpt-image-2。", "In Model connections → Image generation and editing, fill in the Image editing model, such as gpt-image-2.")}</small>
          </div>
          {onOpenConnections && (
            <Button icon="settings" variant="secondary" onClick={onOpenConnections}>
              {t(locale, "去配置连接", "Configure connection")}
            </Button>
          )}
        </div>
      )}
      <div className="image-tools-composer__step">
        <span>03</span>
        <div>
          <strong>{t(locale, "确认创建", "Confirm")}</strong>
          <small>
            {scan?.accepted.length
              ? t(
                  locale,
                  `将处理 ${scan.accepted.length} 张图片`,
                  `Process ${scan.accepted.length} images`,
                )
              : t(
                  locale,
                  "先扫描来源以确认文件数量。",
                  "Scan the source to confirm file count.",
                )}
          </small>
        </div>
      </div>
      <Button
        icon="search"
        variant="secondary"
        disabled={!sourcePath || !outputRoot}
        onClick={onScan}
      >
        {t(locale, "扫描来源", "Scan source")}
      </Button>
    </div>
  </Drawer>
);
