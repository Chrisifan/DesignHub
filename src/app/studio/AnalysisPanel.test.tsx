import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { AnalysisPanel } from './AnalysisPanel';

const task = (progressText: string) => ({
  id: 'analysis-1',
  requestId: 'request-1',
  state: 'running' as const,
  cancelRequested: false,
  attempt: 1,
  capability: 'conversation' as const,
  progressText,
});

const attachment = {
  assetId: 'asset-1',
  name: 'reference.png',
  mimeType: 'image/png',
  bytes: new Uint8Array([1, 2, 3]),
  previewUrl: 'data:image/png;base64,AQID',
};

const renderPanel = (progressText: string) => render(
  <AnalysisPanel
    locale="zh-CN"
    message="生成一个春季市集主视觉"
    attachments={[]}
    task={task(progressText)}
    canGenerate={false}
    onGenerate={vi.fn()}
  />,
);

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

it('renders streamed markdown as structured analysis content', () => {
  renderPanel('## 设计方向\n\n使用 **暖色** 层次。\n\n- 保留留白\n- 强化标题\n\n---\n\n#### 结构化建议\n\n```text\n活动时间\n9月15日—9月17日 17:00\n```');

  expect(screen.getByRole('heading', { level: 2, name: '设计方向' })).toBeInTheDocument();
  expect(screen.getByText('暖色')).toBeInTheDocument();
  expect(screen.getByText('暖色').tagName).toBe('STRONG');
  expect(screen.getByRole('list')).toBeInTheDocument();
  expect(screen.getByRole('list').querySelectorAll('li')).toHaveLength(2);
  expect(screen.getByRole('separator')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 4, name: '结构化建议' })).toBeInTheDocument();
  const code = document.querySelector('.workbench-analysis-panel__markdown pre code');
  expect(code).toBeInTheDocument();
  expect(code?.textContent).toBe('活动时间\n9月15日—9月17日 17:00');
  expect(screen.queryByText('## 设计方向')).not.toBeInTheDocument();
});

it('keeps the analysis view following the latest streamed content', () => {
  const { rerender } = renderPanel('第一段');
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

  vi.mocked(HTMLElement.prototype.scrollIntoView).mockClear();
  rerender(
    <AnalysisPanel
      locale="zh-CN"
      message="生成一个春季市集主视觉"
      attachments={[]}
      task={task('第一段\n\n第二段')}
      canGenerate={false}
      onGenerate={vi.fn()}
    />,
  );

  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
});

it('smooths a newly received stream chunk instead of replacing the whole analysis at once', () => {
  vi.useFakeTimers();
  const { rerender } = renderPanel('第一段');
  rerender(
    <AnalysisPanel
      locale="zh-CN"
      message="生成一个春季市集主视觉"
      attachments={[]}
      task={task('第一段\n\n第二段完整内容')}
      canGenerate={false}
      onGenerate={vi.fn()}
    />,
  );

  expect(screen.getByText('第一段')).toBeInTheDocument();
  expect(screen.queryByText('第二段完整内容')).not.toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(500); });
  expect(screen.getByText('第二段完整内容')).toBeInTheDocument();
});

it('keeps the body as the independently scrolling analysis region', () => {
  renderPanel('一段很长的分析');
  const body = document.querySelector('.workbench-analysis-panel__body');
  expect(body).toBeInTheDocument();
  expect(body).toHaveAttribute('aria-live', 'polite');
});

it('uses the compact action treatment for generation', () => {
  renderPanel('分析完成');
  expect(screen.getByRole('button', { name: '生成' })).toHaveClass('workbench-analysis-panel__generate');
});

it('shows one request line until the user expands its text and images', () => {
  render(
    <AnalysisPanel
      locale="zh-CN"
      message={'第一行需求\n第二行补充'}
      attachments={[attachment]}
      task={task('分析内容')}
      canGenerate={false}
      onGenerate={vi.fn()}
      onCopyRequest={vi.fn()}
    />,
  );

  expect(screen.getByText('第一行需求 第二行补充')).toHaveClass('workbench-analysis-panel__request-line');
  expect(screen.queryByRole('img', { name: 'reference.png' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '展开本轮输入' }));

  expect(screen.getByTestId('analysis-request-details')).toHaveTextContent('第一行需求 第二行补充');
  expect(screen.getByRole('img', { name: 'reference.png' })).toBeVisible();
});

it('copies the current request payload and collapses the full panel', () => {
  const onCopyRequest = vi.fn();
  const onCollapse = vi.fn();
  render(
    <AnalysisPanel
      locale="zh-CN"
      message="生成春季主视觉"
      attachments={[attachment]}
      task={task('分析内容')}
      canGenerate={false}
      onGenerate={vi.fn()}
      onCopyRequest={onCopyRequest}
      onCollapse={onCollapse}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '复制到对话框' }));
  fireEvent.click(screen.getByRole('button', { name: '收起本轮分析' }));

  expect(onCopyRequest).toHaveBeenCalledWith({ message: '生成春季主视觉', attachments: [attachment] });
  expect(onCollapse).toHaveBeenCalledOnce();
});

it('renders only the animated dots and expand action while collapsed', () => {
  const onExpand = vi.fn();
  render(
    <AnalysisPanel
      locale="zh-CN"
      message="生成春季主视觉"
      attachments={[]}
      task={task('分析内容')}
      canGenerate={false}
      onGenerate={vi.fn()}
      collapsed
      onExpand={onExpand}
    />,
  );

  expect(screen.getByTestId('collapsed-analysis-dots').children).toHaveLength(3);
  expect(screen.queryByText('分析内容')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '展开本轮分析' }));
  expect(onExpand).toHaveBeenCalledOnce();
});
