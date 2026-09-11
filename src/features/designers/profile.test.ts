import { expect, it } from 'vitest';
import { publishDesigner } from './profile';

it('publishes a snapshot that does not share the draft rules array', () => {
  const draft = { name: 'Paper & Type', rules: ['Keep the subject visible'] };

  const version = publishDesigner(draft, 'v1');
  draft.rules.push('Use warm neutrals');

  expect(version).toEqual({ versionId: 'v1', name: 'Paper & Type', rules: ['Keep the subject visible'] });
  expect(version.rules).not.toBe(draft.rules);
});

it('trims the published name', () => {
  const version = publishDesigner({ name: '  Paper & Type  ', rules: [] }, 'v2');

  expect(version.name).toBe('Paper & Type');
});

it('rejects a name that is empty after trimming', () => {
  expect(() => publishDesigner({ name: ' \t\n', rules: [] }, 'v1')).toThrow('NAME_REQUIRED');
});

it('allows an empty rules list and preserves the trusted version id', () => {
  const version = publishDesigner({ name: 'Minimal Form', rules: [] }, 'trusted-version-id');

  expect(version).toEqual({ versionId: 'trusted-version-id', name: 'Minimal Form', rules: [] });
});

it('does not let edits to the published rules affect the draft', () => {
  const draft = { name: 'Paper & Type', rules: ['Keep the subject visible'] };
  const version = publishDesigner(draft, 'v1');

  version.rules.push('Use warm neutrals');

  expect(draft.rules).toEqual(['Keep the subject visible']);
});
