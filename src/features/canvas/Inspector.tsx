import { getMessages, type Locale } from '../../app/i18n';
import { Field } from '../../app/studio/ui';
import type { SceneLayer } from './scene';

export type InspectorProps = {
  locale: Locale;
  layer?: SceneLayer;
  onChange: (layer: SceneLayer) => void;
};

const numberOr = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const Inspector = ({ locale, layer, onChange }: InspectorProps) => {
  const messages = getMessages(locale);
  if (!layer) return <aside className="canvas-inspector" aria-label={messages.canvasInspector}><h2>{messages.canvasInspector}</h2><p>{messages.canvasEmptySelection}</p></aside>;
  const update = <K extends keyof SceneLayer>(key: K, value: SceneLayer[K]) => onChange({ ...layer, [key]: value } as SceneLayer);
  const numeric = (key: 'x' | 'y' | 'width' | 'height' | 'opacity') => (event: React.ChangeEvent<HTMLInputElement>) => update(key, numberOr(event.target.value, layer[key]));
  return (
    <aside className="canvas-inspector" aria-label={messages.canvasInspector}>
      <h2>{messages.canvasInspector}</h2>
      <Field label={messages.canvasX}><input type="number" value={layer.x} onChange={numeric('x')} disabled={layer.locked} /></Field>
      <Field label={messages.canvasY}><input type="number" value={layer.y} onChange={numeric('y')} disabled={layer.locked} /></Field>
      <Field label={messages.canvasWidth}><input type="number" min="1" value={layer.width} onChange={numeric('width')} disabled={layer.locked} /></Field>
      <Field label={messages.canvasHeight}><input type="number" min="1" value={layer.height} onChange={numeric('height')} disabled={layer.locked} /></Field>
      <Field label={messages.canvasOpacity}><input type="number" min="0" max="1" step="0.05" value={layer.opacity} onChange={numeric('opacity')} disabled={layer.locked} /></Field>
      <Field label={messages.canvasVisible}><input type="checkbox" checked={layer.visible} onChange={(event) => update('visible', event.target.checked)} /></Field>
      <Field label={messages.canvasLocked}><input type="checkbox" checked={layer.locked} onChange={(event) => update('locked', event.target.checked)} /></Field>
    </aside>
  );
};
