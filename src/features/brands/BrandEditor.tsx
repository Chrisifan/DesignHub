import { useEffect, useState } from 'react';

import { getMessages, type Locale } from '../../app/i18n';
import { Button, Field } from '../../app/studio/ui';
import type { Brand } from './constraints';

export type BrandEditorProps = {
  brand: Brand;
  locale: Locale;
  onSave: (brand: Brand) => void;
};

const listText = (value: string[]): string => value.join(', ');

const parseList = (value: string): string[] => value.split(',').map((item) => item.trim()).filter(Boolean);

export const BrandEditor = ({ brand, locale, onSave }: BrandEditorProps) => {
  const messages = getMessages(locale);
  const [draft, setDraft] = useState(() => structuredClone(brand));
  const [colorPaletteText, setColorPaletteText] = useState(() => listText(brand.colorPalette));
  const [fontsText, setFontsText] = useState(() => listText(brand.fonts));
  const [sizesText, setSizesText] = useState(() => listText(brand.sizes));
  useEffect(() => {
    setDraft(structuredClone(brand));
    setColorPaletteText(listText(brand.colorPalette));
    setFontsText(listText(brand.fonts));
    setSizesText(listText(brand.sizes));
  }, [brand]);
  const update = <K extends keyof Brand>(field: K, value: Brand[K]) => setDraft((current) => ({ ...current, [field]: value }));
  return (
    <form aria-label={messages.brandEditorLabel} onSubmit={(event) => { event.preventDefault(); onSave({ ...structuredClone(draft), colorPalette: parseList(colorPaletteText), fonts: parseList(fontsText), sizes: parseList(sizesText) }); }}>
      <Field label={messages.brandName}><input value={draft.name ?? ''} onChange={(event) => update('name', event.target.value)} /></Field>
      <Field label={messages.brandLogo}><input value={draft.logo} onChange={(event) => update('logo', event.target.value)} /></Field>
      <Field label={messages.brandPalette}><input value={colorPaletteText} onChange={(event) => setColorPaletteText(event.target.value)} /></Field>
      <Field label={messages.brandFonts}><input value={fontsText} onChange={(event) => setFontsText(event.target.value)} /></Field>
      <Field label={messages.brandTone}><textarea value={draft.tone} onChange={(event) => update('tone', event.target.value)} /></Field>
      <Field label={messages.brandFixedCopy}><textarea value={draft.fixedCopy} onChange={(event) => update('fixedCopy', event.target.value)} /></Field>
      <Field label={messages.brandSizes}><input value={sizesText} onChange={(event) => setSizesText(event.target.value)} /></Field>
      <Button type="submit" variant="primary" icon="save">{messages.brandSave}</Button>
    </form>
  );
};
