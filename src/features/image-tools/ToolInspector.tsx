import type { Locale } from '../../app/i18n';
import { Button, Field, Select, t } from '../../app/studio/ui';
import { getToolDefinition, imageTools, type ImageTool, type ToolParams } from './target';
import { MaskEditor } from '../canvas/MaskEditor';
import type { Region } from '../canvas/selection';

export type ToolInspectorProps = {
  tool: ImageTool;
  params: ToolParams;
  tools?: readonly ImageTool[];
  locale?: Locale;
  readOnly?: boolean;
  hideActions?: boolean;
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
    'remove-watermark': ['移除水印', 'Remove watermark'],
  };
  const [zh, en] = labels[tool];
  return t(locale, zh, en);
};

const fieldLabel = (locale: Locale, key: string, fallback: string): string => {
  const labels: Record<string, [string, string]> = {
    edgeRefinement: ['边缘优化', 'Edge refinement'],
    prompt: ['描述', 'Prompt'],
    source: ['背景来源', 'Background source'],
    backgroundAssetId: ['背景素材', 'Background asset'],
    backgroundColor: ['背景颜色', 'Background color'],
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
    safeArea: ['安全区', 'Safe area'],
    mode: ['模式', 'Mode'],
    scale: ['倍率', 'Scale'],
    preserveDetails: ['细节', 'Detail mode'],
    format: ['格式', 'Format'],
    fit: ['适配', 'Fit'],
    rightsConfirmed: ['权利确认', 'Rights confirmation'],
  };
  const value = labels[key];
  return value ? t(locale, value[0], value[1]) : fallback;
};

const fieldHelp = (locale: Locale, key: string): string => {
  const help: Record<string, [string, string]> = {
    edgeRefinement: ['调整主体边缘的平滑程度，数值越高边缘越柔和。', 'Controls edge smoothing; higher values produce softer edges.'],
    prompt: ['描述希望生成或重绘的内容。', 'Describe what should be generated or repainted.'],
    source: ['选择背景内容的来源类型。', 'Choose where the replacement background comes from.'],
    backgroundAssetId: ['填写受管素材库中的背景图片素材 ID。', 'Enter the ID of a background image in the managed asset library.'],
    backgroundColor: ['输入六位十六进制背景颜色，例如 #FFFFFF。', 'Enter a six-digit hexadecimal color, such as #FFFFFF.'],
    lighting: ['选择新背景使用的光线风格。', 'Choose the lighting style for the new background.'],
    feather: ['调整遮罩边缘的过渡范围，避免修复边缘过硬。', 'Adjust the mask edge transition to avoid harsh seams.'],
    strength: ['控制局部重绘对原图的改变幅度，范围为 0 到 1。', 'Controls how strongly inpainting changes the source, from 0 to 1.'],
    top: ['向画布上方扩展的像素数。', 'Pixels to add above the canvas.'],
    right: ['向画布右侧扩展的像素数。', 'Pixels to add to the right of the canvas.'],
    bottom: ['向画布下方扩展的像素数。', 'Pixels to add below the canvas.'],
    left: ['向画布左侧扩展的像素数。', 'Pixels to add to the left of the canvas.'],
    width: ['输出图片的目标宽度。', 'Target width of the output image.'],
    height: ['输出图片的目标高度。', 'Target height of the output image.'],
    focus: ['选择智能裁切时优先保留的焦点。', 'Choose the focus to preserve during smart cropping.'],
    safeArea: ['设置主体周围需要保留的安全边距，范围为 0 到 100。', 'Sets the safe margin around the subject, from 0 to 100.'],
    mode: ['选择扩展画布时的生成方式。', 'Choose how the canvas extension is generated.'],
    scale: ['选择输出图像相对于原图的放大倍率。', 'Choose the output scale relative to the source image.'],
    preserveDetails: ['选择放大时更优先保留的细节类型。', 'Choose which detail type to prioritize during upscaling.'],
    format: ['选择输出文件格式。', 'Choose the output file format.'],
    fit: ['选择目标尺寸与原图比例不一致时的适配方式。', 'Choose how to fit the source when aspect ratios differ.'],
    rightsConfirmed: ['确认你拥有处理所选水印内容的权利。', 'Confirm that you have the right to process the selected watermark.'],
  };
  const value = help[key];
  return value ? t(locale, value[0], value[1]) : '';
};

const optionLabel = (locale: Locale, key: string, value: string): string => {
  const labels: Record<string, [string, string]> = {
    'source.description': ['描述', 'Description'],
    'source.asset': ['素材', 'Asset'],
    'source.solid-color': ['纯色', 'Solid color'],
    'lighting.match-original': ['匹配原图', 'Match original'],
    'lighting.studio': ['摄影棚', 'Studio'],
    'lighting.natural': ['自然光', 'Natural'],
    'mode.original-scene': ['保持原场景', 'Original scene'],
    'mode.atmospheric': ['氛围扩展', 'Atmospheric'],
    'focus.subject': ['主体', 'Subject'],
    'focus.center': ['中心', 'Center'],
    'focus.face': ['人脸', 'Face'],
    'focus.manual': ['手动', 'Manual'],
    'preserveDetails.balanced': ['平衡', 'Balanced'],
    'preserveDetails.details': ['细节优先', 'Detail priority'],
    'preserveDetails.texture': ['纹理优先', 'Texture priority'],
    'fit.contain': ['包含', 'Contain'],
    'fit.cover': ['覆盖', 'Cover'],
    'fit.stretch': ['拉伸', 'Stretch'],
    'format.png': ['PNG', 'PNG'],
    'format.jpeg': ['JPEG', 'JPEG'],
    'format.webp': ['WebP', 'WebP'],
    'rightsConfirmed.confirmed': ['已确认', 'Confirmed'],
  };
  const label = labels[`${key}.${value}`];
  return label ? t(locale, label[0], label[1]) : value;
};

export const ToolInspector = ({ tool, params, tools = imageTools, locale = 'en', readOnly = false, hideActions = false, image, region, onToolChange, onParamsChange, onRegionChange, onApplyRegion, onCancelRegion, onClearRegion, onRun }: ToolInspectorProps) => {
  const definition = getToolDefinition(tool);
  const set = (key: string, value: string | number): void => onParamsChange({ ...params, [key]: value });
  const applyRegion = (nextRegion: Region): void => {
    onApplyRegion?.(nextRegion);
    onRun?.(nextRegion);
  };
  return <aside className="tool-inspector" aria-label={t(locale, '图像工具', 'Image tools')}>
    {tools.length > 1 && <Field label={t(locale, '工具', 'Tool')}><Select ariaLabel={t(locale, '工具', 'Tool')} value={tool} disabled={readOnly} onChange={(value) => onToolChange(value as ImageTool)} options={tools.map((name) => ({ value: name, label: toolLabel(locale, name) }))} /></Field>}
    <div className={`tool-inspector__fields ${tool === 'expand' ? 'tool-inspector__fields--expand' : ''}`}>
      {definition.schema.map((field) => {
        const label = fieldLabel(locale, field.key, field.label);
        return <Field
          key={field.key}
          label={label}
          required={field.required}
          requiredLabel={t(locale, '必填', 'Required')}
          help={fieldHelp(locale, field.key)}
          helpLabel={t(locale, `查看${label}帮助`, `Show help for ${label}`)}
        >{field.type === 'select'
          ? <Select ariaLabel={label} value={String(params[field.key] ?? '')} disabled={readOnly} onChange={(value) => set(field.key, value)} options={[...(!field.required ? [{ value: '', label: t(locale, '未指定', 'Unspecified') }] : []), ...(field.options?.map((option) => ({ value: option, label: optionLabel(locale, field.key, option) })) ?? [])]} />
          : <input aria-label={label} type={field.type} value={String(params[field.key] ?? '')} disabled={readOnly} onChange={(event) => set(field.key, field.type === 'number' ? Number(event.target.value) : event.target.value)} />}</Field>;
      })}
    </div>
    {definition.requiresRegion && image
      ? <MaskEditor className="tool-inspector__mask-editor" hideActions={hideActions} locale={locale} image={image} region={region} readOnly={readOnly} onChange={onRegionChange} onApply={applyRegion} onCancel={onCancelRegion} onClear={onClearRegion} />
      : !hideActions && <div className="dialog-actions"><Button variant="primary" disabled={readOnly} onClick={() => onRun?.()}>{t(locale, '执行', 'Run')}</Button></div>}
  </aside>;
};

export const ToolInspectorActions = ({
  tool,
  locale = 'en',
  readOnly = false,
  region,
  onApplyRegion,
  onCancelRegion,
  onClearRegion,
  onRun,
}: Pick<ToolInspectorProps, 'tool' | 'locale' | 'readOnly' | 'region' | 'onApplyRegion' | 'onCancelRegion' | 'onClearRegion' | 'onRun'>) => {
  const definition = getToolDefinition(tool);
  const applyRegion = (): void => {
    if (!region) return;
    onApplyRegion?.(region);
    onRun?.(region);
  };
  if (!definition.requiresRegion) {
    return <div className="dialog-actions"><Button variant="primary" disabled={readOnly} onClick={() => onRun?.()}>{t(locale, '执行', 'Run')}</Button></div>;
  }
  return <div className="dialog-actions tool-inspector-actions">
    <Button variant="primary" disabled={readOnly || !region} onClick={applyRegion}>{t(locale, '应用遮罩', 'Apply mask')}</Button>
    <Button onClick={onCancelRegion}>{t(locale, '取消', 'Cancel')}</Button>
    <Button disabled={readOnly} onClick={onClearRegion}>{t(locale, '清除遮罩', 'Clear mask')}</Button>
  </div>;
};
