import { useState } from 'react';

import { Button, Field } from '../../app/studio/ui';
import type { Brand } from './constraints';

export type BrandEditorProps = {
  brand: Brand;
  onSave: (brand: Brand) => void;
};

export const BrandEditor = ({ brand, onSave }: BrandEditorProps) => {
  const [draft, setDraft] = useState(brand);
  const update = <K extends keyof Brand>(field: K, value: Brand[K]) => setDraft((current) => ({ ...current, [field]: value }));
  const updateList = (field: 'colorPalette' | 'fonts' | 'sizes', value: string) => update(field, value.split(',').map((item) => item.trim()).filter(Boolean));
  return (
    <form aria-label="Brand editor" onSubmit={(event) => { event.preventDefault(); onSave(structuredClone(draft)); }}>
      <Field label="Logo"><input value={draft.logo} onChange={(event) => update('logo', event.target.value)} /></Field>
      <Field label="Color palette"><input value={draft.colorPalette.join(', ')} onChange={(event) => updateList('colorPalette', event.target.value)} /></Field>
      <Field label="Fonts"><input value={draft.fonts.join(', ')} onChange={(event) => updateList('fonts', event.target.value)} /></Field>
      <Field label="Tone"><textarea value={draft.tone} onChange={(event) => update('tone', event.target.value)} /></Field>
      <Field label="Fixed copy"><textarea value={draft.fixedCopy} onChange={(event) => update('fixedCopy', event.target.value)} /></Field>
      <Field label="Sizes"><input value={draft.sizes.join(', ')} onChange={(event) => updateList('sizes', event.target.value)} /></Field>
      <Button type="submit" variant="primary" icon="save">Save brand</Button>
    </form>
  );
};
