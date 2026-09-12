import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { PersonaArtwork } from './PersonaArtwork';
import type { PersonaProfile } from './personas';

it('renders an accessible fixed-ratio persona image and an honest unavailable fallback', () => {
  const { rerender } = render(<PersonaArtwork personaId="paper-type" crop="full" />);
  expect(screen.getByRole('img', { name: '纸感排版的人物形象' })).toHaveAttribute(
    'src',
    '/personas/paper-type.png',
  );
  rerender(<PersonaArtwork personaId="missing" crop="avatar" />);
  expect(screen.getByText('形象不可用')).toBeInTheDocument();
});

it('renders artwork from a persisted custom profile instead of the built-in lookup', () => {
  const profile = {
    id: 'custom-1',
    name: { zh: '自定义设计师', en: 'Custom designer' },
    artworkUrl: 'data:image/png;base64,custom',
    artworkAlt: { zh: '自定义形象', en: 'Custom portrait' },
  } as PersonaProfile;

  render(<PersonaArtwork personaId={profile.id} profile={profile} crop="avatar" />);

  expect(screen.getByRole('img', { name: '自定义形象的人物形象' })).toHaveAttribute('src', profile.artworkUrl);
});
