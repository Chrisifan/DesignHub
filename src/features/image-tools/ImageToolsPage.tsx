import { useEffect, useMemo, useState } from 'react';
import type { Locale } from '../../app/i18n';
import { Badge, Button, EmptyState, Field, Select, t } from '../../app/studio/ui';
import { getDesktopApi } from '../../platform/runtime';
import { batchImageTools, type BatchImageTool, type ImageToolJob, type ImageToolItem, type ToolParams } from './jobs';

export type ImageToolsPageProps = {
  locale: Locale;
  jobs: ReadonlyArray<{ job: ImageToolJob; items: ImageToolItem[] }>;
  onCreate: (input: { tool: BatchImageTool; params: ToolParams; sourcePath: string; outputRoot: string; connectionId?: string }) => void | Promise<void>;
  onChooseInput?: () => Promise<{ path: string; displayName?: string } | null>;
  onChooseOutput?: () => Promise<{ path: string; displayName?: string } | null>;
  onScan?: (input: { tool: BatchImageTool; params: ToolParams; sourcePath: string; outputRoot: string }) => Promise<{ accepted: Array<{ relativePath: string }>; rejected: Array<{ path: string; code: string; detail?: string }> } | null>;
  onPause: (jobId: string) => void | Promise<void>;
  onResume: (jobId: string) => void | Promise<void>;
  onCancel: (jobId: string) => void | Promise<void>;
  onRetryItem: (jobId: string, itemId: string) => void | Promise<void>;
  onOpenResult?: (path: string, jobId: string) => void | Promise<void>;
  onRevealResult?: (path: string, jobId: string) => void | Promise<void>;
  onOpenOutput?: (path: string, jobId: string) => void | Promise<void>;
  onImportResult?: (path: string, jobId: string) => void | Promise<void>;
};

const labels: Record<BatchImageTool, [string, string]> = {
  'remove-background': ['去除背景', 'Remove background'],
  upscale: ['放大图像', 'Upscale image'],
  resize: ['调整尺寸', 'Resize'],
  'format-convert': ['格式转换', 'Format conversion'],
};

export const ImageToolsPage = ({ locale, jobs, onCreate, onChooseInput, onChooseOutput, onScan, onPause, onResume, onCancel, onRetryItem, onOpenResult, onRevealResult, onOpenOutput, onImportResult }: ImageToolsPageProps) => {
  const [tool, setTool] = useState<BatchImageTool>('remove-background');
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(1200);
  const [sourcePath, setSourcePath] = useState('');
  const [outputRoot, setOutputRoot] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [outputLabel, setOutputLabel] = useState('');
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [connectionId, setConnectionId] = useState('');
  const [connections, setConnections] = useState<string[]>([]);
  const [scan, setScan] = useState<{ accepted: Array<{ relativePath: string }>; rejected: Array<{ path: string; code: string; detail?: string }> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getDesktopApi().loadProviderConfigs?.().then((configs) => {
      if (cancelled || !configs) return;
      const available = Object.entries(configs).filter(([, config]) => Boolean(config?.image.models['image-editing'])).map(([id]) => id);
      setConnections(available);
      setConnectionId((current) => current && available.includes(current) ? current : '');
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { setScan(null); }, [format, height, outputRoot, sourcePath, tool, width]);
  const params = useMemo<ToolParams>(() => {
    if (tool === 'resize') return { width, height, format };
    if (tool === 'format-convert') return { format };
    return Object.create(null) as ToolParams;
  }, [format, height, tool, width]);
  const chooseInput = async (): Promise<void> => {
    const selected = await onChooseInput?.();
    if (selected) { setSourcePath(selected.path); setSourceLabel(selected.displayName ?? selected.path); }
  };
  const chooseOutput = async (): Promise<void> => {
    const selected = await onChooseOutput?.();
    if (selected) { setOutputRoot(selected.path); setOutputLabel(selected.displayName ?? selected.path); }
  };
  const runScan = async (): Promise<void> => {
    if (!sourcePath || !outputRoot || !onScan) return;
    setScan(await onScan({ tool, params, sourcePath, outputRoot }));
  };
  const canCreate = Boolean(sourcePath && outputRoot && scan?.accepted.length && !scan.rejected.length && ((tool !== 'remove-background' && tool !== 'upscale') || connectionId.trim()));
  return <section aria-label={t(locale, '图像工具', 'Image tools')} className="page-content library-page image-tools-page">
    <header className="page-heading image-tools-page__header"><div className="page-heading__content"><p className="section-kicker">{t(locale, '批量处理', 'Batch processing')}</p><h1>{t(locale, '图像工具', 'Image tools')}</h1><p>{t(locale, '无需创建项目即可处理单图或目录中的图像。', 'Process individual images or folders without creating a project.')}</p></div><div className="image-tools-page__actions"><Button icon="search" variant="secondary" disabled={!sourcePath || !outputRoot} onClick={() => { void runScan(); }}>{t(locale, '检查输入', 'Scan input')}</Button><Button icon="play" variant="primary" disabled={!canCreate} onClick={() => { void onCreate({ tool, params, sourcePath, outputRoot, ...(connectionId.trim() ? { connectionId: connectionId.trim() } : {}) }); }}>{t(locale, '创建作业', 'Create job')}</Button></div></header>
    <div className="image-tools-page__controls">
      <Field label={t(locale, '工具', 'Tool')}><Select ariaLabel={t(locale, '工具', 'Tool')} value={tool} onChange={(value) => setTool(value as BatchImageTool)} options={batchImageTools.map((item) => ({ value: item, label: t(locale, labels[item][0], labels[item][1]) }))} /></Field>
      {(tool === 'remove-background' || tool === 'upscale') && <Field label={t(locale, '模型连接', 'Model connection')}><Select ariaLabel={t(locale, '模型连接', 'Model connection')} value={connectionId} onChange={setConnectionId} options={[{ value: '', label: t(locale, '请选择已配置连接', 'Select a configured connection') }, ...connections.map((id) => ({ value: id, label: id }))]} /></Field>}
      <div className="image-tools-page__source-actions"><Button icon="folder-open" variant="secondary" onClick={() => { void chooseInput(); }}>{t(locale, sourceLabel || '选择输入文件或文件夹', sourceLabel || 'Choose input file or folder')}</Button><Button icon="folder-output" variant="secondary" onClick={() => { void chooseOutput(); }}>{t(locale, outputLabel || '选择输出文件夹', outputLabel || 'Choose output folder')}</Button></div>
      {(tool === 'resize' || tool === 'format-convert') && <Field label={t(locale, '输出格式', 'Output format')}><Select ariaLabel={t(locale, '输出格式', 'Output format')} value={format} onChange={(value) => setFormat(value as typeof format)} options={[{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPEG' }, { value: 'webp', label: 'WebP' }]} /></Field>}
      {tool === 'resize' && <><Field label={t(locale, '宽度', 'Width')}><input type="number" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></Field><Field label={t(locale, '高度', 'Height')}><input type="number" value={height} onChange={(event) => setHeight(Number(event.target.value))} /></Field></>}
    </div>
    {scan && <section className="image-tools-scan" aria-label={t(locale, '扫描结果', 'Scan result')}><strong>{t(locale, `${scan.accepted.length} 个文件可处理`, `${scan.accepted.length} files accepted`)}</strong>{scan.rejected.length > 0 && <ul>{scan.rejected.map((item) => <li key={`${item.path}-${item.code}`}>{item.path}: {item.detail ?? item.code}</li>)}</ul>}</section>}
    {jobs.length === 0 ? <div className="page-empty-state"><EmptyState title={t(locale, '暂无图像作业', 'No image jobs')} description={t(locale, '创建作业后将在这里恢复和管理批处理。', 'Created jobs can be resumed and managed here.')} /></div> : <div className="image-tools-page__jobs">{jobs.map(({ job, items }) => { const label = labels[job.tool as BatchImageTool] ?? ['图像工具', 'Image tool']; return <article key={job.id} className="image-tools-job"><div><strong>{t(locale, label[0], label[1])}</strong><Badge>{job.state}</Badge><span>{items.length} {t(locale, '项', 'items')}</span></div><div className="image-tools-job__actions">{job.state === 'paused' ? <Button icon="play" variant="ghost" onClick={() => { void onResume(job.id); }}>{t(locale, '继续', 'Resume')}</Button> : <Button icon="pause" variant="ghost" onClick={() => { void onPause(job.id); }}>{t(locale, '暂停', 'Pause')}</Button>}<Button icon="x" variant="ghost" onClick={() => { void onCancel(job.id); }}>{t(locale, '取消', 'Cancel')}</Button><Button icon="folder-output" variant="ghost" onClick={() => { void onOpenOutput?.(job.outputRoot, job.id); }}>{t(locale, '打开输出目录', 'Open output')}</Button></div>{items.filter((item) => item.state === 'failed' || item.state === 'unknown').map((item) => <div key={item.id} className="image-tools-job__item"><span>{item.relativePath}</span><Button icon="rotate-ccw" variant="ghost" onClick={() => { void onRetryItem(job.id, item.id); }}>{t(locale, '重试', 'Retry')}</Button></div>)}{items.filter((item) => item.resultPath).map((item) => <div key={`${item.id}-actions`} className="image-tools-job__item"><span>{item.relativePath}</span><Button icon="external-link" variant="ghost" onClick={() => { if (item.resultPath) void onOpenResult?.(item.resultPath, job.id); }}>{t(locale, '打开结果', 'Open result')}</Button><Button icon="locate-fixed" variant="ghost" onClick={() => { if (item.resultPath) void onRevealResult?.(item.resultPath, job.id); }}>{t(locale, '显示位置', 'Reveal')}</Button><Button icon="download" variant="ghost" onClick={() => { if (item.resultPath) void onImportResult?.(item.resultPath, job.id); }}>{t(locale, '导入素材库', 'Import asset')}</Button></div>)}</article>; })}</div>}
  </section>;
};
