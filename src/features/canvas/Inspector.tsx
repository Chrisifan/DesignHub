import { getMessages, type Locale } from '../../app/i18n';
import { Field } from '../../app/studio/ui';
import type { SceneLayer } from './scene';

export type InspectorProps = {
  locale: Locale;
  layer?: SceneLayer;
  selectedLayers?: SceneLayer[];
  onChange: (layer: SceneLayer) => void;
  onChangeMany?: (layers: SceneLayer[]) => void;
  readOnly?: boolean;
};

const numberOr = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const Inspector = ({ locale, layer, selectedLayers = [], onChange, onChangeMany, readOnly = false }: InspectorProps) => {
  const messages = getMessages(locale);
  const selection = selectedLayers.length ? selectedLayers : layer ? [layer] : [];
  if (!selection.length) return <aside className="canvas-inspector" aria-label={messages.canvasInspector}><h2>{messages.canvasInspector}</h2><p>{messages.canvasEmptySelection}</p></aside>;
  const activeLayer = selection[0]!;
  const update = <K extends keyof SceneLayer>(key: K, value: SceneLayer[K]) => onChange({ ...activeLayer, [key]: value } as SceneLayer);
  const updateMany = (patch: Partial<SceneLayer>): void => {
    const next = selection.map((entry) => ({ ...entry, ...patch } as SceneLayer));
    if (onChangeMany) onChangeMany(next);
    else next.forEach(onChange);
  };
  const numeric = (key: 'x' | 'y' | 'width' | 'height' | 'opacity') => (event: React.ChangeEvent<HTMLInputElement>) => update(key, numberOr(event.target.value, activeLayer[key]));
  const mixedOpacity = selection.some((entry) => entry.opacity !== activeLayer.opacity);
  const mixedVisible = selection.some((entry) => entry.visible !== activeLayer.visible);
  const mixedLocked = selection.some((entry) => entry.locked !== activeLayer.locked);
  return (
    <aside className="canvas-inspector" aria-label={messages.canvasInspector}>
      <h2>{messages.canvasInspector}</h2>
      {selection.length > 1 ? <>
        <p className="canvas-selection-count">{messages.canvasSelectionCount}: {selection.length}</p>
        <Field label={messages.canvasOpacity}><input type="number" min="0" max="1" step="0.05" value={mixedOpacity ? '' : activeLayer.opacity} placeholder={mixedOpacity ? '—' : undefined} onChange={(event) => updateMany({ opacity: numberOr(event.target.value, activeLayer.opacity) })} disabled={readOnly || selection.some((entry) => entry.locked)} /></Field>
        <Field label={messages.canvasVisible}><input type="checkbox" checked={mixedVisible ? false : activeLayer.visible} onChange={(event) => updateMany({ visible: event.target.checked })} disabled={readOnly} /></Field>
        <Field label={messages.canvasLocked}><input type="checkbox" checked={mixedLocked ? false : activeLayer.locked} onChange={(event) => updateMany({ locked: event.target.checked })} disabled={readOnly} /></Field>
      </> : <>
        <Field label={messages.canvasX}><input type="number" value={activeLayer.x} onChange={numeric('x')} disabled={readOnly || activeLayer.locked} /></Field>
        <Field label={messages.canvasY}><input type="number" value={activeLayer.y} onChange={numeric('y')} disabled={readOnly || activeLayer.locked} /></Field>
        <Field label={messages.canvasWidth}><input type="number" min="1" value={activeLayer.width} onChange={numeric('width')} disabled={readOnly || activeLayer.locked} /></Field>
        <Field label={messages.canvasHeight}><input type="number" min="1" value={activeLayer.height} onChange={numeric('height')} disabled={readOnly || activeLayer.locked} /></Field>
        <Field label={messages.canvasOpacity}><input type="number" min="0" max="1" step="0.05" value={activeLayer.opacity} onChange={numeric('opacity')} disabled={readOnly || activeLayer.locked} /></Field>
        <Field label={messages.canvasLayerName}><input type="text" value={activeLayer.name ?? ''} onChange={(event) => onChange({ ...activeLayer, name: event.target.value.trim() || undefined } as SceneLayer)} disabled={readOnly || activeLayer.locked} /></Field>
        <Field label={messages.canvasVisible}><input type="checkbox" checked={activeLayer.visible} onChange={(event) => update('visible', event.target.checked)} disabled={readOnly} /></Field>
        <Field label={messages.canvasLocked}><input type="checkbox" checked={activeLayer.locked} onChange={(event) => update('locked', event.target.checked)} disabled={readOnly} /></Field>
      </>}
    </aside>
  );
};
