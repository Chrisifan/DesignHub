import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { AnalysisPanel } from '../../src/app/studio/AnalysisPanel';

const workbenchStyle = document.createElement('style');

beforeEach(() => {
  workbenchStyle.textContent = readFileSync('src/app/studio/workbench.css', 'utf8');
  document.head.append(workbenchStyle);
});

afterEach(() => workbenchStyle.remove());

it('keeps the two analysis header actions compact', () => {
  render(createElement(AnalysisPanel, {
    locale: 'zh-CN',
    message: '生成春季主视觉',
    attachments: [],
    task: {
      id: 'analysis-1',
      requestId: 'request-1',
      state: 'running',
      cancelRequested: false,
      attempt: 1,
      capability: 'conversation',
      progressText: '分析内容',
    },
    canGenerate: false,
    onGenerate: vi.fn(),
    onCopyRequest: vi.fn(),
  }));

  const header = document.querySelector('.workbench-analysis-panel__header');
  expect(header).not.toBeNull();
  expect(window.getComputedStyle(header as HTMLElement).gap).toBe('4px');

  const actions = within(header as HTMLElement).getAllByRole('button');
  expect(actions).toHaveLength(2);
  actions.forEach((action) => {
    expect(window.getComputedStyle(action).width).toBe('22px');
    expect(window.getComputedStyle(action).height).toBe('22px');
    expect(window.getComputedStyle(action.querySelector('.ui-icon') as HTMLElement).width).toBe('12px');
  });
});

it('does not animate the dots in the collapsed panel', () => {
  render(createElement(AnalysisPanel, {
    locale: 'zh-CN',
    message: '生成春季主视觉',
    attachments: [],
    canGenerate: false,
    collapsed: true,
    onGenerate: vi.fn(),
    onExpand: vi.fn(),
  }));

  const dots = within(screen.getByRole('button', { name: '展开本轮分析' })).getByTestId('collapsed-analysis-dots');
  Array.from(dots.children).forEach((dot) => {
    expect(window.getComputedStyle(dot).animationName).toBe('none');
  });
});
