import { useState } from 'react';

export type DeliveryPackageDialogProps = { onCreate: (readOnly: boolean) => Promise<void> };

export const DeliveryPackageDialog = ({ onCreate }: DeliveryPackageDialogProps) => {
  const [readOnly, setReadOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const create = async () => { setBusy(true); try { await onCreate(readOnly); } finally { setBusy(false); } };
  return (
    <section className="delivery-package-dialog" aria-label="Project package">
      <label><input type="checkbox" checked={readOnly} onChange={(event) => setReadOnly(event.target.checked)} /> Read-only delivery</label>
      <button type="button" onClick={create} disabled={busy}>{busy ? 'Working' : 'Create'}</button>
    </section>
  );
};
