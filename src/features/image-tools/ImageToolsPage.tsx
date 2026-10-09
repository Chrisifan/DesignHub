import { useEffect, useMemo, useState } from "react";

import type { Locale } from "../../app/i18n";
import { t } from "../../app/studio/ui";
import { getDesktopApi } from "../../platform/runtime";
import {
  type BatchImageTool,
  type ImageToolJob,
  type ImageToolItem,
  type ToolParams,
  isBatchImageTool,
} from "./jobs";
import {
  filterImageToolJobs,
  pathConflicts,
  type ImageToolJobFilter,
} from "./view-model";
import { useImageToolPreviews } from "./use-image-tool-previews";
import { createImageToolCommands } from "./image-tool-commands";
import { ImageToolsShell } from "./ImageToolsShell";
import { composerErrorMessage } from "./image-tools-copy";
import type { ImageToolScanResult } from "./ImageToolConfigurator";

export type ImageToolsPageProps = {
  locale: Locale;
  tool?: BatchImageTool;
  jobs: ReadonlyArray<{ job: ImageToolJob; items: ImageToolItem[] }>;
  onCreate: (input: {
    tool: BatchImageTool;
    params: ToolParams;
    sourcePath: string;
    outputRoot: string;
    resultFolderName?: string;
    connectionId?: string;
  }) => void | Promise<void>;
  onChooseInput?: () => Promise<{ path: string; displayName?: string } | null>;
  onChooseOutput?: () => Promise<{ path: string; displayName?: string } | null>;
  onOpenConnections?: () => void;
  onScan?: (input: {
    tool: BatchImageTool;
    params: ToolParams;
    sourcePath: string;
    outputRoot: string;
    resultFolderName?: string;
  }) => Promise<{
    accepted: Array<{ relativePath: string }>;
    rejected: Array<{ path: string; code: string; detail?: string }>;
  } | null>;
  onPause: (jobId: string) => void | Promise<void>;
  onResume: (jobId: string) => void | Promise<void>;
  onCancel: (jobId: string) => void | Promise<void>;
  onRetryItem: (jobId: string, itemId: string) => void | Promise<void>;
  onCancelItem?: (jobId: string, itemId: string) => void | Promise<void>;
  onReadResult?: (path: string, jobId: string) => Promise<string | null>;
  onOpenResult?: (path: string, jobId: string) => void | Promise<void>;
  onRevealResult?: (path: string, jobId: string) => void | Promise<void>;
  onOpenOutput?: (path: string, jobId: string) => void | Promise<void>;
  onImportResult?: (path: string, jobId: string) => void | Promise<void>;
};

export const ImageToolsPage = ({
  locale,
  tool: requestedTool,
  jobs,
  onCreate,
  onChooseInput,
  onChooseOutput,
  onOpenConnections,
  onScan,
  onPause,
  onResume,
  onCancel,
  onRetryItem,
  onCancelItem,
  onOpenResult,
  onRevealResult,
  onOpenOutput,
  onImportResult,
  onReadResult,
}: ImageToolsPageProps) => {
  const initialTool: BatchImageTool =
    requestedTool ??
    (isBatchImageTool(jobs[0]?.job.tool) ? jobs[0].job.tool : "remove-background");
  const [tool, setTool] = useState<BatchImageTool>(initialTool);
  const [composerOpen, setComposerOpen] = useState(false);
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(1200);
  const [scale, setScale] = useState(2);
  const [preserveDetails, setPreserveDetails] = useState<"balanced" | "details" | "texture">("balanced");
  const [fit, setFit] = useState<"contain" | "cover" | "stretch">("contain");
  const [format, setFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [background, setBackground] = useState("#ffffff");
  const [sourcePath, setSourcePath] = useState("");
  const [outputRoot, setOutputRoot] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [outputLabel, setOutputLabel] = useState("");
  const [resultFolderName, setResultFolderName] = useState("batch-results");
  const [connectionId, setConnectionId] = useState("");
  const [connections, setConnections] = useState<string[]>([]);
  const [scan, setScan] = useState<ImageToolScanResult>(null);
  const [composerError, setComposerError] = useState("");
  const [filter, setFilter] = useState<ImageToolJobFilter>("all");
  const [jobQuery, setJobQuery] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(jobs[0]?.job.id ?? null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const resultPreviewUrls = useImageToolPreviews(jobs, onReadResult);
  const commands = useMemo(() => createImageToolCommands({
    chooseInput: onChooseInput,
    chooseOutput: onChooseOutput,
    scan: onScan,
    create: onCreate,
    pause: onPause,
    resume: onResume,
    cancel: onCancel,
    retryItem: onRetryItem,
    cancelItem: onCancelItem,
    openResult: onOpenResult,
    revealResult: onRevealResult,
    openOutput: onOpenOutput,
    importResult: onImportResult,
  }), [onCancel, onChooseInput, onChooseOutput, onCreate, onImportResult, onOpenOutput, onOpenResult, onPause, onRetryItem, onResume, onRevealResult, onScan]);
  useEffect(() => {
    let cancelled = false;
    void getDesktopApi().loadProviderConfigs?.().then((configs) => {
      if (cancelled || !configs) return;
      const available = Object.entries(configs)
        .filter(([, config]) => Boolean(config?.image.models["image-editing"]))
        .map(([id]) => id);
      setConnections(available);
      setConnectionId((current) => current && available.includes(current) ? current : available[0] ?? "");
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  const toolJobs = useMemo(() => jobs.filter(({ job }) => job.tool === tool), [jobs, tool]);
  useEffect(() => {
    if (selectedJobId && toolJobs.some(({ job }) => job.id === selectedJobId)) return;
    setSelectedJobId(toolJobs[0]?.job.id ?? null);
    setSelectedItemId(null);
  }, [selectedJobId, toolJobs]);
  const changeTool = (nextTool: BatchImageTool): void => {
    setTool(nextTool);
    setSelectedJobId(null);
    setSelectedItemId(null);
    setComposerOpen(false);
  };
  useEffect(() => { setSelectedItemId(null); }, [selectedJobId]);
  useEffect(() => { setScan(null); }, [background, fit, format, height, outputRoot, preserveDetails, resultFolderName, scale, sourcePath, tool, width]);
  const params = useMemo<ToolParams>(() => (
    tool === "resize" ? { width, height, fit, format, background } :
      tool === "format-convert" ? { format, background } :
        tool === "upscale" ? { scale, preserveDetails } :
          Object.create(null) as ToolParams
  ), [background, fit, format, height, preserveDetails, scale, tool, width]);
  const selectedJob = toolJobs.find(({ job }) => job.id === selectedJobId) ?? null;
  const selectedItem = selectedJob?.items.find((item) => item.id === selectedItemId) ?? null;
  const canCreate = Boolean(sourcePath && outputRoot && scan?.accepted.length && ((tool !== "remove-background" && tool !== "upscale") || connectionId.trim()));
  const chooseInput = async (): Promise<void> => {
    setComposerError("");
    try {
      const selected = await commands.chooseInput();
      if (selected) { setSourcePath(selected.path); setSourceLabel(selected.displayName ?? selected.path); }
    } catch {
      setComposerError(t(locale, "无法打开文件选择器，请重试。", "Could not open the file picker. Try again."));
    }
  };
  const chooseOutput = async (): Promise<void> => {
    setComposerError("");
    try {
      const selected = await commands.chooseOutput();
      if (selected) {
        if (pathConflicts(sourcePath, selected.path)) {
          setOutputRoot(""); setOutputLabel("");
          setComposerError(composerErrorMessage(locale, new Error("IMAGE_TOOL_JOB_ROOTS_INVALID")));
          return;
        }
        setOutputRoot(selected.path); setOutputLabel(selected.displayName ?? selected.path);
      }
    } catch {
      setComposerError(t(locale, "无法选择输出位置，请重试。", "Could not choose an output location. Try again."));
    }
  };
  const runScan = async (): Promise<void> => {
    if (!sourcePath || !outputRoot) return;
    setComposerError("");
    try {
      const result = await commands.scan({ tool, params, sourcePath, outputRoot, resultFolderName });
      setScan(result);
      if (!result) setComposerError(t(locale, "扫描失败，请确认来源和输出位置仍然可访问。", "Scan failed. Check that the source and output locations are available."));
    } catch (error) { setScan(null); setComposerError(composerErrorMessage(locale, error)); }
  };
  const createJob = async (): Promise<void> => {
    setComposerError("");
    try {
      await commands.create({ tool, params, sourcePath, outputRoot, resultFolderName, ...(connectionId.trim() ? { connectionId: connectionId.trim() } : {}) });
      setComposerOpen(false);
    } catch (error) { setComposerError(composerErrorMessage(locale, error)); }
  };
  const changeJobFilter = (nextFilter: ImageToolJobFilter): void => {
    setFilter(nextFilter);
    const visibleJobs = filterImageToolJobs(toolJobs, nextFilter);
    if (!visibleJobs.some(({ job }) => job.id === selectedJobId)) setSelectedJobId(visibleJobs[0]?.job.id ?? null);
  };
  const configurator = {
    locale,
    tool,
    open: composerOpen,
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
    error: composerError,
    onOpenConnections,
    canCreate,
    onClose: () => setComposerOpen(false),
    onChooseInput: () => { void chooseInput(); },
    onChooseOutput: () => { void chooseOutput(); },
    onScan: () => { void runScan(); },
    onCreate: () => { void createJob(); },
    setConnectionId,
    setWidth,
    setHeight,
    setScale,
    setPreserveDetails,
    setFit,
    setFormat,
    setBackground,
    setResultFolderName,
    onOpen: () => setComposerOpen(true),
  };
  return (
    <ImageToolsShell
      locale={locale}
      tool={tool}
      onToolChange={changeTool}
      jobs={toolJobs}
      selectedJob={selectedJob}
      selectedItem={selectedItem}
      selectedJobId={selectedJobId}
      filter={filter}
      jobQuery={jobQuery}
      resultPreviewUrls={resultPreviewUrls}
      allowFileFallback={!onReadResult}
      commands={commands}
      onSelectJob={(jobId) => setSelectedJobId(jobId)}
      onSelectItem={setSelectedItemId}
      onFilterChange={changeJobFilter}
      onQueryChange={setJobQuery}
      configurator={configurator}
    />
  );
};
