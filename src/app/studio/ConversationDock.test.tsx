// eslint-disable-next-line no-restricted-imports
import { readFileSync } from 'node:fs';
// eslint-disable-next-line no-restricted-imports
import { resolve } from 'node:path';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { personaProfiles } from '../../../tests/fixtures/personas';
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
  expect(within(expanded).queryByText('最近连接测试通过')).toBeNull();
  expect(within(expanded).getByRole('img', { name: '最近连接测试通过' })).toBeInTheDocument();
  expect(expanded.querySelector('.conversation-dock__status > span')).toHaveClass('is-connected');

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
  expect(within(compact).queryByText('最近连接测试通过')).toBeNull();
  expect(within(compact).getByRole('img', { name: '最近连接测试通过' })).toBeInTheDocument();
  expect(within(compact).queryByText('/')).toBeNull();

  rerender(
    <ConversationDock
      {...props}
      variant="compact"
      conversationConnected={false}
    />,
  );
  expect(within(compact).queryByText('对话模型未连接')).toBeNull();
  expect(within(compact).getByRole('img', { name: '对话模型未连接' })).toBeInTheDocument();
  expect(compact.querySelector('.conversation-dock__status > span')).not.toHaveClass('is-connected');
});

it('keeps busy progress text while hiding idle connection descriptions', () => {
  const props = makeProps();
  render(<ConversationDock {...props} variant="expanded" busy busyLabel="创建中" />);

  expect(screen.getByText('创建中')).toBeVisible();
  expect(screen.queryByText('最近连接测试通过')).toBeNull();
});

it('uses a vertical up arrow for the expanded send control', () => {
  const props = makeProps();
  render(<ConversationDock {...props} variant="expanded" />);

  const submit = screen.getByRole('button', { name: '发送并创建项目' });
  expect(submit.querySelector('.ui-icon')).toHaveAttribute('style', expect.stringContaining('arrow-up.svg'));
  expect(submit.querySelector('.ui-icon')).not.toHaveAttribute('style', expect.stringContaining('arrow-up-right.svg'));
});

it('uses the same send control class in expanded and compact docks', () => {
  const props = makeProps();
  const { rerender } = render(<ConversationDock {...props} variant="expanded" />);
  expect(screen.getByRole('button', { name: '发送并创建项目' })).toHaveClass('conversation-dock__send-control');

  rerender(
    <ConversationDock
      {...props}
      variant="compact"
      onOpenTasks={vi.fn()}
      onOpenHistory={vi.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: '发送并创建项目' })).toHaveClass('conversation-dock__send-control');
});

it('marks the dock while its input is focused', () => {
  const props = makeProps();
  render(<ConversationDock {...props} variant="expanded" />);
  const dock = screen.getByRole('form', { name: 'AI 操作坞' });
  const input = screen.getByRole('textbox', { name: '设计需求' });

  fireEvent.focus(input);
  expect(dock).toHaveClass('conversation-dock--input-focused');
  fireEvent.blur(input);
  expect(dock).not.toHaveClass('conversation-dock--input-focused');
});

it('animates the focused border gradient without rotating the dock geometry', () => {
  const stylesheet = readFileSync(resolve(process.cwd(), 'src/app/studio/conversation-dock.css'), 'utf8');

  expect(stylesheet).toContain('@property --conversation-dock-border-angle');
  expect(stylesheet).toContain('from var(--conversation-dock-border-angle)');
  expect(stylesheet).toContain('color-mix(in srgb, white 92%, var(--primary)) 0%');
  expect(stylesheet).toContain('color-mix(in srgb, white 42%, var(--secondary)) 8%');
  expect(stylesheet).toContain('color-mix(in srgb, var(--tertiary) 35%, transparent) 22%');
  expect(stylesheet).toContain('2.6s cubic-bezier(0.33, 1, 0.68, 1) infinite');
  expect(stylesheet).toContain('--conversation-dock-border-angle: 360deg');
  expect(stylesheet).not.toContain('transform: rotate(360deg)');
  expect(stylesheet).toContain('@keyframes conversation-dock-status-breathe');
  expect(stylesheet).toContain('animation: conversation-dock-status-breathe');
  expect(stylesheet).toContain('.conversation-dock__indicator { animation: none; }');
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

it('reads dragged images into controlled attachments and rejects other files', async () => {
  const props = makeProps();
  const image = new File([new Uint8Array([4, 5, 6])], 'dragged.webp', { type: 'image/webp' });
  Object.defineProperty(image, 'arrayBuffer', { value: async () => new Uint8Array([4, 5, 6]).buffer });
  const text = new File(['text'], 'notes.txt', { type: 'text/plain' });
  render(<ConversationDock {...props} variant="expanded" />);

  fireEvent.drop(screen.getByRole('form', { name: 'AI 操作坞' }), {
    dataTransfer: { files: [image, text] },
  });

  await waitFor(() => expect(props.onAttachmentsChange).toHaveBeenCalledWith([
    expect.objectContaining({ name: 'dragged.webp', mimeType: 'image/webp' }),
  ]));
  expect(props.notify).toHaveBeenCalledWith('只能添加图片文件。');
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

it('uses a custom ratio menu without visible field copy', () => {
  const props = makeProps();
  const onGenerationRatioChange = vi.fn();
  render(
    <ConversationDock
      {...props}
      variant="compact"
      generationRatio="3:4"
      onGenerationRatioChange={onGenerationRatioChange}
    />,
  );

  const ratio = screen.getByRole('combobox', { name: '设计稿比例' });
  expect(ratio.tagName).toBe('INPUT');
  expect(ratio).toHaveValue('3:4');
  expect(screen.queryByText('设计稿比例')).not.toBeInTheDocument();

  fireEvent.click(ratio);
  expect(screen.getByRole('option', { name: '原图' })).toBeVisible();
  expect(screen.getByRole('option', { name: '3 : 4' })).toBeVisible();
  expect(screen.getByRole('option', { name: '1 : 1' })).toBeVisible();
  fireEvent.click(screen.getByRole('option', { name: '1 : 1' }));
  expect(onGenerationRatioChange).toHaveBeenCalledWith('1:1');
});

it('defaults the generation ratio menu to the original image', () => {
  render(<ConversationDock {...makeProps()} variant="compact" />);

  const ratio = screen.getByRole('combobox', { name: '设计稿比例' });
  expect(ratio).toHaveValue('original');
  expect(ratio).toHaveAttribute('aria-valuetext', '原图');
});

it('shows only the selected designer avatar until its custom menu opens', () => {
  const props = makeProps();
  const designer = personaProfiles[0]!;
  const onDesignerChange = vi.fn();
  render(
    <ConversationDock
      {...props}
      variant="compact"
      designer={designer}
      designerOptions={personaProfiles}
      onDesignerChange={onDesignerChange}
    />,
  );

  const trigger = screen.getByRole('combobox', { name: '设计师' });
  const value = trigger.parentElement?.querySelector('.ui-select__value');
  expect(value?.querySelector('img')).toBeInTheDocument();
  expect(value).not.toHaveTextContent('纸感排版');

  fireEvent.click(trigger);
  const option = screen.getByRole('option', { name: /清晰商业/u });
  expect(option.querySelector('img')).toBeInTheDocument();
  expect(option).toHaveTextContent('清晰商业');
  fireEvent.click(option);
  expect(onDesignerChange).toHaveBeenCalledWith('clear-commerce');
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
