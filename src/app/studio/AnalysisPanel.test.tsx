import { act, render, screen } from '@testing-library/react';
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
