import { getToolDefinition, imageTools, type ImageTool } from './target';
import { MaskEditor } from '../canvas/MaskEditor';
import type { Region } from '../canvas/selection';

export type ToolInspectorProps = { tool: ImageTool; params: Record<string, unknown>; image?: { width: number; height: number }; region?: Region; onToolChange: (tool: ImageTool) => void; onParamsChange: (params: Record<string, unknown>) => void; onRegionChange?: (region: Region | undefined) => void; onApplyRegion?: (region: Region) => void; onCancelRegion?: () => void; onClearRegion?: () => void };
export const ToolInspector = ({ tool, params, image, region, onToolChange, onParamsChange, onRegionChange, onApplyRegion, onCancelRegion, onClearRegion }: ToolInspectorProps) => {
  const definition = getToolDefinition(tool);
  const set = (key: string, value: unknown): void => onParamsChange({ ...params, [key]: value });
  return <aside aria-label="Image tools">
    <label>Tool <select value={tool} onChange={(event) => onToolChange(event.target.value as ImageTool)}>{imageTools.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
    {definition.schema.map((field) => <label key={field.key}>{field.label}{field.type === 'select' ? <select aria-label={field.label} value={String(params[field.key] ?? '')} onChange={(event) => set(field.key, event.target.value)}><option value="">Select</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input aria-label={field.label} type={field.type} value={String(params[field.key] ?? '')} onChange={(event) => set(field.key, field.type === 'number' ? Number(event.target.value) : event.target.value)} />}</label>)}
    {definition.requiresRegion && image && <MaskEditor image={image} region={region} onChange={onRegionChange} onApply={onApplyRegion} onCancel={onCancelRegion} onClear={onClearRegion} />}
  </aside>;
};
