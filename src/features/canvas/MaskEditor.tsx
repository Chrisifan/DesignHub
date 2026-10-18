import { useEffect, useState } from 'react';

import { type Locale } from '../../app/i18n';
import { t } from '../../app/studio/ui';
import { isRegionInside, type Region } from './selection';

export type MaskEditorProps = {
  image: { width: number; height: number };
  className?: string;
  hideActions?: boolean;
  locale?: Locale;
  region?: Region;
  readOnly?: boolean;
  onChange?: (region: Region | undefined) => void;
  onApply?: (region: Region) => void;
  onCancel?: () => void;
  onClear?: () => void;
};

export const MaskEditor = ({ image, className = '', hideActions = false, locale = 'en', region, readOnly = false, onChange, onApply, onCancel, onClear }: MaskEditorProps) => {
  const [draft, setDraft] = useState<Region | undefined>(region);
  useEffect(() => setDraft(region), [region]);
  const labels = {
    title: t(locale, '遮罩编辑', 'Mask editor'),
    x: t(locale, '横坐标', 'X'), y: t(locale, '纵坐标', 'Y'), width: t(locale, '宽度', 'Width'), height: t(locale, '高度', 'Height'),
    apply: t(locale, '应用遮罩', 'Apply mask'), cancel: t(locale, '取消', 'Cancel'), clear: t(locale, '清除遮罩', 'Clear mask'),
    invalid: t(locale, '区域必须位于图像内。', 'Region must stay inside the image.'),
  };
  const update = (key: keyof Region) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    const next = { ...(draft ?? { x: 0, y: 0, width: 1, height: 1 }), [key]: value };
    setDraft(next);
    onChange?.(isRegionInside(next, image) ? next : undefined);
  };
  const valid = !!draft && isRegionInside(draft, image);
  return <form className={`canvas-mask-editor ${className}`.trim()} aria-label={labels.title} onSubmit={(event) => { event.preventDefault(); if (valid) onApply?.(draft); }}>
    {(['x', 'y', 'width', 'height'] as const).map((key) => <label key={key}><span>{labels[key]}</span><input type="number" min="0" value={draft?.[key] ?? ''} onChange={update(key)} disabled={readOnly} /></label>)}
    {!valid && draft && <p role="alert">{labels.invalid}</p>}
    {!hideActions && <div className="canvas-mask-editor__actions"><button type="submit" disabled={readOnly || !valid}>{labels.apply}</button><button type="button" onClick={onCancel}>{labels.cancel}</button><button type="button" onClick={() => { setDraft(undefined); onClear?.(); }} disabled={readOnly}>{labels.clear}</button></div>}
  </form>;
};
