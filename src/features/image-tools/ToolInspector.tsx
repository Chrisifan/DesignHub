import type { Locale } from '../../app/i18n';
import { Button, Field, t } from '../../app/studio/ui';
import { getToolDefinition, imageTools, type ImageTool, type ToolParams } from './target';
import { MaskEditor } from '../canvas/MaskEditor';
import type { Region } from '../canvas/selection';

export type ToolInspectorProps = {
  tool: ImageTool;
  params: ToolParams;
  tools?: readonly ImageTool[];
  locale?: Locale;
  readOnly?: boolean;
  image?: { width: number; height: number };
  region?: Region;
  onToolChange: (tool: ImageTool) => void;
  onParamsChange: (params: ToolParams) => void;
  onRegionChange?: (region: Region | undefined) => void;
  onApplyRegion?: (region: Region) => void;
  onCancelRegion?: () => void;
  onClearRegion?: () => void;
  onRun?: (region?: Region) => void;
};

const toolLabel = (locale: Locale, tool: ImageTool): string => {
  const labels: Record<ImageTool, [string, string]> = {
    'remove-background': ['去除背景', 'Remove background'],
    'replace-background': ['替换背景', 'Replace background'],
    'remove-object': ['移除对象', 'Remove object'],
    inpaint: ['局部重绘', 'Inpaint'],
    expand: ['扩展画布', 'Expand canvas'],
    'smart-crop': ['智能裁切', 'Smart crop'],
    upscale: ['放大图像', 'Upscale image'],
    resize: ['调整尺寸', 'Resize'],
  };
  const [zh, en] = labels[tool];
  return t(locale, zh, en);
};

const fieldLabel = (locale: Locale, key: string, fallback: string): string => {
  const labels: Record<string, [string, string]> = {
    edgeRefinement: ['边缘优化', 'Edge refinement'],
    prompt: ['描述', 'Prompt'],
    lighting: ['光线', 'Lighting'],
    feather: ['羽化', 'Feather'],
    strength: ['强度', 'Strength'],
    top: ['上方', 'Top'],
    right: ['右侧', 'Right'],
    bottom: ['下方', 'Bottom'],
    left: ['左侧', 'Left'],
    width: ['宽度', 'Width'],
    height: ['高度', 'Height'],
    focus: ['焦点', 'Focus'],
    scale: ['倍率', 'Scale'],
    preserveDetails: ['细节', 'Detail mode'],
    format: ['格式', 'Format'],
  };
  const value = labels[key];
  return value ? t(locale, value[0], value[1]) : fallback;
};

export const ToolInspector = ({ tool, params, tools = imageTools, locale = 'en', readOnly = false, image, region, onToolChange, onParamsChange, onRegionChange, onApplyRegion, onCancelRegion, onClearRegion, onRun }: ToolInspectorProps) => {
  const definition = getToolDefinition(tool);
  const set = (key: string, value: string | number): void => onParamsChange({ ...params, [key]: value });
  const applyRegion = (nextRegion: Region): void => {
    onApplyRegion?.(nextRegion);
    onRun?.(nextRegion);
  };
  return <aside aria-label={t(locale, '图像工具', 'Image tools')}>
    {tools.length > 1 && <Field label={t(locale, '工具', 'Tool')}><select value={tool} disabled={readOnly} onChange={(event) => onToolChange(event.target.value as ImageTool)}>{tools.map((name) => <option key={name} value={name}>{toolLabel(locale, name)}</option>)}</select></Field>}
    {definition.schema.map((field) => {
      const label = fieldLabel(locale, field.key, field.label);
      return <Field key={field.key} label={label}>{field.type === 'select'
        ? <select aria-label={label} value={String(params[field.key] ?? '')} disabled={readOnly} onChange={(event) => set(field.key, event.target.value)}>{!field.required && <option value="">{t(locale, '未指定', 'Unspecified')}</option>}{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select>
        : <input aria-label={label} type={field.type} value={String(params[field.key] ?? '')} disabled={readOnly} onChange={(event) => set(field.key, field.type === 'number' ? Number(event.target.value) : event.target.value)} />}</Field>;
    })}
    {definition.requiresRegion && image
      ? <MaskEditor locale={locale} image={image} region={region} readOnly={readOnly} onChange={onRegionChange} onApply={applyRegion} onCancel={onCancelRegion} onClear={onClearRegion} />
      : <div className="dialog-actions"><Button variant="primary" disabled={readOnly} onClick={() => onRun?.()}>{t(locale, '执行', 'Run')}</Button></div>}
  </aside>;
};
