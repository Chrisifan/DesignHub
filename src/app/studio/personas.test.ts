import { expect, it } from 'vitest';

import { getPersona, personaCandidates } from '../../../tests/fixtures/personas';

it('keeps exactly three ready example candidates with localized identity data', () => {
  expect(personaCandidates).toHaveLength(3);
  expect(personaCandidates.every((candidate) => candidate.status === 'ready')).toBe(true);
  expect(getPersona('paper-type')?.name.zh).toBe('纸感排版');
  expect(getPersona('missing')).toBeUndefined();
});
