import { expect, it } from 'vitest';

import { createPortfolioSourceInspector } from '../../src/desktop/portfolio-source-inspector';

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

it('keeps selected local sources available for one explicit submission and discards them afterwards', async () => {
  const inspector = createPortfolioSourceInspector({ readFile: async () => png });
  const inspection = await inspector.inspectLocalImages(['reference.png']);
  const [candidate] = inspection.candidates;

  const selected = await inspector.selectedSources(inspection.id, [candidate!.id]);
  expect(selected).toHaveLength(1);
  expect(selected[0]!.image).toMatchObject({ base64: Buffer.from(png).toString('base64'), mimeType: 'image/png' });

  inspector.discard(inspection.id);
  await expect(inspector.selectedSources(inspection.id, [candidate!.id])).rejects.toThrow('PORTFOLIO_INSPECTION_NOT_FOUND');
});

it('retains an inspection when the caller does not discard it after a failed submission', async () => {
  const inspector = createPortfolioSourceInspector({ readFile: async () => png });
  const inspection = await inspector.inspectLocalImages(['reference.png']);
  const [candidate] = inspection.candidates;

  await expect(inspector.selectedSources('missing-inspection', [candidate!.id])).rejects.toThrow('PORTFOLIO_INSPECTION_NOT_FOUND');
  await expect(inspector.selectedSources(inspection.id, [candidate!.id])).resolves.toHaveLength(1);
});
