import { useState } from 'react';
import { Select } from '../../app/studio/ui';
import type { ExportFormat } from './export-policy';

export type ExportDialogProps = {
  revisionId: string;
  onExport: (format: ExportFormat, revisionId: string) => Promise<void>;
};

export const ExportDialog = ({ revisionId, onExport }: ExportDialogProps) => {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await onExport(format, revisionId); } finally { setBusy(false); }
  };
  return (
    <section className="export-dialog" aria-label="Export document">
      <label>Format<Select ariaLabel="Format" value={format} onChange={(value) => setFormat(value as ExportFormat)} options={[{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPEG' }, { value: 'webp', label: 'WebP' }, { value: 'pdf', label: 'PDF' }]} /></label>
      <button type="button" onClick={submit} disabled={busy}>{busy ? 'Working' : 'Export'}</button>
    </section>
  );
};
