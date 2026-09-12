import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { DesignerLibrary } from './DesignerLibrary';

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
};

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

it('hydrates and persists designer state through the desktop workspace bridge', async () => {
  const loadDesignerState = vi.fn(async () => ({ profiles: [], defaultId: 'builtin-v1', drafts: { newDraft: { name: '工作区草稿' } } }));
  const saveDesignerState = vi.fn(async () => true);
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDesignerState, saveDesignerState };
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} workspaceId="workspace-1" />);
  await waitFor(() => expect(loadDesignerState).toHaveBeenCalledWith('workspace-1'));
  fireEvent.click(screen.getByRole('button', { name: '创建' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: '名称' })).toHaveValue('工作区草稿'));
  fireEvent.change(screen.getByRole('textbox', { name: '名称' }), { target: { value: '已保存草稿' } });
  await waitFor(() => expect(saveDesignerState).toHaveBeenCalledWith('workspace-1', expect.objectContaining({ drafts: expect.objectContaining({ newDraft: expect.objectContaining({ name: '已保存草稿' }) }) })));
});

it('keeps builtin profiles available when persisted state has no profiles', async () => {
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDesignerState: vi.fn(async () => ({ profiles: [], defaultId: 'missing' })), saveDesignerState: vi.fn(async () => true) };
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} workspaceId="workspace-empty" />);
  await waitFor(() => expect(screen.getByRole('button', { name: /纸感排版/ })).toBeInTheDocument());
  expect(screen.getByRole('button', { name: '当前默认' })).toBeInTheDocument();
});

it('disables mutation actions in a read-only workspace', async () => {
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDesignerState: vi.fn(async () => null), saveDesignerState: vi.fn(async () => true) };
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} workspaceId="workspace-readonly" readOnly />);
  await waitFor(() => expect(screen.getByRole('button', { name: /纸感排版/ })).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: '创建' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '编辑' })).toBeDisabled();
});

it('does not allow a draft profile to become the session default', () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '创建' }));
  fireEvent.change(screen.getByRole('textbox', { name: '名称' }), { target: { value: '草稿设计师' } });
  fireEvent.click(screen.getByRole('button', { name: '保留' }));
  expect(screen.getByRole('button', { name: '设默认' })).toBeDisabled();
});

it('restores a referenced archived profile without changing its built-in or published status', () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /清晰商业/ }));
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  expect(screen.getByRole('button', { name: '恢复' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '恢复' }));
  expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument();
});

it('does not invoke a later save until the previous save settles', async () => {
  const firstSave = createDeferred<boolean>();
  const loadDesignerState = vi.fn(async () => ({ profiles: [], defaultId: 'builtin-v1' }));
  const saveDesignerState = vi.fn(async () => {
    if (saveDesignerState.mock.calls.length === 1) return firstSave.promise;
    return true;
  });
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDesignerState, saveDesignerState };
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} workspaceId="workspace-queue" />);
  await waitFor(() => expect(saveDesignerState).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: '创建' }));
  fireEvent.change(screen.getByRole('textbox', { name: '名称' }), { target: { value: '队列测试' } });
  fireEvent.click(screen.getByRole('button', { name: '保留' }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(saveDesignerState).toHaveBeenCalledTimes(1);
  firstSave.resolve(true);
  await waitFor(() => expect(saveDesignerState.mock.calls.length).toBeGreaterThan(1));
});

it('disables using a designer for new work while loading has failed', async () => {
  const loadDesignerState = vi.fn(async () => { throw new Error('READ_FAILED'); });
  const onUseForNew = vi.fn();
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDesignerState, saveDesignerState: vi.fn(async () => true) };
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} workspaceId="workspace-failed" onUseForNew={onUseForNew} />);
  await waitFor(() => expect(screen.getByText('设计师档案读取失败。')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: '用于新建' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
});
