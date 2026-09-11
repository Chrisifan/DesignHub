import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { DesignerLibrary } from './DesignerLibrary';

it('filters personas and exposes structured style guidance in the inspector', () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} />);
  expect(screen.getByText('Style DNA')).toBeInTheDocument();
  expect(screen.getByText('禁用规则')).toBeInTheDocument();
  expect(screen.getByText('精选作品')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索档案' }), {
    target: { value: '商品' },
  });
  expect(screen.getByRole('button', { name: /清晰商业/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /纸感排版/ })).not.toBeInTheDocument();
});

it('supports create, derive, default and use-for-new actions in session state', () => {
  const notify = vi.fn();
  const onUseForNew = vi.fn();
  render(<DesignerLibrary locale="zh-CN" notify={notify} onUseForNew={onUseForNew} />);
  fireEvent.click(screen.getByRole('button', { name: /清晰商业/ }));
  fireEvent.click(screen.getByRole('button', { name: '设默认' }));
  expect(screen.getByRole('button', { name: '当前默认' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '用于新建' }));
  expect(onUseForNew).toHaveBeenCalledWith('clear-commerce');
  fireEvent.click(screen.getByRole('button', { name: '派生' }));
  expect(screen.getByRole('button', { name: /清晰商业 派生版/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  expect(notify).toHaveBeenCalledWith('档案已移除');
  fireEvent.click(screen.getByRole('button', { name: '创建' }));
  const dialog = screen.getByRole('dialog', { name: '创建设计师' });
  fireEvent.change(within(dialog).getByRole('textbox', { name: '名称' }), {
    target: { value: '夜间叙事' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: '保留' }));
  expect(screen.getByRole('button', { name: /夜间叙事/ })).toBeInTheDocument();
});

it('requires portfolio rights confirmation before entering candidate review', () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '创建' }));
  fireEvent.click(screen.getByRole('button', { name: '作品集' }));
  fireEvent.click(screen.getByRole('button', { name: '生成' }));
  expect(screen.getByText('请先确认拥有分析这些来源的权利。')).toBeInTheDocument();
});

it('presents three example candidates and marks preview publish as session-only', () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '创建' }));
  fireEvent.change(screen.getByRole('textbox', { name: '风格描述' }), { target: { value: '纸张、城市与留白' } });
  fireEvent.click(screen.getByRole('button', { name: '生成' }));
  const candidates = screen.getAllByRole('button', { name: /候选/ });
  expect(candidates).toHaveLength(3);
  fireEvent.click(candidates[1]!);
  expect(candidates[1]).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: '发布预览' }));
  expect(screen.getByText('已在本次示例会话中发布，不会写入磁盘。')).toBeInTheDocument();
});
