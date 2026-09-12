import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';

import { NewDesignPage } from './NewDesignPage';
import type { NewDesignDraft } from './types';
import type { PersonaProfile } from './personas';

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
    />
  );
};

it('keeps manual and conversation input in one session draft while the hero follows the selected designer', () => {
  render(<NewDesignHarness />);
  fireEvent.click(screen.getByRole('button', { name: '通过对话' }));
  fireEvent.change(screen.getByRole('textbox', { name: '创作想法' }), {
    target: { value: '春季市集宣传图' },
  });
  fireEvent.click(screen.getByRole('button', { name: '清晰商业' }));
  expect(screen.getByLabelText('新建设计的当前设计师')).toHaveTextContent(
    '清晰商业',
  );
  expect(
    screen.getByText('模型未连接，想法已保留在示例草稿中。'),
  ).toBeInTheDocument();
});

it('shows a completed conversation brief for explicit review before project creation', () => {
  const onConfirm = vi.fn();
  render(<NewDesignPage locale="zh-CN" draft={{ ...initialDraft, mode: 'conversation', name: '春间市集' }} onDraftChange={vi.fn()} onCreate={vi.fn()} onBack={vi.fn()} conversationResult={{ taskId: 'task-1', text: '一张自然、克制的春季市集海报。' }} onConfirmConversation={onConfirm} />);
  expect(screen.getByText('模型已整理简报')).toBeInTheDocument();
  expect(screen.getByText('一张自然、克制的春季市集海报。')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '确认创建' }));
  expect(onConfirm).toHaveBeenCalledWith('task-1');
});

it('uses a persisted custom persona in the new-design hero and selector', () => {
  const custom: PersonaProfile = {
    id: 'custom-new', name: { zh: '新建人物', en: 'New persona' }, signature: { zh: '署名', en: 'Signature' }, summary: { zh: '摘要', en: 'Summary' }, principle: { zh: '原则', en: 'Principle' }, personaCode: 'NEW', version: 'v1.0', status: 'published', artworkUrl: '/new-persona.png', artworkAlt: { zh: '新建人物', en: 'New persona' }, tags: [], referenceCount: 0, styleDna: { palette: [], typography: { zh: '', en: '' }, composition: { zh: '', en: '' }, texture: { zh: '', en: '' } }, negativeRules: [], portfolioSheets: [],
  };
  render(<NewDesignPage locale="zh-CN" draft={{ ...initialDraft, personaId: custom.id }} profiles={[custom]} onDraftChange={vi.fn()} onCreate={vi.fn()} onBack={vi.fn()} />);
  expect(screen.getByLabelText('新建设计的当前设计师')).toHaveTextContent('新建人物');
  expect(screen.getByRole('img', { name: '新建人物的人物形象' })).toHaveAttribute('src', '/new-persona.png');
});
