import { useState } from 'react';
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
      <label>Format<select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option><option value="pdf">PDF</option></select></label>
      <button type="button" onClick={submit} disabled={busy}>{busy ? 'Working' : 'Export'}</button>
    </section>
  );
};
