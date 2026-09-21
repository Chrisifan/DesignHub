import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { HomeConversationComposer } from './HomeConversationComposer';

it('submits trimmed text once and clears only after success', async () => {
  const onSubmit = vi.fn(async () => true);
  render(<HomeConversationComposer locale="zh-CN" readOnly={false} conversationConnected designer={null} onSubmit={onSubmit} notify={vi.fn()} />);
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '  设计一张海报  ' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ message: '设计一张海报', attachments: [], generationRatio: '3:4' }));
  expect(screen.getByRole('textbox', { name: '设计需求' })).toHaveValue('');
});

it('retains the draft when project creation fails', async () => {
  const onSubmit = vi.fn(async () => false);
  render(<HomeConversationComposer locale="zh-CN" readOnly={false} conversationConnected designer={null} onSubmit={onSubmit} notify={vi.fn()} />);
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '保留我' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(screen.getByRole('textbox', { name: '设计需求' })).toHaveValue('保留我');
});

it('keeps the disconnected submit actionable so it can explain the missing model', () => {
  const notify = vi.fn();
  const onSubmit = vi.fn(async () => true);
  render(<HomeConversationComposer locale="zh-CN" readOnly={false} conversationConnected={false} designer={null} onSubmit={onSubmit} notify={notify} />);
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '设计海报' } });
  const submit = screen.getByRole('button', { name: '发送并创建项目' });
  expect(submit).not.toBeDisabled();
  fireEvent.click(submit);
  expect(notify).toHaveBeenCalledWith('请先连接对话模型。');
  expect(onSubmit).not.toHaveBeenCalled();
});

it('reads an image attachment, submits bytes, and clears its preview after success', async () => {
  const onSubmit = vi.fn(async () => true);
  const file = new File([new Uint8Array([1, 2, 3])], 'reference.png', { type: 'image/png' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([1, 2, 3]).buffer });
  render(<HomeConversationComposer locale="zh-CN" readOnly={false} conversationConnected designer={null} onSubmit={onSubmit} notify={vi.fn()} />);

  fireEvent.change(screen.getByLabelText('选择图片文件'), { target: { files: [file] } });
  await screen.findByRole('button', { name: '预览 reference.png' });
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '参考图片设计' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
    message: '参考图片设计',
    attachments: [expect.objectContaining({ name: 'reference.png', mimeType: 'image/png', bytes: expect.any(Uint8Array) })],
    generationRatio: '3:4',
  }));
  expect(screen.queryByRole('button', { name: '预览 reference.png' })).toBeNull();
});

it('uses the expanded shared dock without prompt suggestions', () => {
  render(<HomeConversationComposer locale="zh-CN" readOnly={false} conversationConnected designer={null} onSubmit={vi.fn(async () => true)} notify={vi.fn()} />);

  expect(screen.getByRole('form', { name: 'AI 操作坞' })).toHaveClass('conversation-dock--expanded');
  expect(screen.queryByLabelText('提示词建议')).toBeNull();
  expect(screen.queryByRole('button', { name: '模型任务' })).toBeNull();
  expect(screen.getByText('未设置设计师')).toBeVisible();
});

it('submits the selected generation ratio for the new project', async () => {
  const onSubmit = vi.fn(async () => true);
  render(<HomeConversationComposer locale="zh-CN" readOnly={false} conversationConnected designer={null} onSubmit={onSubmit} notify={vi.fn()} />);

  fireEvent.change(screen.getByRole('combobox', { name: '设计稿比例' }), { target: { value: '16:9' } });
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '设计横版主视觉' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ message: '设计横版主视觉', attachments: [], generationRatio: '16:9' }));
});

it('keeps text and attachments when project creation fails', async () => {
  const onSubmit = vi.fn(async () => false);
  const file = new File([new Uint8Array([4, 5])], 'mood.png', { type: 'image/png' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([4, 5]).buffer });
  render(<HomeConversationComposer locale="zh-CN" readOnly={false} conversationConnected designer={null} onSubmit={onSubmit} notify={vi.fn()} />);

  fireEvent.change(screen.getByLabelText('选择图片文件'), { target: { files: [file] } });
  await screen.findByRole('button', { name: '预览 mood.png' });
  fireEvent.change(screen.getByRole('textbox', { name: '设计需求' }), { target: { value: '保留完整草稿' } });
  fireEvent.click(screen.getByRole('button', { name: '发送并创建项目' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(screen.getByRole('textbox', { name: '设计需求' })).toHaveValue('保留完整草稿');
  expect(screen.getByRole('button', { name: '预览 mood.png' })).toBeVisible();
});
