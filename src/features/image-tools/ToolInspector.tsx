import { getToolDefinition, imageTools, type ImageTool } from './target';

export type ToolInspectorProps = { tool: ImageTool; params: Record<string, unknown>; onToolChange: (tool: ImageTool) => void; onParamsChange: (params: Record<string, unknown>) => void };
export const ToolInspector = ({ tool, params, onToolChange, onParamsChange }: ToolInspectorProps) => {
  const definition = getToolDefinition(tool);
  const set = (key: string, value: unknown): void => onParamsChange({ ...params, [key]: value });
  return <aside aria-label="Image tools">
    <label>Tool <select value={tool} onChange={(event) => onToolChange(event.target.value as ImageTool)}>{imageTools.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
    {definition.schema.map((field) => <label key={field.key}>{field.label}<input aria-label={field.label} type={field.type === 'select' ? 'text' : field.type} value={String(params[field.key] ?? '')} onChange={(event) => set(field.key, field.type === 'number' ? Number(event.target.value) : event.target.value)} /></label>)}
  </aside>;
};
