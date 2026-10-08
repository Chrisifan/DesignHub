import { fireEvent, render, screen } from '@testing-library/react';
import { useState, type FormEvent } from 'react';
import { expect, it, vi } from 'vitest';

import { NewProjectForm } from './NewDesignPage';
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

const NewProjectHarness = () => {
  const [draft, setDraft] = useState(initialDraft);
  return (
    <NewProjectForm
      locale="zh-CN"
      formId="new-project-form"
      draft={draft}
      onDraftChange={setDraft}
      onCreate={vi.fn()}
      profiles={personaProfiles}
    />
  );
};

it('renders only the project fields required by the drawer', () => {
  render(<NewProjectHarness />);

  const cover = screen.getByRole('region', { name: '项目封面' });
  const projectName = screen.getByRole('textbox', { name: '项目名称' });
  expect(cover).toContainElement(screen.getByRole('img', { name: '项目封面' }));
  expect(cover.compareDocumentPosition(projectName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole('form', { name: '新建项目表单' })).toHaveAttribute('id', 'new-project-form');
  expect(projectName).toHaveAttribute('data-drawer-initial-focus');
  expect(screen.queryByRole('button', { name: '通过对话' })).not.toBeInTheDocument();
  expect(screen.getByRole('group', { name: '创建方式' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '设计目标' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: '选择设计师' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: '文档尺寸' })).toBeInTheDocument();
  expect(screen.queryByText('模型已整理简报')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('新建设计的当前设计师')).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /设计师档案/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /创建项目|创建预览/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '设计目标' }), {
    target: { value: '春季市集宣传图' },
  });
  fireEvent.click(screen.getByRole('button', { name: '清晰商业' }));
  expect(screen.getByRole('button', { name: '清晰商业' })).toHaveAttribute('aria-pressed', 'true');
});

it('uses a persisted custom persona in the drawer selector', () => {
  const custom: PersonaProfile = {
    id: 'custom-new', name: { zh: '新建人物', en: 'New persona' }, signature: { zh: '署名', en: 'Signature' }, summary: { zh: '摘要', en: 'Summary' }, principle: { zh: '原则', en: 'Principle' }, personaCode: 'NEW', version: 'v1.0', status: 'published', artworkUrl: '/new-persona.png', artworkAlt: { zh: '新建人物', en: 'New persona' }, tags: [], referenceCount: 0, styleDna: { palette: [], typography: { zh: '', en: '' }, composition: { zh: '', en: '' }, texture: { zh: '', en: '' } }, negativeRules: [], portfolioSheets: [],
  };
  render(<NewProjectForm locale="zh-CN" formId="new-project-form" draft={{ ...initialDraft, personaId: custom.id }} profiles={[custom]} onDraftChange={vi.fn()} onCreate={vi.fn()} />);
  const option = screen.getByRole('button', { name: '新建人物' });
  expect(option).toHaveAttribute('aria-pressed', 'true');
  expect(option.querySelector('img')).toHaveAttribute('src', '/new-persona.png');
});

it('allows creating a project without selecting a designer', () => {
  const onDraftChange = vi.fn();
  render(<NewProjectForm locale="zh-CN" formId="new-project-form" draft={initialDraft} profiles={personaProfiles} onDraftChange={onDraftChange} onCreate={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: '不设置设计师' }));

  expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ personaId: '' }));
});

it('submits through the form id used by the drawer footer', () => {
  const onCreate = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
  render(<NewProjectForm locale="zh-CN" formId="new-project-form" draft={{ ...initialDraft, name: '新项目' }} profiles={personaProfiles} onDraftChange={vi.fn()} onCreate={onCreate} persisted />);

  fireEvent.submit(screen.getByRole('form', { name: '新建项目表单' }));

  expect(onCreate).toHaveBeenCalledOnce();
});

it('offers standard, composition and mockup creation with role and template controls', () => {
  render(<NewProjectHarness />);
  expect(screen.getByRole('group', { name: '创建方式' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: '智能构图' }));
  expect(screen.getByLabelText('核心素材')).toBeInTheDocument();
  expect(screen.getByLabelText('可选素材')).toBeInTheDocument();
  expect(screen.getByLabelText('参考素材')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: '样机' }));
  expect(screen.getByLabelText('源设计图')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('combobox', { name: '样机模板' }));
  expect(screen.getByRole('option', { name: '手机屏幕' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '海报画框' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '包装袋' })).toBeInTheDocument();
});
