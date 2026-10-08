import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';

import type { Locale } from '../i18n';
import { LibraryPages } from './LibraryPages';
import type { Project, Theme, View } from './types';
import type { ExportHistoryRecord } from '../../features/delivery/export-history';
import type { TaskRecord } from '../../features/tasks/state';
import { previewAssets, previewBrands } from '../../../tests/fixtures/libraries';
import { personaProfiles } from '../../../tests/fixtures/personas';
import { PageToolbarHost, PageToolbarProvider } from './PageToolbar';

const Harness = ({
  initialView = 'designers',
  deliveryProject,
  libraryId,
  projectId,
  onAssetAction,
  onDesignerProfilesChange,
}: {
  initialView?: Exclude<View, 'projects'>;
  deliveryProject?: Project | null;
  libraryId?: string;
  projectId?: string;
  onAssetAction?: (input: { assetId: string; mode: 'place' | 'reference' | 'replace'; projectId?: string }) => void;
  onDesignerProfilesChange?: (profiles: typeof personaProfiles) => void;
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
          libraryId={libraryId}
          projectId={projectId}
          onAssetAction={onAssetAction}
          preview
          initialAssets={previewAssets as never}
          initialBrands={previewBrands}
          initialProfiles={personaProfiles}
          onDesignerProfilesChange={onDesignerProfilesChange}
        />
      )}
    </>
  );
};

const taskRecord = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: 'task-1',
  requestId: 'request-1',
  state: 'completed',
  cancelRequested: false,
  attempt: 1,
  ...overrides,
});

const TaskHarness = ({ libraryId = 'workspace-1' }: { libraryId?: string }) => (
  <PageToolbarProvider>
    <PageToolbarHost />
    <Harness initialView="tasks" libraryId={libraryId} />
  </PageToolbarProvider>
);

it('exposes portfolio analysis as the only new-designer flow', () => {
  render(<Harness />);
  expect(document.querySelector('.designer-library-page')).toHaveClass('designer-library-page--plain');
  fireEvent.click(screen.getByRole('button', { name: '从作品集创建' }));
  const dialog = screen.getByRole('dialog', { name: '导入作品集分析 · 生成 AI 设计师档案' });
  expect(within(dialog).queryByRole('textbox', { name: '作品集链接' })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: '选择图片' })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: '选择 ZIP' })).not.toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: '上传作品集文件' })).toBeInTheDocument();
  expect(within(dialog).queryByRole('textbox', { name: '名称' })).not.toBeInTheDocument();
});

it('keeps a profile edit draft when the same profile is reopened', () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: /纸感排版/ }));
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

it('notifies the home profile source when a designer is archived', async () => {
  const onDesignerProfilesChange = vi.fn<(profiles: typeof personaProfiles) => void>();
  render(<Harness onDesignerProfilesChange={onDesignerProfilesChange} />);

  fireEvent.click(screen.getByRole('button', { name: /纸感排版/ }));
  fireEvent.click(screen.getByRole('button', { name: '删除' }));

  await waitFor(() => expect(onDesignerProfilesChange).toHaveBeenCalled());
  const updatedProfiles = onDesignerProfilesChange.mock.lastCall?.[0];
  expect(updatedProfiles?.find((profile) => profile.id === 'paper-type')?.status).toBe('archived');
});

it('filters assets and opens the selected asset details in a drawer', () => {
  render(<Harness initialView="assets" />);
  fireEvent.click(screen.getByRole('button', { name: '标志' }));
  expect(screen.getByRole('button', { name: /春间标志/ })).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /市集原图/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /春间标志/ }));
  const details = screen.getByRole('dialog', { name: '素材详情' });
  expect(details).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '春间标志' })).toBeInTheDocument();
  expect(within(details).getByText('SVG · 640 × 240')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));
  expect(screen.queryByRole('dialog', { name: '素材详情' })).not.toBeInTheDocument();
});

it('places brand detail actions in the drawer footer', async () => {
  window.designhub = {

    loadBrandState: vi.fn(async () => ({ brands: previewBrands as never })),
  };
  render(<Harness initialView="brands" libraryId="workspace-1" />);
  await waitFor(() => expect(screen.getByRole('button', { name: /春间/ })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /春间/ }));
  const dialog = screen.getByRole('dialog', { name: '品牌详情' });
  expect(dialog.querySelector('.brand-actions')?.closest('.ui-drawer__footer')).toBeInTheDocument();
});

it('wraps an empty asset search result in the page-level empty-state region', () => {
  render(<Harness initialView="assets" />);
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索素材' }), {
    target: { value: '不存在的素材' },
  });

  expect(
    screen.getByRole('heading', { name: '没有匹配素材' }).closest('.page-empty-state'),
  ).not.toBeNull();
  expect(
    screen.getByRole('heading', { name: '没有匹配素材' }).closest('.asset-collection'),
  ).toHaveClass('asset-collection--empty');
});

it('hydrates managed assets for the active workspace project', async () => {
  const listAssets = vi.fn(async () => [{
    id: 'asset-1234567890abcdef', name: '品牌原图', format: 'PNG' as const,
    mimeType: 'image/png', contentHash: '1234567890abcdef'.padEnd(64, '0'), managed: true,
  }]);
  window.designhub = {  listAssets };
  render(<Harness initialView="assets" libraryId="workspace-1" projectId="project-1" />);

  expect(await screen.findByRole('button', { name: /品牌原图/ })).toBeInTheDocument();
  expect(listAssets).toHaveBeenCalledWith({ libraryId: 'workspace-1', projectId: 'project-1' });
});

it('shows an empty asset state instead of example assets for an empty workspace project', async () => {
  const listAssets = vi.fn(async () => []);
  window.designhub = {  listAssets };
  render(<Harness initialView="assets" libraryId="workspace-empty" projectId="project-empty" />);
  await waitFor(() => expect(listAssets).toHaveBeenCalledWith({ libraryId: 'workspace-empty', projectId: 'project-empty' }));
  expect(await screen.findByText('暂无素材')).toBeInTheDocument();
  expect(screen.queryByText('市集原图')).not.toBeInTheDocument();
});

it('shows an asset load failure instead of an empty example state', async () => {
  const listAssets = vi.fn(async () => { throw new Error('ASSET_LOAD_FAILED'); });
  window.designhub = {  listAssets };
  render(<Harness initialView="assets" libraryId="workspace-failed" projectId="project-failed" />);
  expect(await screen.findByRole('heading', { name: '素材读取失败' })).toBeInTheDocument();
  expect(screen.queryByText('市集原图')).not.toBeInTheDocument();
});

it('keeps external asset references visibly unmanaged in project details', async () => {
  window.designhub = {  listAssets: vi.fn(async () => [{
    id: 'asset-external', name: '参考链接', format: 'PNG' as const, mimeType: 'image/png',
    contentHash: 'abcdef'.padEnd(64, '0'), managed: false, externalReference: 'https://example.com/ref.png',
  }]) };
  render(<Harness initialView="assets" libraryId="workspace-1" projectId="project-1" />);

  fireEvent.click(await screen.findByRole('button', { name: /参考链接/ }));
  const details = screen.getByRole('dialog', { name: '素材详情' });
  expect(within(details).getAllByText('外部引用').length).toBeGreaterThan(0);
  expect(within(details).queryByText('受管副本')).not.toBeInTheDocument();
});

it('exposes explicit asset placement actions from project details', async () => {
  const onAssetAction = vi.fn();
  window.designhub = {  listAssets: vi.fn(async () => [{
    id: 'asset-action', name: '可用原图', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'a'.repeat(64), managed: true,
  }]) };
  render(<Harness initialView="assets" libraryId="workspace-1" projectId="project-1" onAssetAction={onAssetAction} />);
  fireEvent.click(await screen.findByRole('button', { name: /可用原图/ }));
  const details = await screen.findByRole('dialog', { name: '素材详情' });
  expect(details.querySelector('.asset-detail-actions')?.closest('.ui-drawer__footer')).toBeInTheDocument();
  fireEvent.click(within(details).getByRole('button', { name: '放入画布' }));
  expect(onAssetAction).toHaveBeenCalledWith({ assetId: 'asset-action', mode: 'place', projectId: 'project-1' });
  fireEvent.click(within(details).getByRole('button', { name: '作为参考' }));
  expect(onAssetAction).toHaveBeenCalledWith({ assetId: 'asset-action', mode: 'reference', projectId: 'project-1' });
  fireEvent.click(within(details).getByRole('button', { name: '替换选中图像' }));
  expect(onAssetAction).toHaveBeenCalledWith({ assetId: 'asset-action', mode: 'replace', projectId: 'project-1' });
});

it('loads managed asset bytes for the selected workspace preview', async () => {
  const readAsset = vi.fn(async () => new Uint8Array([137, 80, 78, 71]));
  window.designhub = {  listAssets: vi.fn(async () => [{ id: 'asset-managed', name: '原图', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'a'.repeat(64), managed: true }]), readAsset };
  render(<Harness initialView="assets" libraryId="workspace-1" projectId="project-1" />);
  await waitFor(() => expect(readAsset).toHaveBeenCalledWith({ libraryId: 'workspace-1', projectId: 'project-1', assetId: 'asset-managed' }));
});

it('hides internal conversation and project cover assets from the material library', async () => {
  window.designhub = {  listAssets: vi.fn(async () => [
    { id: 'asset-visible', name: '公开素材', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'a'.repeat(64), managed: true },
    { id: 'asset-conversation', name: '对话附件', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'b'.repeat(64), managed: true, metadata: { purpose: 'conversation-reference' } },
    { id: 'asset-cover', name: '项目封面文件', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'c'.repeat(64), managed: true, metadata: { purpose: 'project-cover' } },
  ]) };
  render(<Harness initialView="assets" libraryId="workspace-1" projectId="project-1" />);

  expect(await screen.findByRole('button', { name: /公开素材/ })).toBeInTheDocument();
  expect(screen.queryByText('对话附件')).not.toBeInTheDocument();
  expect(screen.queryByText('项目封面文件')).not.toBeInTheDocument();
});

it('imports dropped files for a workspace project', async () => {
  const importAssets = vi.fn(async () => [{ status: 'success' as const, asset: { id: 'asset-drop', name: 'drop.png', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'd'.repeat(64), managed: true } }]);
  window.designhub = {  listAssets: vi.fn(async () => []), importAssets };
  render(<Harness initialView="assets" libraryId="workspace-1" projectId="project-1" />);
  const file = new File(['png'], 'drop.png', { type: 'image/png' });
  fireEvent.drop(screen.getByLabelText('素材导入区域'), { dataTransfer: { files: [file] } });
  await waitFor(() => expect(importAssets).toHaveBeenCalledWith(expect.objectContaining({ libraryId: 'workspace-1', projectId: 'project-1', items: [expect.objectContaining({ name: 'drop.png', mimeType: 'image/png' })] })));
});

it('imports an image pasted from the clipboard for a workspace project', async () => {
  const importAssets = vi.fn(async () => [{ status: 'success' as const, asset: { id: 'asset-paste', name: 'clipboard.png', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'p'.repeat(64), managed: true } }]);
  window.designhub = {  listAssets: vi.fn(async () => []), importAssets };
  render(<Harness initialView="assets" libraryId="workspace-1" projectId="project-1" />);
  const file = new File(['png'], '', { type: 'image/png' });
  fireEvent.paste(screen.getByLabelText('素材导入区域'), { clipboardData: { files: [file] } });
  await waitFor(() => expect(importAssets).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ name: 'clipboard.png', mimeType: 'image/png' })] })));
});

it('shows honest unavailable states for connections and delivery', () => {
  const { unmount } = render(<Harness initialView="connections" />);
  expect(screen.getByText('尚未连接模型')).toBeInTheDocument();
  expect(screen.queryByLabelText('对话与视觉 API 密钥')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '对话与视觉' }));
  const dialog = screen.getByRole('dialog', { name: '连接配置' });
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: '保存配置' }).closest('.ui-drawer__footer')).toBeInTheDocument();
  expect(screen.getByLabelText('对话与视觉 API 密钥')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /检测/ }),
  ).not.toBeInTheDocument();
  unmount();
  render(<Harness initialView="delivery" />);
  expect(screen.getByRole('heading', { name: '选择文档' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: '导出配置' })).not.toBeInTheDocument();
});

it('shows a connected state and lets the model groups switch profile configuration', async () => {
  const hasCredential = vi.fn(async (account: string) => account === 'openai-compatible:conversation');
  const loadProviderConfigs = vi.fn(async () => ({
    'openai-compatible': {
      conversation: { baseUrl: 'https://text.example/v1', models: { conversation: 'chat-model' } },
      image: { baseUrl: 'https://image.example/v1', imageTransport: 'images' as const, models: { 'image-generation': 'image-model' } },
    },
  }));
  window.designhub = {  hasCredential, loadProviderConfigs };
  render(<Harness initialView="connections" />);

  await waitFor(() => expect(screen.getByText('模型已连接')).toBeInTheDocument());
  expect(screen.queryByText('尚未连接模型')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '对话与视觉' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '图片生成与编辑' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '对话与视觉' }));
  const dialog = screen.getByRole('dialog', { name: '连接配置' });
  expect(dialog).toBeInTheDocument();
  expect(dialog).toHaveClass('provider-connection-dialog');
  expect(screen.getByRole('heading', { name: '对话与视觉' })).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: '图片生成与编辑' }));
  expect(screen.getByRole('heading', { name: '图片生成与编辑' })).toBeInTheDocument();
  expect(screen.getByLabelText('Image base URL')).toHaveValue('https://image.example/v1');
});

it('keeps a saved image credential stable after publishing drawer actions', async () => {
  const hasCredential = vi.fn(async (account: string) => account === 'openai-compatible:image');
  window.designhub = {

    hasCredential,
    loadProviderConfigs: async () => ({
      'openai-compatible': {
        conversation: { baseUrl: '', models: {} },
        image: { baseUrl: 'https://image.example/v1', imageTransport: 'images' as const, models: { 'image-generation': 'image-model' } },
      },
    }),
    testImageGeneration: async () => null,
  };
  render(<Harness initialView="connections" libraryId="workspace-1" />);

  await waitFor(() => expect(screen.getByRole('button', { name: '图片生成与编辑' })).toHaveTextContent('已连接'));
  fireEvent.click(screen.getByRole('button', { name: '图片生成与编辑' }));
  const dialog = screen.getByRole('dialog', { name: '连接配置' });

  const keyStatus = await within(dialog).findByText('密钥已保存');
  expect(keyStatus.parentElement).toHaveClass('provider-key-label');
  expect(keyStatus.parentElement).toHaveTextContent('API 密钥');
  expect(within(dialog).getByText('已连接')).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: '测试生成' }).closest('.provider-profile-actions-row')).toHaveClass('provider-profile-actions-row--compact');
  expect(hasCredential).toHaveBeenCalledTimes(4);
});

it('hydrates and saves the non-secret provider connection configuration', async () => {
  const loadProviderConfigs = vi.fn(async () => ({
    'openai-compatible': {
      conversation: { baseUrl: 'https://text.example.test/v1', models: { conversation: 'chat-old' } },
      image: { baseUrl: 'https://image.example.test/v1', imageTransport: 'images' as const, models: {} },
    },
  }));
  const saveProviderConfig = vi.fn(async () => true);
  window.designhub = {  loadProviderConfigs, saveProviderConfig };
  render(<Harness initialView="connections" />);

  fireEvent.click(screen.getByRole('button', { name: '对话与视觉' }));
  await waitFor(() => expect(screen.getByLabelText('对话服务地址')).toHaveValue('https://text.example.test/v1'));
  fireEvent.change(screen.getByLabelText('对话模型'), { target: { value: 'chat-new' } });
  fireEvent.click(screen.getAllByRole('button', { name: '保存配置' })[0]!);
  await waitFor(() => expect(saveProviderConfig).toHaveBeenCalledWith({
    connectionId: 'openai-compatible',
    config: {
      conversation: { baseUrl: 'https://text.example.test/v1', models: { conversation: 'chat-new' } },
      image: { baseUrl: 'https://image.example.test/v1', imageTransport: 'images', models: {} },
    },
  }));
});

it('hydrates a workspace brand library and persists create/edit/delete actions', async () => {
  const loadBrandState = vi.fn(async () => ({ brands: [{ id: 'local', name: '本地品牌', version: 'v1', logo: 'mark', colorPalette: ['#000'], fonts: ['Geist'], tone: '清晰', fixedCopy: '开始', sizes: ['1080x1080'] }] }));
  const saveBrandState = vi.fn(async () => true);
  window.designhub = {  loadBrandState, saveBrandState };
  render(<Harness initialView="brands" libraryId="workspace-1" />);
  fireEvent.click(await screen.findByRole('button', { name: /本地品牌/ }));
  expect(await screen.findByRole('heading', { name: '本地品牌' })).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: '品牌详情' })).toBeInTheDocument();
  expect(loadBrandState).toHaveBeenCalledWith('workspace-1');
  fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  const edit = screen.getByRole('dialog', { name: '编辑品牌' });
  fireEvent.change(within(edit).getByLabelText('语气'), { target: { value: '更清晰' } });
  fireEvent.submit(within(edit).getByRole('form', { name: '品牌编辑' }));
  await waitFor(() => expect(saveBrandState).toHaveBeenCalledWith('workspace-1', expect.objectContaining({ brands: [expect.objectContaining({ tone: '更清晰' })] })));
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: '删除品牌' })).getByRole('button', { name: '删除' }));
  await waitFor(() => expect(saveBrandState).toHaveBeenCalledTimes(2));
});

it('does not inject built-in brands into an empty workspace', async () => {
  const loadBrandState = vi.fn(async () => ({ brands: [] }));
  window.designhub = {  loadBrandState };
  render(<Harness initialView="brands" libraryId="workspace-empty" />);
  await waitFor(() => expect(loadBrandState).toHaveBeenCalledWith('workspace-empty'));
  expect(await screen.findByText('暂无品牌包')).toBeInTheDocument();
  expect(screen.queryByText('春间市集')).not.toBeInTheDocument();
});

it('shows a brand load failure instead of example brands', async () => {
  const loadBrandState = vi.fn(async () => { throw new Error('BRAND_LOAD_FAILED'); });
  window.designhub = {  loadBrandState };
  render(<Harness initialView="brands" libraryId="workspace-failed" />);
  expect(await screen.findByText('品牌读取失败')).toBeInTheDocument();
  expect(screen.queryByText('春间市集')).not.toBeInTheDocument();
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
  const dialog = screen.getByRole('dialog', { name: '导出配置' });
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: '导出' }).closest('.ui-drawer__footer')).toBeInTheDocument();
  expect(screen.queryByText('定稿')).not.toBeInTheDocument();
});

it('exposes WebP alongside the supported delivery formats', () => {
  const project: Project = { id: 'webp-project', libraryId: 'workspace-1', documentId: 'doc-1', name: 'WebP 项目', enName: 'WebP project', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 1 };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  expect(screen.getByRole('button', { name: 'WEBP' })).toBeInTheDocument();
});

it('previews the actual managed image from the current document scene', async () => {
  const scene = {
    id: 'scene-current', version: 1 as const, width: 1080, height: 1440,
    layers: [{ id: 'content', type: 'image' as const, role: 'content' as const, assetId: 'asset-final', x: 0, y: 0, width: 1080, height: 1440, rotation: 0, opacity: 1, visible: true, locked: false }],
  };
  const loadDocumentScene = vi.fn(async () => scene);
  const readAsset = vi.fn(async () => new Uint8Array([137, 80, 78, 71]));
  const createObjectURL = vi.fn(() => 'blob:delivery-scene');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  window.designhub = {  loadDocumentScene, readAsset };
  const project: Project = { id: 'preview-project', libraryId: 'workspace-1', documentId: 'doc-1', name: '预览项目', enName: 'Preview project', description: 'desc', enDescription: 'desc', designers: [], artwork: 'blank', documents: 1, documentEntries: [{ id: 'doc-1', name: '主海报', width: 1080, height: 1440 }] };

  const view = render(<Harness initialView="delivery" deliveryProject={project} />);

  expect(await screen.findByRole('img', { name: '主海报导出预览' })).toHaveAttribute('src', 'blob:delivery-scene');
  expect(loadDocumentScene).toHaveBeenCalledWith('workspace-1', 'preview-project', 'doc-1');
  expect(readAsset).toHaveBeenCalledWith({ libraryId: 'workspace-1', projectId: 'preview-project', assetId: 'asset-final' });
  expect(view.container.querySelector('.delivery-preview .artwork--blank')).not.toBeInTheDocument();
  view.unmount();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:delivery-scene');
  vi.unstubAllGlobals();
});

it('does not offer image export for an empty formal document scene', async () => {
  window.designhub = {  loadDocumentScene: vi.fn(async () => ({ id: 'scene-empty', version: 1 as const, width: 1080, height: 1440, layers: [] })) };
  const project: Project = { id: 'empty-project', libraryId: 'workspace-1', documentId: 'doc-empty', name: '空文档', enName: 'Empty document', description: 'desc', enDescription: 'desc', designers: [], artwork: 'blank', documents: 1, documentEntries: [{ id: 'doc-empty', name: '空文档', width: 1080, height: 1440 }] };

  render(<Harness initialView="delivery" deliveryProject={project} />);

  expect(await screen.findByText('当前文档没有可导出的正式内容，请先在画布中选择候选稿并定稿。')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '导出' })).toBeDisabled();
});

it('uses the page toolbar export control to open image export settings', async () => {
  window.designhub = {  loadDocumentScene: vi.fn(async () => ({ id: 'scene-empty', version: 1 as const, width: 1080, height: 1440, layers: [] })) };
  const project: Project = { id: 'toolbar-project', libraryId: 'workspace-1', documentId: 'doc-1', name: '工具栏项目', enName: 'Toolbar project', description: 'desc', enDescription: 'desc', designers: [], artwork: 'blank', documents: 1 };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  fireEvent.click(screen.getByRole('button', { name: '关闭' }));

  fireEvent.click(screen.getByRole('button', { name: '导出当前设计稿' }));

  expect(screen.getByRole('dialog', { name: '导出配置' })).toBeInTheDocument();
});

it('lets delivery explicitly export the finalized document revision', async () => {
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [{ revisionId: 'revision-final', projectId: 'final-project', documentId: 'doc-1', parentRevisionId: null, operationId: 'op-final', sceneAssetId: 'scene-final', assetIds: [], contributions: [], createdAt: '2026-09-12T00:00:00.000Z', scene: { id: 'scene-final', version: 1 as const, width: 100, height: 100, layers: [{ id: 'shape', type: 'shape' as const, kind: 'rect' as const, x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, visible: true, locked: false, fill: '#fff', stroke: 'none', strokeWidth: 0 }] } }], timeline: [], finalRevisionId: 'revision-final' }));
  const loadDocumentScene = vi.fn(async () => ({ id: 'scene-current', version: 1 as const, width: 100, height: 100, layers: [] }));
  const exportDocument = vi.fn(async () => ({ path: '/tmp/final.png', sha256: 'a'.repeat(64) }));
  window.designhub = {  loadDocumentRevisions, loadDocumentScene, exportDocument };
  const project: Project = { id: 'final-project', libraryId: 'workspace-1', documentId: 'doc-1', name: '定稿项目', enName: 'Final project', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 1, documentEntries: [{ id: 'doc-1', name: '主海报', width: 100, height: 100, finalizedRevisionId: 'revision-final' }] };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  fireEvent.change(screen.getByRole('combobox', { name: '来源' }), { target: { value: 'final' } });
  fireEvent.click(screen.getByRole('button', { name: '导出' }));
  await waitFor(() => expect(exportDocument).toHaveBeenCalledWith(expect.objectContaining({ scene: expect.objectContaining({ id: 'scene-final' }) })));
  expect(loadDocumentRevisions).toHaveBeenCalledWith('workspace-1', 'final-project', 'doc-1');
  expect(loadDocumentScene).toHaveBeenCalledWith('workspace-1', 'final-project', 'doc-1');
});

it('lets delivery select another document in a multi-document project', async () => {
  const loadDocumentScene = vi.fn(async (_workspaceId: string, _projectId: string, documentId: string) => ({ id: `scene-${documentId}`, version: 1 as const, width: 100, height: 100, layers: [{ id: 'shape', type: 'shape' as const, kind: 'rect' as const, x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, visible: true, locked: false, fill: '#fff', stroke: 'none', strokeWidth: 0 }] }));
  const exportDocument = vi.fn(async () => ({ path: '/tmp/second.png', sha256: 'b'.repeat(64) }));
  window.designhub = {  loadDocumentScene, exportDocument };
  const project: Project = { id: 'multi-project', libraryId: 'workspace-1', documentId: 'doc-1', name: '多文档项目', enName: 'Multi document', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 2, documentEntries: [{ id: 'doc-1', name: '主海报', width: 100, height: 100 }, { id: 'doc-2', name: '方图', width: 100, height: 100 }] };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  fireEvent.change(screen.getByRole('combobox', { name: '文档' }), { target: { value: 'doc-2' } });
  fireEvent.click(screen.getByRole('button', { name: '导出' }));
  await waitFor(() => expect(exportDocument).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'doc-2', scene: expect.objectContaining({ id: 'scene-doc-2' }) })));
  expect(loadDocumentScene).toHaveBeenCalledWith('workspace-1', 'multi-project', 'doc-2');
});

it('offers finalized export for the selected non-primary document', () => {
  const project: Project = {
    id: 'multi-final-project',
    libraryId: 'workspace-1',
    name: '多文档定稿',
    enName: 'Multi final',
    description: 'desc',
    enDescription: 'desc',
    designers: ['纸感排版'],
    artwork: 'blank',
    documents: 2,
    documentEntries: [
      { id: 'doc-main', name: '主海报', width: 100, height: 100 },
      { id: 'doc-square', name: '方图', width: 100, height: 100, finalizedRevisionId: 'revision-square' },
    ],
  };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  fireEvent.change(screen.getByRole('combobox', { name: '文档' }), { target: { value: 'doc-square' } });
  expect(screen.getByRole('option', { name: '已定稿' })).toBeInTheDocument();
});

it('passes the archive choice to document export', async () => {
  const loadDocumentScene = vi.fn(async () => ({ id: 'scene-current', version: 1 as const, width: 100, height: 100, layers: [{ id: 'shape', type: 'shape' as const, kind: 'rect' as const, x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, visible: true, locked: false, fill: '#fff', stroke: 'none', strokeWidth: 0 }] }));
  const exportDocument = vi.fn(async () => ({ path: '/tmp/archive.png', sha256: 'c'.repeat(64) }));
  window.designhub = {  loadDocumentScene, exportDocument };
  const project: Project = { id: 'archive-project', libraryId: 'workspace-1', documentId: 'doc-1', name: '归档项目', enName: 'Archive project', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 1, documentEntries: [{ id: 'doc-1', name: '主海报', width: 100, height: 100 }] };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '导出' }));
  await waitFor(() => expect(exportDocument).toHaveBeenCalledWith(expect.objectContaining({ archiveCopy: true })));
});

it('shows persisted export history for a project', async () => {
  window.designhub = {

    listExportHistory: vi.fn(async (): Promise<ExportHistoryRecord[]> => [{
      id: 'export-1', projectId: 'history-project', documentId: 'doc-1', revisionId: 'revision-1', format: 'png',
      targetPath: '/tmp/poster.png', sha256: 'a'.repeat(64), status: 'success', archived: false, createdAt: '2026-09-13T00:00:00.000Z',
    }]),
  };
  const project: Project = { id: 'history-project', libraryId: 'workspace-1', documentId: 'doc-1', name: '历史项目', enName: 'History project', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 1 };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  await waitFor(() => expect(screen.getByText('PNG · revision-1')).toBeInTheDocument());
  expect(screen.getByText('成功')).toBeInTheDocument();
});

it('uses the error tone for failed export history', async () => {
  window.designhub = {

    listExportHistory: vi.fn(async (): Promise<ExportHistoryRecord[]> => [{
      id: 'export-failed', projectId: 'failed-history-project', documentId: 'doc-1', revisionId: 'revision-1', format: 'png',
      targetPath: '/tmp/poster.png', status: 'failed', archived: false, errorCode: 'WRITE_FAILED', createdAt: '2026-09-13T00:00:00.000Z',
    }]),
  };
  const project: Project = { id: 'failed-history-project', libraryId: 'workspace-1', documentId: 'doc-1', name: '失败历史', enName: 'Failed history', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 1 };
  render(<Harness initialView="delivery" deliveryProject={project} />);

  expect(await screen.findByText('失败')).toHaveClass('badge--error');
});

it('keeps history when its external target has moved', async () => {
  window.designhub = {

    listExportHistory: vi.fn(async (): Promise<ExportHistoryRecord[]> => [{
      id: 'export-moved', projectId: 'moved-project', documentId: 'doc-1', revisionId: 'revision-1', format: 'png',
      targetPath: '/tmp/missing.png', status: 'success', archived: false, targetAvailable: false, createdAt: '2026-09-13T00:00:00.000Z',
    }]),
  };
  const project: Project = { id: 'moved-project', libraryId: 'workspace-1', documentId: 'doc-1', name: '移动项目', enName: 'Moved project', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 1 };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  await waitFor(() => expect(screen.getByText(/目标已移动/)).toBeInTheDocument());
  expect(screen.getByText('成功')).toBeInTheDocument();
});

it('re-exports a historical revision through a new destination', async () => {
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [{ revisionId: 'revision-history', projectId: 'history-export', documentId: 'doc-1', parentRevisionId: null, operationId: 'op-1', sceneAssetId: 'scene-1', assetIds: [], contributions: [], createdAt: '2026-09-13T00:00:00.000Z', scene: { id: 'scene-1', version: 1 as const, width: 100, height: 100, layers: [] } }], timeline: [], finalRevisionId: null }));
  const exportDocument = vi.fn(async () => ({ path: '/tmp/re-export.png', sha256: 'e'.repeat(64) }));
  window.designhub = {  listExportHistory: vi.fn(async (): Promise<ExportHistoryRecord[]> => [{ id: 'export-history', projectId: 'history-export', documentId: 'doc-1', revisionId: 'revision-history', format: 'png', targetPath: '/tmp/old.png', status: 'success', archived: false, createdAt: '2026-09-13T00:00:00.000Z' }]), loadDocumentRevisions, exportDocument };
  const project: Project = { id: 'history-export', libraryId: 'workspace-1', documentId: 'doc-1', name: '历史导出', enName: 'History export', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 1 };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  await waitFor(() => expect(screen.getByText('PNG · revision-history')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '重新导出' }));
  await waitFor(() => expect(exportDocument).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'doc-1', format: 'png', scene: expect.objectContaining({ id: 'scene-1' }) })));
});

it('reports an archive copy failure while retaining the external export result', async () => {
  const loadDocumentScene = vi.fn(async () => ({ id: 'scene-current', version: 1 as const, width: 100, height: 100, layers: [{ id: 'shape', type: 'shape' as const, kind: 'rect' as const, x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, visible: true, locked: false, fill: '#fff', stroke: 'none', strokeWidth: 0 }] }));
  const exportDocument = vi.fn(async () => ({ path: '/tmp/archive.png', sha256: 'd'.repeat(64), archived: false, archiveError: 'TARGET_EXISTS' }));
  window.designhub = {  loadDocumentScene, exportDocument };
  const project: Project = { id: 'archive-failure-project', libraryId: 'workspace-1', documentId: 'doc-1', name: '归档失败', enName: 'Archive failure', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 1, documentEntries: [{ id: 'doc-1', name: '主海报', width: 100, height: 100 }] };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '导出' }));
  await waitFor(() => expect(screen.getByText(/归档副本失败/)).toBeInTheDocument());
  expect(screen.getByText(/可重试/)).toBeInTheDocument();
});

it('offers project package export for persisted projects', async () => {
  const exportProjectPackage = vi.fn(async () => ({ path: '/tmp/project.zip', sha256: 'a'.repeat(64) }));
  window.designhub = {  exportProjectPackage };
  const project: Project = { id: 'project-1', libraryId: 'workspace-1', documentId: 'doc-1', name: '项目', enName: 'Project', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 1 };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  fireEvent.click(screen.getByRole('button', { name: '导出项目包' }));
  await waitFor(() => expect(exportProjectPackage).toHaveBeenCalledWith({ libraryId: 'workspace-1', projectId: 'project-1' }));
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

it('reports configured models in settings when a provider credential exists', async () => {
  const hasCredential = vi.fn(async (account: string) => account === 'openai-compatible:conversation');
  window.designhub = {  hasCredential };
  render(<Harness initialView="settings" />);

  await waitFor(() => expect(hasCredential).toHaveBeenCalledWith('openai-compatible:image'));
  expect(screen.getByRole('button', { name: /模型连接/ })).toHaveTextContent('已有已配置连接');
});

it('keeps model setup on the connections page without a redundant settings action', () => {
  render(<Harness initialView="connections" />);
  expect(screen.queryByRole('button', { name: '查看设置' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('current-view')).toHaveTextContent('connections');
  expect(document.querySelector('.connection-layout')).toHaveClass('connection-layout--status-first');
});

it('loads workspace trash entries and restores them through the desktop bridge', async () => {
  const listTrashedProjects = vi.fn(async () => [{ projectId: 'project-1', originalRelativePath: 'projects/project-1', deletedAt: '2026-09-12T00:00:00.000Z' }]);
  const restoreProjectFromTrash = vi.fn(async () => ({ projectId: 'project-1', restoredRelativePath: 'projects/project-1' }));
  window.designhub = {  listTrashedProjects, restoreProjectFromTrash };
  render(<Harness initialView="storage" libraryId="workspace-1" />);

  expect(await screen.findByText('project-1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '恢复' }));
  await waitFor(() => expect(restoreProjectFromTrash).toHaveBeenCalledWith({ libraryId: 'workspace-1', projectId: 'project-1' }));
  expect(await screen.findByText('废纸篓为空')).toBeInTheDocument();
});

it('persists backup destination and schedule per workspace', async () => {
  const createWorkspaceBackup = vi.fn(async () => ({ directory: '/Volumes/Backups/workspace-1-2026.designhub-backup', libraryId: 'workspace-1', createdAt: '2026-09-13T12:00:00.000Z' }));
  localStorage.setItem('designhub.backup.workspace-1', JSON.stringify({ destinationParentDirectory: '/Volumes/Backups', schedule: 'daily', lastRunAt: null, lastArtifactPath: null }));
  window.designhub = {  createWorkspaceBackup };
  render(<Harness initialView="storage" libraryId="workspace-1" />);
  fireEvent.click(screen.getByRole('button', { name: '备份' }));
  expect(screen.getByRole('combobox', { name: '备份周期' })).toHaveValue('daily');
  expect(screen.getByText('/Volumes/Backups')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: '备份周期' }), { target: { value: 'weekly' } });
  expect(JSON.parse(localStorage.getItem('designhub.backup.workspace-1') ?? '{}')).toMatchObject({ schedule: 'weekly' });
  fireEvent.click(screen.getByRole('button', { name: '创建备份' }));
  await waitFor(() => expect(createWorkspaceBackup).toHaveBeenCalledWith('workspace-1', '/Volumes/Backups'));
});

it('chooses and persists a backup destination from the backup page', async () => {
  const chooseWorkspaceBackupDirectory = vi.fn(async () => '/Volumes/DesignHub Backups');
  const saveWorkspaceSettings = vi.fn(async () => true);
  window.designhub = {
    chooseWorkspaceBackupDirectory,
    loadWorkspaceSettings: vi.fn(async () => null),
    saveWorkspaceSettings,
  };
  render(<Harness initialView="storage" libraryId="workspace-1" />);

  fireEvent.click(screen.getByRole('button', { name: '备份' }));
  fireEvent.click(screen.getByRole('button', { name: '选择备份位置' }));

  expect(await screen.findByText('/Volumes/DesignHub Backups')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('designhub.backup.workspace-1') ?? '{}')).toMatchObject({
    destinationParentDirectory: '/Volumes/DesignHub Backups',
  });
  await waitFor(() => expect(saveWorkspaceSettings).toHaveBeenCalledWith(
    'workspace-1',
    expect.objectContaining({
      backup: expect.objectContaining({ destinationParentDirectory: '/Volumes/DesignHub Backups' }),
    }),
  ));
  expect(chooseWorkspaceBackupDirectory).toHaveBeenCalledWith('destination');
});

it('restores a selected backup into a newly selected parent directory', async () => {
  const chooseWorkspaceBackupDirectory = vi.fn(async (kind: 'source' | 'destination') => (
    kind === 'source' ? '/Volumes/Backups/workspace.designhub-backup' : '/Volumes/Restored Workspaces'
  ));
  const restoreWorkspaceBackup = vi.fn(async () => ({
    directory: '/Volumes/Restored Workspaces/DesignHub-restored-1',
    libraryId: 'workspace-restored',
  }));
  window.designhub = { chooseWorkspaceBackupDirectory, restoreWorkspaceBackup };
  render(<Harness initialView="storage" libraryId="workspace-1" />);

  fireEvent.click(screen.getByRole('button', { name: '备份' }));
  fireEvent.click(screen.getByRole('button', { name: '恢复备份' }));

  await waitFor(() => expect(restoreWorkspaceBackup).toHaveBeenCalledWith({
    backupDirectory: '/Volumes/Backups/workspace.designhub-backup',
    destinationParentDirectory: '/Volumes/Restored Workspaces',
  }));
  expect(screen.getByLabelText('notice')).toHaveTextContent('备份已恢复到 /Volumes/Restored Workspaces/DesignHub-restored-1');
  expect(chooseWorkspaceBackupDirectory).toHaveBeenNthCalledWith(1, 'source');
  expect(chooseWorkspaceBackupDirectory).toHaveBeenNthCalledWith(2, 'destination');
});

it('hydrates backup preferences from workspace storage and writes updates through the bridge', async () => {
  const loadWorkspaceSettings = vi.fn(async () => ({
    formatVersion: 1 as const,
    backup: {
      destinationParentDirectory: '/WorkspaceBackups',
      schedule: 'weekly' as const,
      lastRunAt: '2026-09-12T00:00:00.000Z',
      lastArtifactPath: '/WorkspaceBackups/latest',
    },
  }));
  const saveWorkspaceSettings = vi.fn(async () => true);
  window.designhub = {  loadWorkspaceSettings, saveWorkspaceSettings };
  render(<Harness initialView="storage" libraryId="workspace-1" />);
  fireEvent.click(screen.getByRole('button', { name: '备份' }));
  expect(await screen.findByText('/WorkspaceBackups')).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: '备份周期' })).toHaveValue('weekly');
  fireEvent.change(screen.getByRole('combobox', { name: '备份周期' }), { target: { value: 'daily' } });
  await waitFor(() => expect(saveWorkspaceSettings).toHaveBeenCalledWith('workspace-1', expect.objectContaining({ formatVersion: 1, backup: expect.objectContaining({ schedule: 'daily' }) })));
});

it('exports a redacted diagnostics preview through the desktop bridge', async () => {
  const exportDiagnostics = vi.fn(async () => '/tmp/designhub-diagnostics.json');
  window.designhub = {  exportDiagnostics };
  render(<Harness initialView="settings" />);
  fireEvent.click(screen.getByRole('button', { name: '导出' }));
  await waitFor(() => expect(exportDiagnostics).toHaveBeenCalledWith({ runtime: 'Electron', errorCode: null }));
});

it('edits the local operator display name without creating an account', () => {
  const onOperatorNameChange = vi.fn();
  render(<LibraryPages view="settings" locale="zh-CN" theme="system" navigate={() => undefined} onThemeChange={() => undefined} onLocaleChange={() => undefined} notify={() => undefined} operatorName="Sifan" onOperatorNameChange={onOperatorNameChange} />);
  const input = screen.getByRole('textbox', { name: '本机操作者' });
  fireEvent.change(input, { target: { value: 'Sifan Chen' } });
  expect(onOperatorNameChange).toHaveBeenCalledWith('Sifan Chen');
});

it('hydrates persisted model tasks in the task view', async () => {
  const listTasks = vi.fn(async () => [{
    id: 'task-1', requestId: 'request-1', state: 'running' as const, cancelRequested: false, attempt: 1,
    source: { kind: 'project' as const, id: 'project-1' },
    capability: 'image-generation', result: { imageCount: 2, cost: 0.04 },
  }]);
  window.designhub = {  listTasks };
  render(<Harness initialView="tasks" libraryId="workspace-1" />);
  expect((await screen.findAllByText('处理中')).length).toBeGreaterThan(0);
  expect(screen.getAllByText('1')).toHaveLength(2);
  expect(listTasks).toHaveBeenCalledWith('workspace-1');
  expect(screen.getByTitle('2 张图 · 费用 0.04')).toBeInTheDocument();
});

it('filters model tasks from the breadcrumb toolbar and keeps rows compact', async () => {
  const longRequest = '这是一段很长的模型任务请求，用于验证任务列表不会因为内容过长而换行显示';
  const listTasks = vi.fn(async () => [
    taskRecord({ id: 'task-queued', state: 'queued' }),
    taskRecord({ id: 'task-running', state: 'running' }),
    taskRecord({ id: 'task-completed', requestText: longRequest, result: { imageCount: 2, cost: 0.04 } }),
    taskRecord({ id: 'task-failed', state: 'failed', requestText: '失败请求', errorCode: 'PROVIDER_UNAVAILABLE' }),
    taskRecord({ id: 'task-cancelled', state: 'cancelled' }),
  ]);
  window.designhub = {  listTasks };
  render(<TaskHarness />);

  const toolbar = await screen.findByRole('group', { name: '任务状态' });
  expect(within(toolbar).getByRole('button', { name: '全部5' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('button', { name: '排队1' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('button', { name: '处理中1' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('button', { name: '已完成1' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('button', { name: '失败2' })).toBeInTheDocument();
  expect(document.querySelector('.task-summary')).toBeNull();
  expect(screen.queryByText('本次会话')).not.toBeInTheDocument();

  fireEvent.click(within(toolbar).getByRole('button', { name: '失败2' }));
  const failedTask = screen.getByRole('article', { name: 'task-failed' });
  const cancelledTask = screen.getByRole('article', { name: 'task-cancelled' });
  expect(failedTask).toBeInTheDocument();
  expect(cancelledTask).toBeInTheDocument();
  expect(within(failedTask).getByText('失败')).toHaveClass('badge--error');
  expect(within(cancelledTask).getByText('已取消')).toHaveClass('badge--warning');
  expect(screen.queryByRole('article', { name: 'task-completed' })).not.toBeInTheDocument();
  expect(screen.getByText('失败请求')).toHaveClass('task-row__summary');

  fireEvent.click(within(toolbar).getByRole('button', { name: '全部5' }));
  expect(screen.getByText(longRequest)).toHaveClass('task-row__summary');
  expect(screen.getByText(longRequest)).toHaveAttribute('title', longRequest);
  const taskList = screen.getByRole('list', { name: '任务列表' });
  expect(within(taskList).getByRole('listitem', { name: '表头' })).toHaveTextContent('任务类型状态任务摘要时间 / 结果操作');
  expect(taskList.lastElementChild).toHaveClass('task-row');
});

it('shows an empty state when a task category has no matches', async () => {
  const listTasks = vi.fn(async () => [taskRecord({ id: 'task-completed', state: 'completed' })]);
  window.designhub = {  listTasks };
  render(<TaskHarness />);
  const toolbar = await screen.findByRole('group', { name: '任务状态' });
  fireEvent.click(within(toolbar).getByRole('button', { name: '排队0' }));
  expect(screen.getByRole('heading', { name: '没有匹配任务' })).toBeInTheDocument();
  expect(within(toolbar).getByRole('button', { name: '排队0' })).toHaveAttribute('aria-pressed', 'true');
});

it('lets a running task be stopped through the desktop bridge', async () => {
  const listTasks = vi.fn(async () => [{
    id: 'task-1', requestId: 'request-1', state: 'running' as const, cancelRequested: false, attempt: 1,
    source: { kind: 'project' as const, id: 'project-1' },
  }]);
  const cancelTask = vi.fn(async () => true);
  window.designhub = {  listTasks, cancelTask };
  render(<Harness initialView="tasks" libraryId="workspace-1" />);
  await screen.findByText('处理中');
  fireEvent.click(screen.getByRole('button', { name: '停止' }));
  await waitFor(() => expect(cancelTask).toHaveBeenCalledWith('workspace-1', 'task-1'));
  expect(await screen.findByText('已取消')).toBeInTheDocument();
});

it('lets a failed task create a new retry attempt through the desktop bridge', async () => {
  const listTasks = vi.fn(async () => [{
    id: 'task-1', requestId: 'request-1', state: 'failed' as const, cancelRequested: false, attempt: 1,
    source: { kind: 'project' as const, id: 'project-1' }, requestText: '调整标题', errorCode: 'PROVIDER_UNAVAILABLE',
  }]);
  const retryTask = vi.fn(async () => ({
    id: 'task-1-retry', requestId: 'request-1', state: 'running' as const, cancelRequested: false, attempt: 2,
    source: { kind: 'project' as const, id: 'project-1' }, requestText: '调整标题',
  }));
  window.designhub = {  listTasks, retryTask };
  render(<Harness initialView="tasks" libraryId="workspace-1" />);
  const failedTask = await screen.findByRole('article', { name: 'task-1' });
  expect(within(failedTask).getByText('失败')).toHaveClass('badge--error');
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await waitFor(() => expect(retryTask).toHaveBeenCalledWith('workspace-1', 'task-1'));
  expect((await screen.findAllByText('处理中')).length).toBeGreaterThan(0);
  expect(screen.getByText('2')).toBeInTheDocument();
});

it('shows generation batch progress and retries only the failed slot', async () => {
  const batch = taskRecord({
    id: 'design-1',
    capability: 'design-generation',
    source: { kind: 'project', id: 'project-1' },
    generationSlots: [
      { id: 'primary', direction: 'primary', state: 'completed', attempt: 1, assetId: 'asset-primary', candidateId: 'candidate-primary' },
      { id: 'composition', direction: 'composition', state: 'failed', attempt: 1, errorCode: 'PROVIDER_REQUEST_FAILED' },
      { id: 'expressive', direction: 'expressive', state: 'completed', attempt: 1, assetId: 'asset-expressive', candidateId: 'candidate-expressive' },
    ],
    result: { imageCount: 2, candidates: [] },
  });
  const completedBatch = {
    ...batch,
    state: 'completed' as const,
    generationSlots: batch.generationSlots?.map((slot) => slot.id === 'composition'
      ? { ...slot, state: 'completed' as const, attempt: 2, errorCode: undefined, assetId: 'asset-composition', candidateId: 'candidate-composition' }
      : slot),
  };
  let retryStarted = false;
  const listTasks = vi.fn(async () => [retryStarted ? completedBatch : batch]);
  const retryTask = vi.fn(async () => null);
  const retryDesignGenerationSlot = vi.fn(async () => {
    retryStarted = true;
    return {
    ...batch,
    state: 'running' as const,
    generationSlots: batch.generationSlots?.map((slot) => slot.id === 'composition'
      ? { ...slot, state: 'queued' as const, attempt: 2, errorCode: undefined }
      : slot),
    };
  });
  window.designhub = {  listTasks, retryTask, retryDesignGenerationSlot };
  render(<TaskHarness />);

  const progress = await screen.findByText('候选生成 2/3');
  fireEvent.click(progress);
  expect(screen.getByText('主方案')).toBeVisible();
  expect(screen.getByText('构图探索')).toBeVisible();
  expect(screen.getByText('视觉突破')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '重试构图探索' }));

  await waitFor(() => expect(retryDesignGenerationSlot).toHaveBeenCalledWith({ libraryId: 'workspace-1', taskId: 'design-1', slotId: 'composition' }));
  await waitFor(() => expect(screen.getAllByText('候选生成 3/3').length).toBeGreaterThan(0), { timeout: 2_000 });
  expect(within(screen.getByRole('article', { name: 'design-1' })).queryByText('排队')).not.toBeInTheDocument();
  expect(listTasks.mock.calls.length).toBeGreaterThan(1);
  expect(retryTask).not.toHaveBeenCalled();
});

it('does not offer an implicit retry for portfolio vision tasks without retained images', async () => {
  const listTasks = vi.fn(async () => [{
    id: 'task-portfolio', requestId: 'request-portfolio', state: 'failed' as const, cancelRequested: false, attempt: 1,
    source: { kind: 'designer-draft' as const, id: 'designer-draft-1' }, capability: 'vision-analysis',
    requestText: 'Portfolio analysis: source-a', errorCode: 'http',
    providerFailure: { kind: 'http' as const, status: 400, providerCode: 'invalid_image_format' },
  }]);
  const retryTask = vi.fn(async () => null);
  window.designhub = {  listTasks, retryTask };
  render(<Harness initialView="tasks" libraryId="workspace-1" />);
  await screen.findByText('失败');
  expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument();
  expect(screen.getByTitle('Portfolio analysis: source-a · 服务请求被拒绝（HTTP 400，invalid_image_format） · 请重新选择作品集来源')).toBeInTheDocument();
  expect(retryTask).not.toHaveBeenCalled();
});

it('does not offer an implicit retry for image edits without a recoverable source', async () => {
  const listTasks = vi.fn(async () => [{
    id: 'task-edit', requestId: 'request-edit', state: 'failed' as const, cancelRequested: false, attempt: 1,
    source: { kind: 'project' as const, id: 'project-1' }, capability: 'image-editing',
    requestText: '去除背景', errorCode: 'PROVIDER_REQUEST_FAILED',
  }]);
  const retryTask = vi.fn(async () => null);
  window.designhub = {  listTasks, retryTask };
  render(<Harness initialView="tasks" libraryId="workspace-1" />);
  await screen.findByText('失败');
  expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument();
  expect(screen.getByTitle('去除背景 · 请重新选择原图')).toBeInTheDocument();
  expect(retryTask).not.toHaveBeenCalled();
});
