import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';

import { NewDesignPage } from './NewDesignPage';
import type { NewDesignDraft } from './types';
import type { PersonaProfile } from './personas';
import { personaProfiles } from '../../../tests/fixtures/personas';

const initialDraft: NewDesignDraft = {
  name: '',
  goal: '',
  brief: '',
  personaId: 'paper-type',
  size: '1080 × 1440',
  mode: 'manual',
};

const NewDesignHarness = () => {
  const [draft, setDraft] = useState(initialDraft);
  return (
    <NewDesignPage
      locale="zh-CN"
      draft={draft}
      onDraftChange={setDraft}
      onCreate={vi.fn()}
      onBack={vi.fn()}
      profiles={personaProfiles}
    />
  );
};

it('shows only the manual project brief flow', () => {
  render(<NewDesignHarness />);
  expect(screen.queryByRole('button', { name: '通过对话' })).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: '创建方式' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '设计目标' })).toBeInTheDocument();
  expect(screen.queryByText('模型已整理简报')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '设计目标' }), {
    target: { value: '春季市集宣传图' },
  });
  fireEvent.click(screen.getByRole('button', { name: '清晰商业' }));
  expect(screen.getByLabelText('新建设计的当前设计师')).toHaveTextContent(
    '清晰商业',
  );
});

it('uses a persisted custom persona in the new-design hero and selector', () => {
  const custom: PersonaProfile = {
    id: 'custom-new', name: { zh: '新建人物', en: 'New persona' }, signature: { zh: '署名', en: 'Signature' }, summary: { zh: '摘要', en: 'Summary' }, principle: { zh: '原则', en: 'Principle' }, personaCode: 'NEW', version: 'v1.0', status: 'published', artworkUrl: '/new-persona.png', artworkAlt: { zh: '新建人物', en: 'New persona' }, tags: [], referenceCount: 0, styleDna: { palette: [], typography: { zh: '', en: '' }, composition: { zh: '', en: '' }, texture: { zh: '', en: '' } }, negativeRules: [], portfolioSheets: [],
  };
  render(<NewDesignPage locale="zh-CN" draft={{ ...initialDraft, personaId: custom.id }} profiles={[custom]} onDraftChange={vi.fn()} onCreate={vi.fn()} onBack={vi.fn()} />);
  expect(screen.getByLabelText('新建设计的当前设计师')).toHaveTextContent('新建人物');
  expect(screen.getByRole('img', { name: '新建人物的人物形象' })).toHaveAttribute('src', '/new-persona.png');
});
