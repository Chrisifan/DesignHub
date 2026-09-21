import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { ConversationDock, type ConversationDockAttachment } from './ConversationDock';

const attachment: ConversationDockAttachment = {
  name: 'reference.png',
  mimeType: 'image/png',
  bytes: new Uint8Array([1, 2, 3]),
  previewUrl: 'data:image/png;base64,AQID',
};

const makeProps = () => ({
  locale: 'zh-CN' as const,
  value: '设计一张海报',
  attachments: [] as ConversationDockAttachment[],
  readOnly: false,
  busy: false,
  conversationConnected: true,
  designer: null,
  textareaLabel: '设计需求',
  placeholder: '描述设计需求',
  submitLabel: '发送并创建项目',
  onValueChange: vi.fn(),
  onAttachmentsChange: vi.fn(),
  onSubmit: vi.fn(),
  notify: vi.fn(),
});

it('renders expanded and compact variants from the same dock', () => {
  const props = makeProps();
  const { rerender } = render(<ConversationDock {...props} variant="expanded" />);
  const expanded = screen.getByRole('form', { name: 'AI 操作坞' });
  expect(expanded).toHaveClass('conversation-dock--expanded');
  expect(within(expanded).queryByRole('button', { name: '模型任务' })).toBeNull();
  expect(within(expanded).getByText('对话模型已连接')).toBeVisible();

  rerender(
    <ConversationDock
      {...props}
      variant="compact"
      onOpenTasks={vi.fn()}
      onOpenHistory={vi.fn()}
      onGenerate={vi.fn()}
      showGenerate
    />,
  );
  const compact = screen.getByRole('form', { name: 'AI 操作坞' });
  expect(compact).toHaveClass('conversation-dock--compact');
  expect(within(compact).getByRole('button', { name: '模型任务' })).toBeVisible();
  expect(within(compact).getByRole('button', { name: '版本历史' })).toBeVisible();
  expect(within(compact).getByRole('button', { name: '生成' })).toBeVisible();
  expect(within(compact).queryByText('对话模型已连接')).toBeNull();
});

it('uses a vertical up arrow for the expanded send control', () => {
  const props = makeProps();
  render(<ConversationDock {...props} variant="expanded" />);

  const submit = screen.getByRole('button', { name: '发送并创建项目' });
  expect(submit.querySelector('.ui-icon')).toHaveAttribute('style', expect.stringContaining('arrow-up.svg'));
  expect(submit.querySelector('.ui-icon')).not.toHaveAttribute('style', expect.stringContaining('arrow-up-right.svg'));
});

it('reads pasted images into controlled attachments', async () => {
  const props = makeProps();
  const file = new File([new Uint8Array([1, 2, 3])], 'reference.png', { type: 'image/png' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([1, 2, 3]).buffer });
  render(<ConversationDock {...props} variant="expanded" />);

  fireEvent.paste(screen.getByRole('textbox', { name: '设计需求' }), {
    clipboardData: { files: [file] },
  });

  await waitFor(() => expect(props.onAttachmentsChange).toHaveBeenCalledWith([
    expect.objectContaining({
      name: 'reference.png',
      mimeType: 'image/png',
      bytes: expect.any(Uint8Array),
      previewUrl: 'data:image/png;base64,AQID',
    }),
  ]));
});

it('previews and removes a controlled attachment', () => {
  const props = makeProps();
  render(<ConversationDock {...props} variant="expanded" attachments={[attachment]} />);

  fireEvent.click(screen.getByRole('button', { name: '预览 reference.png' }));
  expect(screen.getByRole('dialog', { name: 'reference.png' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  fireEvent.click(screen.getByRole('button', { name: '删除 reference.png' }));
  expect(props.onAttachmentsChange).toHaveBeenLastCalledWith([]);
});

it('shows no-designer state without a candidate reference count', () => {
  const props = makeProps();
  render(
    <ConversationDock
      {...props}
      variant="compact"
      referencedAssetCount={2}
      onOpenTasks={vi.fn()}
      onOpenHistory={vi.fn()}
    />,
  );

  expect(screen.getByText('未设置设计师')).toBeVisible();
  expect(screen.queryByLabelText('候选参考图')).not.toBeInTheDocument();
});

it('rejects invalid and oversized files without changing attachments', async () => {
  const props = makeProps();
  const textFile = new File(['text'], 'notes.txt', { type: 'text/plain' });
  const largeImage = new File(['image'], 'large.png', { type: 'image/png' });
  Object.defineProperty(largeImage, 'size', { value: 8 * 1024 * 1024 + 1 });
  render(<ConversationDock {...props} variant="expanded" />);

  fireEvent.change(screen.getByLabelText('选择图片文件'), { target: { files: [textFile, largeImage] } });

  await waitFor(() => expect(props.notify).toHaveBeenCalledTimes(2));
  expect(props.notify).toHaveBeenCalledWith('只能添加图片文件。');
  expect(props.notify).toHaveBeenCalledWith('图片不能超过 8 MiB。');
  expect(props.onAttachmentsChange).not.toHaveBeenCalled();
});
