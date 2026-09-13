import { useEffect, useState } from 'react';

import { getMessages, type Locale } from '../../app/i18n';
import { Field, Select } from '../../app/studio/ui';
import { assessFontAvailability } from './font-availability';
import type { TextLayer } from './scene';
import { shouldHandleCanvasShortcut } from './text-input';

export type TextEditorProps = {
  locale: Locale;
  layer: TextLayer;
  availableFonts: string[];
  onChange: (layer: TextLayer) => void;
};

export const TextEditor = ({ locale, layer, availableFonts, onChange }: TextEditorProps) => {
  const messages = getMessages(locale);
  const [draft, setDraft] = useState(() => structuredClone(layer));
  const availability = assessFontAvailability(draft.fontFamily, availableFonts);
  useEffect(() => setDraft(structuredClone(layer)), [layer]);
  const update = <K extends keyof TextLayer>(key: K, value: TextLayer[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <form aria-label={messages.textEditorLabel} onSubmit={(event) => { event.preventDefault(); onChange(structuredClone(draft)); }}>
      <Field label={messages.textContent}>
        <textarea
          aria-label={messages.textContent}
          value={draft.text}
          onChange={(event) => update('text', event.target.value)}
          onKeyDown={(event) => { if (shouldHandleCanvasShortcut({ composing: event.nativeEvent.isComposing, key: event.key })) event.stopPropagation(); }}
        />
      </Field>
      <Field label={messages.textFamily}>
        <input aria-label={messages.textFamily} value={draft.fontFamily} onChange={(event) => update('fontFamily', event.target.value)} />
      </Field>
      {!availability.available && <p role="status">{messages.textFontMissing}: {availability.previewFamily}</p>}
      <Field label={messages.textSize}>
        <input aria-label={messages.textSize} type="number" min="1" value={draft.fontSize} onChange={(event) => update('fontSize', Math.max(1, Number(event.target.value) || 1))} />
      </Field>
      <Field label={messages.textColor}>
        <input aria-label={messages.textColor} value={draft.color} onChange={(event) => update('color', event.target.value)} />
      </Field>
      <Field label={messages.textAlign}>
        <Select ariaLabel={messages.textAlign} value={draft.align} onChange={(value) => update('align', value as TextLayer['align'])} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} />
      </Field>
      <button type="submit">{messages.textApply}</button>
    </form>
  );
};
