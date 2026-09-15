import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { PersonaInspector } from './PersonaInspector';
import { getPersona } from '../../../tests/fixtures/personas';

it('shows creative identity guidance and only emits session actions', () => {
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
  expect(screen.getByText('创意代号')).toBeInTheDocument();
  expect(screen.getByLabelText('风格 DNA')).toHaveTextContent('排版');
  expect(screen.getByLabelText('禁用规则')).toHaveTextContent('霓虹');
  expect(screen.getByLabelText('精选作品')).toHaveTextContent('春生特刊');
  expect(screen.queryByText(/GPU|云端任务|完成率/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '设默认' }));
  fireEvent.click(screen.getByRole('button', { name: '用于新建' }));
  expect(onSetDefault).toHaveBeenCalledWith('paper-type');
  expect(onUseForNewDesign).toHaveBeenCalledWith('paper-type');
});
