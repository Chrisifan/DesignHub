import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { App } from './App';

beforeEach(() => {
  localStorage.clear();
});
const enter = () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '浏览示例' }));
};

it('lets an offline user navigate the example workspace without a connection or disk save claim', () => {
  enter();
  const navigation = screen.getByRole('navigation', { name: '主导航' });
  fireEvent.click(within(navigation).getByRole('button', { name: '设计师' }));
  expect(screen.getByRole('heading', { name: '设计师' })).toBeInTheDocument();
  fireEvent.click(within(navigation).getByRole('button', { name: '模型连接' }));
  expect(screen.getByRole('heading', { name: '模型连接' })).toBeInTheDocument();
  expect(screen.getByText('尚未连接模型')).toBeInTheDocument();
  expect(screen.queryByText('已保存到本地')).not.toBeInTheDocument();
});

it('preserves project search while visiting another destination and offers an empty-result reset', () => {
  enter();
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索项目' }), {
    target: { value: '不存在的项目' },
  });
  expect(screen.getByText('没有匹配的项目')).toBeInTheDocument();
  const navigation = screen.getByRole('navigation', { name: '主导航' });
  fireEvent.click(within(navigation).getByRole('button', { name: '素材库' }));
  fireEvent.click(within(navigation).getByRole('button', { name: '项目库' }));
  expect(screen.getByRole('searchbox', { name: '搜索项目' })).toHaveValue(
    '不存在的项目',
  );
  fireEvent.click(screen.getByRole('button', { name: '清除搜索' }));
  expect(screen.getByRole('button', { name: /春间市集/ })).toBeInTheDocument();
});

it('opens a project document and returns to that project', () => {
  enter();
  fireEvent.click(screen.getByRole('button', { name: /春间市集/ }));
  fireEvent.click(screen.getByRole('button', { name: '打开主海报' }));
  expect(screen.getByRole('region', { name: '设计画布' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '返回项目' }));
  expect(screen.getByRole('heading', { name: '春间市集' })).toBeInTheDocument();
});

it('creates only a labelled preview draft and keeps project input when dismissing the form', () => {
  enter();
  fireEvent.click(screen.getAllByRole('button', { name: '新建项目' })[0]!);
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), {
    target: { value: '我的测试项目' },
  });
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  fireEvent.click(screen.getAllByRole('button', { name: '新建项目' })[0]!);
  expect(screen.getByRole('textbox', { name: '项目名称' })).toHaveValue(
    '我的测试项目',
  );
  fireEvent.click(screen.getByRole('button', { name: '创建预览' }));
  expect(
    screen.getByRole('heading', { name: '我的测试项目' }),
  ).toBeInTheDocument();
  expect(screen.getByText('预览草稿')).toBeInTheDocument();
  expect(screen.queryByText('已保存到本地')).not.toBeInTheDocument();
});

it('keeps the draft when language and theme change and remembers UI preferences', () => {
  enter();
  fireEvent.click(screen.getAllByRole('button', { name: '新建项目' })[0]!);
  fireEvent.change(screen.getByRole('textbox', { name: '项目名称' }), {
    target: { value: '保留输入' },
  });
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  fireEvent.click(screen.getByRole('button', { name: '切换主题' }));
  fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'New project' })[0]!);
  expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveValue(
    '保留输入',
  );
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(localStorage.getItem('designhub.ui.locale')).toBe('en');
  expect(localStorage.getItem('designhub.ui.theme')).toBe('dark');
});

it('preserves the originating project when opening delivery from a document', () => {
  enter();
  fireEvent.click(screen.getByRole('button', { name: '日常之物' }));
  fireEvent.click(screen.getByRole('button', { name: '打开主海报' }));
  fireEvent.click(screen.getByRole('button', { name: '导出' }));
  expect(screen.getByRole('heading', { name: '导出交付' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '日常之物' })).toBeInTheDocument();
});
