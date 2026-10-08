import type { Locale } from "../../app/i18n";
import { t } from "../../app/studio/ui";
import type { BatchImageTool, ImageToolItem, ImageToolJob } from "./jobs";

export const labels: Record<BatchImageTool, [string, string]> = {
  "remove-background": ["去除背景", "Remove background"],
  upscale: ["放大图像", "Upscale image"],
  resize: ["尺寸转换", "Resize"],
  "format-convert": ["格式转换", "Format conversion"],
};
export const descriptions: Record<BatchImageTool, [string, string]> = {
  "remove-background": [
    "输出透明背景图片",
    "Export images with transparent backgrounds",
  ],
  upscale: [
    "使用已配置的图像连接处理",
    "Process with a configured image connection",
  ],
  resize: ["在本机生成新尺寸文件", "Create new dimensions locally"],
  "format-convert": ["在本机转换文件格式", "Convert file formats locally"],
};
export const icons: Record<BatchImageTool, string> = {
  "remove-background": "wand-sparkles",
  upscale: "image",
  resize: "maximize-2",
  "format-convert": "file-image",
};
export const stateLabels: Record<ImageToolJob["state"], [string, string]> = {
  queued: ["排队中", "Queued"],
  running: ["处理中", "Processing"],
  paused: ["已暂停", "Paused"],
  completed: ["已完成", "Completed"],
  failed: ["部分失败", "Partial failure"],
  cancelled: ["已取消", "Cancelled"],
  unknown: ["结果待确认", "Result unknown"],
};
export const itemStateLabels: Record<ImageToolItem["state"], [string, string]> = {
  queued: ["排队中", "Queued"],
  running: ["处理中", "Processing"],
  completed: ["已完成", "Completed"],
  failed: ["失败", "Failed"],
  cancelled: ["已取消", "Cancelled"],
  unknown: ["待确认", "Unknown"],
};

export const toolLabel = (locale: Locale, tool: BatchImageTool): string => {
  const value = labels[tool];
  return value
    ? t(locale, value[0], value[1])
    : t(locale, "图像工具", "Image tool");
};
export const toolDescription = (locale: Locale, tool: BatchImageTool): string =>
  t(locale, descriptions[tool][0], descriptions[tool][1]);
export const stateLabel = (locale: Locale, state: ImageToolJob["state"]): string =>
  t(locale, stateLabels[state][0], stateLabels[state][1]);
export const itemStateLabel = (
  locale: Locale,
  state: ImageToolItem["state"],
): string => t(locale, itemStateLabels[state][0], itemStateLabels[state][1]);
export const itemTone = (
  state: ImageToolItem["state"],
): "success" | "warning" | "error" | "primary" | "" =>
  state === "completed"
    ? "success"
    : state === "failed" || state === "unknown"
      ? "error"
      : state === "cancelled"
        ? "warning"
        : state === "running"
          ? "primary"
          : "";
export const composerErrorMessage = (locale: Locale, error: unknown): string => {
  const code = error instanceof Error ? error.message : String(error);
  if (code.includes("IMAGE_TOOL_JOB_ROOTS_INVALID")) {
    return t(locale, "来源目录和输出目录不能相同，也不能互相包含。请选择来源目录外的另一个输出目录。", "The source and output folders cannot be the same or contain one another. Choose a separate output folder.");
  }
  if (code.includes("IMAGE_TOOL_SOURCE_NOT_FOUND")) {
    return t(locale, "找不到来源文件或文件夹，请重新选择。", "The selected source could not be found. Choose it again.");
  }
  if (code.includes("IMAGE_TOOL_NO_INPUTS")) {
    return t(locale, "来源中没有可处理的图片。", "No processable images were found in the source.");
  }
  if (code.includes("CONNECTION_REQUIRED")) {
    return t(locale, "请先选择图片编辑连接。", "Select an image editing connection first.");
  }
  return t(locale, "处理失败，请稍后重试。", "Processing failed. Try again later.");
};
export const itemErrorMessage = (locale: Locale, code: string): string => {
  const messages: Record<string, [string, string]> = {
    IMAGE_TOOL_ITEM_TIMEOUT: ["处理超时，请检查连接后重试。", "Processing timed out. Check the connection and retry."],
    PROVIDER_NOT_CONFIGURED: ["图片编辑连接未完成配置。", "The image editing connection is not configured."],
    PROVIDER_EXECUTOR_UNAVAILABLE: ["图片编辑连接不可用。", "The image editing connection is unavailable."],
    IMAGE_CAPABILITY_UNAVAILABLE: ["当前连接不支持图片编辑。", "The selected connection does not support image editing."],
    IMAGE_RESULT_EMPTY: ["连接没有返回图片结果。", "The connection returned no image result."],
    TRANSPARENCY_REQUIRED: ["连接没有返回透明背景图片。", "The connection did not return a transparent image."],
    CONNECTION_REQUIRED: ["请先配置图片编辑连接。", "Configure an image editing connection first."],
    RESULT_UNKNOWN_AFTER_RESTART: ["应用重启后无法确认远端结果，请重试。", "The remote result could not be confirmed after restart. Retry explicitly."],
    RESULT_UNKNOWN_AFTER_CANCEL: ["取消后无法确认远端结果，请重试。", "The remote result could not be confirmed after cancellation. Retry explicitly."],
  };
  const message = messages[code];
  return message
    ? t(locale, message[0], message[1])
    : t(locale, "处理失败，请稍后重试。", "Processing failed. Try again later.");
};
