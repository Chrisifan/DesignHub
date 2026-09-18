import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { PersonaInspector } from './PersonaInspector';
import { getPersona } from '../../../tests/fixtures/personas';

it('uses the shared dossier and retains the curated portfolio', () => {
  render(<PersonaInspector locale="zh-CN" profile={getPersona('paper-type')!} showActions={false} />);

  const dossier = screen.getByRole('region', { name: '纸感排版设计师档案' });
  expect(within(dossier).getByRole('region', { name: '核心指标' })).toBeInTheDocument();
  expect(within(dossier).getByRole('region', { name: 'Style DNA' })).toBeInTheDocument();
  expect(within(dossier).getByRole('region', { name: '否定规则' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: '精选作品' })).toHaveTextContent('春生特刊');
  expect(screen.queryByText('项目引用')).not.toBeInTheDocument();
  expect(screen.queryByText('作品样张')).not.toBeInTheDocument();
  expect(screen.queryByText('会话默认')).not.toBeInTheDocument();
  expect(screen.queryByText('ARCHETYPE')).not.toBeInTheDocument();
});

it('shows an empty curated-portfolio state', () => {
  const profile = getPersona('paper-type')!;
  render(<PersonaInspector locale="en" profile={{ ...profile, portfolioSheets: [] }} showActions={false} />);

  expect(screen.getByRole('region', { name: 'Curated portfolio' })).toHaveTextContent('No curated work yet');
});

it('only emits session actions', () => {
  const onSetDefault = vi.fn();
  const onUseForNewDesign = vi.fn();
  render(
    <PersonaInspector
      locale="zh-CN"
      profile={getPersona('paper-type')!}
      isSessionDefault={false}
      onSetDefault={onSetDefault}
      onUseForNewDesign={onUseForNewDesign}
    />,
  );
  expect(screen.queryByText(/GPU|云端任务|完成率/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '设默认' }));
  fireEvent.click(screen.getByRole('button', { name: '用于新建' }));
  expect(onSetDefault).toHaveBeenCalledWith('paper-type');
  expect(onUseForNewDesign).toHaveBeenCalledWith('paper-type');
});
