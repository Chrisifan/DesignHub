import { access, constants, lstat, readdir } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { batchImageTools, type BatchImageTool } from './jobs';
import { validateRelativePath } from './jobs';
import type { ToolParams } from './target';

const controlCharacters = /[\u0000-\u001F\u007F]/u;
const supportedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.tif', '.tiff', '.avif']);
const outputExtensions = new Set(['png', 'jpeg', 'jpg', 'webp']);

export type ScanSource = 'file' | 'directory';
export type ScannedImageInput = { absolutePath: string; relativePath: string; bytes?: number };
export type ScanRejection = { path: string; code: 'SYMLINK_NOT_ALLOWED' | 'UNSUPPORTED_FORMAT' | 'NOT_READABLE' | 'PATH_INVALID' | 'OUTPUT_COLLISION' | 'NOT_A_FILE' | 'EMPTY_DIRECTORY'; detail?: string };
export type ImageScanResult = {
  sourceRoot: string;
  source: ScanSource;
  accepted: ScannedImageInput[];
  rejected: ScanRejection[];
  outputPaths: string[];
};

export type ScanImageSourcesInput = {
  sourcePath: string;
  outputRoot?: string;
  tool?: BatchImageTool;
  outputFormat?: 'png' | 'jpeg' | 'webp';
  params?: ToolParams;
};

const hasControl = (value: string): boolean => controlCharacters.test(value);
const extensionIsSupported = (path: string): boolean => supportedExtensions.has(extname(path).toLowerCase());
const inside = (child: string, parent: string): boolean => {
  const value = relative(parent, child);
  return value === '' || (value !== '..' && !value.startsWith(`..${sep}`) && !isAbsolute(value));
};
const formatFor = (input: ScanImageSourcesInput): string | undefined => {
  if (input.tool === 'format-convert' || input.tool === 'resize') {
    const requested = input.outputFormat ?? (typeof input.params?.format === 'string' ? input.params.format as 'png' | 'jpeg' | 'webp' : undefined);
    return requested && outputExtensions.has(requested) ? requested : undefined;
  }
  return undefined;
};
const outputRelativePath = (relativePath: string, format?: string): string => {
  if (!format) return relativePath;
  const extension = extname(relativePath);
  return `${relativePath.slice(0, relativePath.length - extension.length)}.${format === 'jpeg' ? 'jpg' : format}`;
};

const rejectPath = (path: string, code: ScanRejection['code'], detail?: string): ScanRejection => ({ path, code, ...(detail ? { detail } : {}) });

/**
 * Scans a native file/folder selection without following symlinks. It returns a
 * preview rather than creating a job, so rejected paths are visible to callers.
 */
export const scanImageSources = async (input: ScanImageSourcesInput): Promise<ImageScanResult> => {
  if (!input.sourcePath || !isAbsolute(input.sourcePath) || hasControl(input.sourcePath)) throw new Error('IMAGE_TOOL_SOURCE_PATH_INVALID');
  const sourcePath = resolve(input.sourcePath);
  const outputRoot = input.outputRoot ? resolve(input.outputRoot) : undefined;
  const rootStat = await lstat(sourcePath).catch(() => null);
  if (!rootStat) throw new Error('IMAGE_TOOL_SOURCE_NOT_FOUND');
  if (rootStat.isSymbolicLink()) throw new Error('SYMLINK_NOT_ALLOWED');
  if (!rootStat.isFile() && !rootStat.isDirectory()) throw new Error('IMAGE_TOOL_SOURCE_INVALID');
  const source: ScanSource = rootStat.isDirectory() ? 'directory' : 'file';
  const sourceRoot = source === 'file' ? dirname(sourcePath) : sourcePath;
  if (outputRoot && (inside(outputRoot, sourceRoot) || inside(sourceRoot, outputRoot))) throw new Error('IMAGE_TOOL_JOB_ROOTS_INVALID');
  const accepted: ScannedImageInput[] = [];
  const rejected: ScanRejection[] = [];

  const visit = async (absolutePath: string, relativePath: string): Promise<void> => {
    const stat = await lstat(absolutePath).catch(() => null);
    if (!stat) {
      rejected.push(rejectPath(relativePath, 'NOT_A_FILE'));
      return;
    }
    if (stat.isSymbolicLink()) {
      rejected.push(rejectPath(relativePath, 'SYMLINK_NOT_ALLOWED'));
      return;
    }
    if (stat.isDirectory()) {
      const entries = await readdir(absolutePath, { withFileTypes: true }).catch(() => null);
      if (!entries) {
        rejected.push(rejectPath(relativePath || basename(absolutePath), 'NOT_READABLE'));
        return;
      }
      if (entries.length === 0) rejected.push(rejectPath(relativePath || basename(absolutePath), 'EMPTY_DIRECTORY'));
      for (const entry of entries) {
        const childRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        if (!validateRelativePath(childRelative) || hasControl(childRelative)) {
          rejected.push(rejectPath(childRelative, 'PATH_INVALID'));
          continue;
        }
        await visit(join(absolutePath, entry.name), childRelative);
      }
      return;
    }
    if (!stat.isFile()) {
      rejected.push(rejectPath(relativePath, 'NOT_A_FILE'));
      return;
    }
    if (!extensionIsSupported(absolutePath)) {
      rejected.push(rejectPath(relativePath, 'UNSUPPORTED_FORMAT'));
      return;
    }
    try {
      await access(absolutePath, constants.R_OK);
    } catch {
      rejected.push(rejectPath(relativePath, 'NOT_READABLE'));
      return;
    }
    accepted.push({ absolutePath, relativePath, bytes: stat.size });
  };

  await visit(sourcePath, source === 'file' ? basename(sourcePath) : '');
  if (source === 'file' && accepted.length === 0 && rejected.length === 0) rejected.push(rejectPath(basename(sourcePath), 'NOT_A_FILE'));
  const format = formatFor(input);
  const outputPaths: string[] = [];
  const outputSeen = new Set<string>();
  const acceptedAfterCollision: ScannedImageInput[] = [];
  for (const item of accepted) {
    const outputRelative = outputRelativePath(item.relativePath, format);
    if (!validateRelativePath(outputRelative) || outputSeen.has(outputRelative)) {
      rejected.push(rejectPath(item.relativePath, 'OUTPUT_COLLISION'));
      continue;
    }
    outputSeen.add(outputRelative);
    if (outputRoot && await lstat(join(outputRoot, outputRelative)).then(() => true).catch(() => false)) {
      rejected.push(rejectPath(item.relativePath, 'OUTPUT_COLLISION', 'OUTPUT_EXISTS'));
      continue;
    }
    acceptedAfterCollision.push(item);
    outputPaths.push(outputRoot ? join(outputRoot, outputRelative) : outputRelative);
  }
  return { sourceRoot, source, accepted: acceptedAfterCollision, rejected, outputPaths };
};

/** Alias used by native IPC callers that call the preview an input scan. */
export const scanImageInputs = scanImageSources;
export const scanDirectory = scanImageSources;
export const scanImageToolSources = scanImageSources;
export const isSupportedImagePath = extensionIsSupported;
export const supportedImageExtensions = [...supportedExtensions] as const;
export const supportedBatchImageTools = batchImageTools;
