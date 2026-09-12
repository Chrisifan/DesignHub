import { getMessages, type Locale } from '../../app/i18n';
import { IconButton } from '../../app/studio/ui';
import type { SceneLayer } from './scene';

export type LayerListProps = {
  locale: Locale;
  layers: SceneLayer[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onMove?: (id: string, direction: 'up' | 'down') => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
};

const layerLabel = (layer: SceneLayer): string => {
  if (layer.type === 'text') return layer.text || layer.id;
  if (layer.type === 'image') return layer.assetId;
  return `${layer.kind} ${layer.id}`;
};

export const LayerList = ({ locale, layers, selectedIds, onSelect, onMove, onDuplicate, onDelete }: LayerListProps) => {
  const messages = getMessages(locale);
  return (
    <aside className="canvas-layer-list" aria-label={messages.canvasLayers}>
      <h2>{messages.canvasLayers}</h2>
      <ol>
        {[...layers].reverse().map((layer, displayIndex) => {
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
            <span className="canvas-layer-actions">
              {onMove && <>
                <IconButton name="arrow-up" label={locale === 'zh-CN' ? '上移图层' : 'Move layer up'} onClick={() => onMove(layer.id, 'up')} disabled={displayIndex === 0} />
                <IconButton name="arrow-down" label={locale === 'zh-CN' ? '下移图层' : 'Move layer down'} onClick={() => onMove(layer.id, 'down')} disabled={displayIndex === layers.length - 1} />
              </>}
              {onDuplicate && <IconButton name="copy" label={locale === 'zh-CN' ? '复制图层' : 'Duplicate layer'} onClick={() => onDuplicate(layer.id)} />}
              {onDelete && <IconButton name="trash-2" label={locale === 'zh-CN' ? '删除图层' : 'Delete layer'} onClick={() => onDelete(layer.id)} />}
            </span>
          </li>;
        })}
      </ol>
    </aside>
  );
};
