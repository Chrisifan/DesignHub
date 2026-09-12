import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { DesignerHero } from './DesignerHero';
import type { PersonaProfile } from './personas';

it('renders custom persona artwork and name in the project hero', () => {
  const profile: PersonaProfile = {
    id: 'custom-hero', name: { zh: '自定义设计师', en: 'Custom designer' }, signature: { zh: '工作室', en: 'Studio' }, summary: { zh: '摘要', en: 'Summary' }, principle: { zh: '原则', en: 'Principle' }, personaCode: 'CSTM', version: 'v1.0', status: 'published', artworkUrl: '/custom-persona.png', artworkAlt: { zh: '自定义人物', en: 'Custom persona' }, tags: [], referenceCount: 0, styleDna: { palette: [], typography: { zh: '', en: '' }, composition: { zh: '', en: '' }, texture: { zh: '', en: '' } }, negativeRules: [], portfolioSheets: [],
  };
  render(<DesignerHero personaId={profile.id} profile={profile} locale="zh-CN" />);
  expect(screen.getByRole('region', { name: '当前设计师' })).toHaveTextContent('自定义设计师');
  expect(screen.getByRole('img', { name: '自定义人物的人物形象' })).toHaveAttribute('src', '/custom-persona.png');
});
