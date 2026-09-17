import { expect, it } from 'vitest';

import { createPortfolioSourceInspector } from '../../src/desktop/portfolio-source-inspector';

const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64'));

it('keeps selected local sources available for one explicit submission and discards them afterwards', async () => {
  const inspector = createPortfolioSourceInspector({ readFile: async () => png });
  const inspection = await inspector.inspectLocalFiles(['reference.png']);
  const [candidate] = inspection.candidates;

  const selected = await inspector.selectedSources(inspection.id, [candidate!.id]);
  expect(selected).toHaveLength(1);
  expect(selected[0]!.image).toMatchObject({ base64: expect.any(String), mimeType: 'image/jpeg' });

  inspector.discard(inspection.id);
  await expect(inspector.selectedSources(inspection.id, [candidate!.id])).rejects.toThrow('PORTFOLIO_INSPECTION_NOT_FOUND');
});

it('retains an inspection when the caller does not discard it after a failed submission', async () => {
  const inspector = createPortfolioSourceInspector({ readFile: async () => png });
  const inspection = await inspector.inspectLocalFiles(['reference.png']);
  const [candidate] = inspection.candidates;

  await expect(inspector.selectedSources('missing-inspection', [candidate!.id])).rejects.toThrow('PORTFOLIO_INSPECTION_NOT_FOUND');
  await expect(inspector.selectedSources(inspection.id, [candidate!.id])).resolves.toHaveLength(1);
});
