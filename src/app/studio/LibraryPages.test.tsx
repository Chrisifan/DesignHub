import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';

import type { Locale } from '../i18n';
import { LibraryPages } from './LibraryPages';
import type { Project, Theme, View } from './types';

const Harness = ({
  initialView = 'designers',
  deliveryProject,
  workspaceId,
  projectId,
}: {
  initialView?: Exclude<View, 'projects'>;
  deliveryProject?: Project | null;
  workspaceId?: string;
  projectId?: string;
}) => {
  const [view, setView] = useState<View>(initialView);
  const [theme, setTheme] = useState<Theme>('system');
  const [locale, setLocale] = useState<Locale>('zh-CN');
  const [notice, setNotice] = useState('');
  return (
    <>
      <output aria-label="current-view">{view}</output>
      <output aria-label="current-theme">{theme}</output>
      <output aria-label="current-locale">{locale}</output>
      <output aria-label="notice">{notice}</output>
      {view === 'projects' ? (
        <p>projects destination</p>
      ) : (
        <LibraryPages
          view={view}
          locale={locale}
          theme={theme}
          notify={setNotice}
          navigate={setView}
          onThemeChange={setTheme}
          onLocaleChange={setLocale}
          deliveryProject={deliveryProject}
          workspaceId={workspaceId}
          projectId={projectId}
        />
      )}
    </>
  );
};

it('keeps an unfinished designer draft when its preview modal closes', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '创建' }));
  const dialog = screen.getByRole('dialog', { name: '创建设计师' });
  const name = within(dialog).getByRole('textbox', { name: '名称' });
  fireEvent.change(name, { target: { value: '留白编辑' } });
  expect(within(dialog).getByText('留白编辑')).toBeInTheDocument();
  fireEvent.click(within(dialog).getAllByRole('button', { name: '关闭' })[0]);
  fireEvent.click(screen.getByRole('button', { name: '创建' }));
  expect(
    within(screen.getByRole('dialog', { name: '创建设计师' })).getByRole(
      'textbox',
      { name: '名称' },
    ),
  ).toHaveValue('留白编辑');
});

it('keeps a profile edit draft when the same profile is reopened', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  fireEvent.change(
    within(screen.getByRole('dialog', { name: '编辑设计师' })).getByRole(
      'textbox',
      { name: '名称' },
    ),
    { target: { value: '纸感排版编辑版' } },
  );
  fireEvent.click(screen.getByRole('button', { name: '保留' }));
  fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  expect(
    within(screen.getByRole('dialog', { name: '编辑设计师' })).getByRole(
      'textbox',
      { name: '名称' },
    ),
  ).toHaveValue('纸感排版编辑版');
});

it('keeps create and profile edit drafts independent', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: '创建' }));
  fireEvent.change(
    within(screen.getByRole('dialog', { name: '创建设计师' })).getByRole(
      'textbox',
      { name: '名称' },
    ),
    { target: { value: '全新档案' } },
  );
  fireEvent.click(screen.getByRole('button', { name: '保留' }));
  fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  fireEvent.change(
    within(screen.getByRole('dialog', { name: '编辑设计师' })).getByRole(
      'textbox',
      { name: '名称' },
    ),
    { target: { value: '现有档案编辑' } },
  );
  fireEvent.click(screen.getByRole('button', { name: '保留' }));
  fireEvent.click(screen.getByRole('button', { name: '创建' }));
  expect(
    within(screen.getByRole('dialog', { name: '创建设计师' })).getByRole(
      'textbox',
      { name: '名称' },
    ),
  ).toHaveValue('全新档案');
});

it('filters assets and opens the selected asset details', () => {
  render(<Harness initialView="assets" />);
  fireEvent.change(screen.getByRole('combobox', { name: '类型' }), {
    target: { value: 'logo' },
  });
  expect(screen.getByRole('button', { name: /春间标志/ })).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /市集原图/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /春间标志/ }));
  expect(screen.getByRole('heading', { name: '春间标志' })).toBeInTheDocument();
  expect(
    within(screen.getByLabelText('素材详情')).getByText('SVG · 640 × 240'),
  ).toBeInTheDocument();
});

it('hydrates managed assets for the active workspace project', async () => {
  const listAssets = vi.fn(async () => [{
    id: 'asset-1234567890abcdef', name: '品牌原图', format: 'PNG' as const,
    mimeType: 'image/png', contentHash: '1234567890abcdef'.padEnd(64, '0'), managed: true,
  }]);
  window.designhub = { chooseWorkspaceDirectory: async () => null, listAssets };
  render(<Harness initialView="assets" workspaceId="workspace-1" projectId="project-1" />);

  expect(await screen.findByRole('button', { name: /品牌原图/ })).toBeInTheDocument();
  expect(listAssets).toHaveBeenCalledWith({ workspaceId: 'workspace-1', projectId: 'project-1' });
});

it('shows honest unavailable states for connections and delivery', () => {
  const { unmount } = render(<Harness initialView="connections" />);
  expect(screen.getByText('尚未连接模型')).toBeInTheDocument();
  expect(screen.getByLabelText('API 密钥')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /检测/ }),
  ).not.toBeInTheDocument();
  unmount();
  render(<Harness initialView="delivery" />);
  fireEvent.click(screen.getByRole('button', { name: 'JPEG' }));
  expect(
    screen.getByText('JPEG 不支持透明背景，将使用当前背景色。'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '导出' })).toBeDisabled();
});

it('derives the delivery preview from the selected project', () => {
  const project: Project = {
    id: 'objects',
    name: '日常之物',
    enName: 'Everyday objects',
    description: '生活方式品牌',
    enDescription: 'Lifestyle brand',
    designers: ['清晰商业'],
    artwork: 'objects',
    documents: 2,
  };
  const { container } = render(
    <Harness initialView="delivery" deliveryProject={project} />,
  );
  expect(screen.getByRole('heading', { name: '日常之物' })).toBeInTheDocument();
  expect(screen.getByText('1080 × 1440 像素 · sRGB')).toBeInTheDocument();
  expect(
    container.querySelector('.delivery-preview .artwork--objects'),
  ).toBeInTheDocument();
  expect(screen.queryByText('定稿')).not.toBeInTheDocument();
});

it('routes an empty delivery page back to project selection', () => {
  render(<Harness initialView="delivery" deliveryProject={null} />);
  expect(screen.getByRole('heading', { name: '选择文档' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '返回项目' }));
  expect(screen.getByLabelText('current-view')).toHaveTextContent('projects');
});

it('changes theme and locale through the settings controls', () => {
  render(<Harness initialView="settings" />);
  fireEvent.click(screen.getByRole('radio', { name: '深色' }));
  expect(screen.getByLabelText('current-theme')).toHaveTextContent('dark');
  fireEvent.change(screen.getByRole('combobox', { name: '语言' }), {
    target: { value: 'en' },
  });
  expect(screen.getByLabelText('current-locale')).toHaveTextContent('en');
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
});

it('uses functional navigation for the model setup action', () => {
  render(<Harness initialView="connections" />);
  fireEvent.click(screen.getByRole('button', { name: '查看设置' }));
  expect(screen.getByLabelText('current-view')).toHaveTextContent('settings');
  expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument();
});
