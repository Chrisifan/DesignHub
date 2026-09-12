import { getMessages, type Locale } from '../../app/i18n';
import type { SceneLayer } from './scene';

export type LayerListProps = {
  locale: Locale;
  layers: SceneLayer[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
};

const layerLabel = (layer: SceneLayer): string => {
  if (layer.type === 'text') return layer.text || layer.id;
  if (layer.type === 'image') return layer.assetId;
  return `${layer.kind} ${layer.id}`;
};

export const LayerList = ({ locale, layers, selectedIds, onSelect }: LayerListProps) => {
  const messages = getMessages(locale);
  return (
    <aside className="canvas-layer-list" aria-label={messages.canvasLayers}>
      <h2>{messages.canvasLayers}</h2>
      <ol>
        {[...layers].reverse().map((layer) => {
          const selected = selectedIds.includes(layer.id);
          return <li key={layer.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={(event) => onSelect(event.shiftKey ? [...selectedIds, layer.id] : [layer.id])}
            >
              <span>{layerLabel(layer)}</span>
              {!layer.visible && <span aria-label={messages.canvasVisible}>-</span>}
              {layer.locked && <span aria-label={messages.canvasLocked}>*</span>}
            </button>
          </li>;
        })}
      </ol>
    </aside>
  );
};
