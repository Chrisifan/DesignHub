import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';

import type { Locale } from '../i18n';
import { LibraryPages } from './LibraryPages';
import type { Project, Theme, View } from './types';
import type { ExportHistoryRecord } from '../../features/delivery/export-history';

const Harness = ({
  initialView = 'designers',
  deliveryProject,
  workspaceId,
  projectId,
  onAssetAction,
}: {
  initialView?: Exclude<View, 'projects'>;
  deliveryProject?: Project | null;
  workspaceId?: string;
  projectId?: string;
  onAssetAction?: (input: { assetId: string; mode: 'place' | 'reference' | 'replace'; projectId?: string }) => void;
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
          onAssetAction={onAssetAction}
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

it('keeps external asset references visibly unmanaged in project details', async () => {
  window.designhub = { chooseWorkspaceDirectory: async () => null, listAssets: vi.fn(async () => [{
    id: 'asset-external', name: '参考链接', format: 'PNG' as const, mimeType: 'image/png',
    contentHash: 'abcdef'.padEnd(64, '0'), managed: false, externalReference: 'https://example.com/ref.png',
  }]) };
  render(<Harness initialView="assets" workspaceId="workspace-1" projectId="project-1" />);

  fireEvent.click(await screen.findByRole('button', { name: /参考链接/ }));
  const details = screen.getByLabelText('素材详情');
  expect(within(details).getAllByText('外部引用').length).toBeGreaterThan(0);
  expect(within(details).queryByText('受管副本')).not.toBeInTheDocument();
});

it('exposes explicit asset placement actions from project details', async () => {
  const onAssetAction = vi.fn();
  window.designhub = { chooseWorkspaceDirectory: async () => null, listAssets: vi.fn(async () => [{
    id: 'asset-action', name: '可用原图', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'a'.repeat(64), managed: true,
  }]) };
  render(<Harness initialView="assets" workspaceId="workspace-1" projectId="project-1" onAssetAction={onAssetAction} />);
  const details = await screen.findByLabelText('素材详情');
  fireEvent.click(within(details).getByRole('button', { name: '放入画布' }));
  expect(onAssetAction).toHaveBeenCalledWith({ assetId: 'asset-action', mode: 'place', projectId: 'project-1' });
  fireEvent.click(within(details).getByRole('button', { name: '作为参考' }));
  expect(onAssetAction).toHaveBeenCalledWith({ assetId: 'asset-action', mode: 'reference', projectId: 'project-1' });
  fireEvent.click(within(details).getByRole('button', { name: '替换选中图像' }));
  expect(onAssetAction).toHaveBeenCalledWith({ assetId: 'asset-action', mode: 'replace', projectId: 'project-1' });
});

it('loads managed asset bytes for the selected workspace preview', async () => {
  const readAsset = vi.fn(async () => new Uint8Array([137, 80, 78, 71]));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listAssets: vi.fn(async () => [{ id: 'asset-managed', name: '原图', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'a'.repeat(64), managed: true }]), readAsset };
  render(<Harness initialView="assets" workspaceId="workspace-1" projectId="project-1" />);
  await waitFor(() => expect(readAsset).toHaveBeenCalledWith({ workspaceId: 'workspace-1', projectId: 'project-1', assetId: 'asset-managed' }));
});

it('imports dropped files for a workspace project', async () => {
  const importAssets = vi.fn(async () => [{ status: 'success' as const, asset: { id: 'asset-drop', name: 'drop.png', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'd'.repeat(64), managed: true } }]);
  window.designhub = { chooseWorkspaceDirectory: async () => null, listAssets: vi.fn(async () => []), importAssets };
  render(<Harness initialView="assets" workspaceId="workspace-1" projectId="project-1" />);
  const file = new File(['png'], 'drop.png', { type: 'image/png' });
  fireEvent.drop(screen.getByLabelText('素材导入区域'), { dataTransfer: { files: [file] } });
  await waitFor(() => expect(importAssets).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'workspace-1', projectId: 'project-1', items: [expect.objectContaining({ name: 'drop.png', mimeType: 'image/png' })] })));
});

it('imports an image pasted from the clipboard for a workspace project', async () => {
  const importAssets = vi.fn(async () => [{ status: 'success' as const, asset: { id: 'asset-paste', name: 'clipboard.png', format: 'PNG' as const, mimeType: 'image/png', contentHash: 'p'.repeat(64), managed: true } }]);
  window.designhub = { chooseWorkspaceDirectory: async () => null, listAssets: vi.fn(async () => []), importAssets };
  render(<Harness initialView="assets" workspaceId="workspace-1" projectId="project-1" />);
  const file = new File(['png'], '', { type: 'image/png' });
  fireEvent.paste(screen.getByLabelText('素材导入区域'), { clipboardData: { files: [file] } });
  await waitFor(() => expect(importAssets).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ name: 'clipboard.png', mimeType: 'image/png' })] })));
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

it('hydrates a workspace brand library and persists create/edit/delete actions', async () => {
  const loadBrandState = vi.fn(async () => ({ brands: [{ id: 'local', name: '本地品牌', version: 'v1', logo: 'mark', colorPalette: ['#000'], fonts: ['Geist'], tone: '清晰', fixedCopy: '开始', sizes: ['1080x1080'] }] }));
  const saveBrandState = vi.fn(async () => true);
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadBrandState, saveBrandState };
  render(<Harness initialView="brands" workspaceId="workspace-1" />);
  expect(await screen.findByRole('heading', { name: '本地品牌' })).toBeInTheDocument();
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

it('exposes WebP alongside the supported delivery formats', () => {
  const project: Project = { id: 'webp-project', workspaceId: 'workspace-1', documentId: 'doc-1', name: 'WebP 项目', enName: 'WebP project', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 1 };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  expect(screen.getByRole('button', { name: 'WEBP' })).toBeInTheDocument();
});

it('lets delivery explicitly export the finalized document revision', async () => {
  const loadDocumentRevisions = vi.fn(async () => ({ revisions: [{ revisionId: 'revision-final', projectId: 'final-project', documentId: 'doc-1', parentRevisionId: null, operationId: 'op-final', sceneAssetId: 'scene-final', assetIds: [], contributions: [], createdAt: '2026-09-12T00:00:00.000Z', scene: { id: 'scene-final', version: 1 as const, width: 100, height: 100, layers: [] } }], timeline: [], finalRevisionId: 'revision-final' }));
  const loadDocumentScene = vi.fn(async () => ({ id: 'scene-current', version: 1 as const, width: 100, height: 100, layers: [] }));
  const exportDocument = vi.fn(async () => ({ path: '/tmp/final.png', sha256: 'a'.repeat(64) }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDocumentRevisions, loadDocumentScene, exportDocument };
  const project: Project = { id: 'final-project', workspaceId: 'workspace-1', documentId: 'doc-1', name: '定稿项目', enName: 'Final project', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 1, documentEntries: [{ id: 'doc-1', name: '主海报', width: 100, height: 100, finalizedRevisionId: 'revision-final' }] };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  fireEvent.change(screen.getByRole('combobox', { name: '来源' }), { target: { value: 'final' } });
  fireEvent.click(screen.getByRole('button', { name: '导出' }));
  await waitFor(() => expect(exportDocument).toHaveBeenCalledWith(expect.objectContaining({ scene: expect.objectContaining({ id: 'scene-final' }) })));
  expect(loadDocumentRevisions).toHaveBeenCalledWith('workspace-1', 'final-project', 'doc-1');
  expect(loadDocumentScene).not.toHaveBeenCalled();
});

it('lets delivery select another document in a multi-document project', async () => {
  const loadDocumentScene = vi.fn(async (_workspaceId: string, _projectId: string, documentId: string) => ({ id: `scene-${documentId}`, version: 1 as const, width: 100, height: 100, layers: [] }));
  const exportDocument = vi.fn(async () => ({ path: '/tmp/second.png', sha256: 'b'.repeat(64) }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDocumentScene, exportDocument };
  const project: Project = { id: 'multi-project', workspaceId: 'workspace-1', documentId: 'doc-1', name: '多文档项目', enName: 'Multi document', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 2, documentEntries: [{ id: 'doc-1', name: '主海报', width: 100, height: 100 }, { id: 'doc-2', name: '方图', width: 100, height: 100 }] };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  fireEvent.change(screen.getByRole('combobox', { name: '文档' }), { target: { value: 'doc-2' } });
  fireEvent.click(screen.getByRole('button', { name: '导出' }));
  await waitFor(() => expect(exportDocument).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'doc-2', scene: expect.objectContaining({ id: 'scene-doc-2' }) })));
  expect(loadDocumentScene).toHaveBeenCalledWith('workspace-1', 'multi-project', 'doc-2');
});

it('offers finalized export for the selected non-primary document', () => {
  const project: Project = {
    id: 'multi-final-project',
    workspaceId: 'workspace-1',
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
  const loadDocumentScene = vi.fn(async () => ({ id: 'scene-current', version: 1 as const, width: 100, height: 100, layers: [] }));
  const exportDocument = vi.fn(async () => ({ path: '/tmp/archive.png', sha256: 'c'.repeat(64) }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDocumentScene, exportDocument };
  const project: Project = { id: 'archive-project', workspaceId: 'workspace-1', documentId: 'doc-1', name: '归档项目', enName: 'Archive project', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 1, documentEntries: [{ id: 'doc-1', name: '主海报', width: 100, height: 100 }] };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '导出' }));
  await waitFor(() => expect(exportDocument).toHaveBeenCalledWith(expect.objectContaining({ archiveCopy: true })));
});

it('shows persisted export history for a project', async () => {
  window.designhub = {
    chooseWorkspaceDirectory: async () => null,
    listExportHistory: vi.fn(async (): Promise<ExportHistoryRecord[]> => [{
      id: 'export-1', projectId: 'history-project', documentId: 'doc-1', revisionId: 'revision-1', format: 'png',
      targetPath: '/tmp/poster.png', sha256: 'a'.repeat(64), status: 'success', archived: false, createdAt: '2026-09-13T00:00:00.000Z',
    }]),
  };
  const project: Project = { id: 'history-project', workspaceId: 'workspace-1', documentId: 'doc-1', name: '历史项目', enName: 'History project', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 1 };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  await waitFor(() => expect(screen.getByText('PNG · revision-1')).toBeInTheDocument());
  expect(screen.getByText('成功')).toBeInTheDocument();
});

it('reports an archive copy failure while retaining the external export result', async () => {
  const loadDocumentScene = vi.fn(async () => ({ id: 'scene-current', version: 1 as const, width: 100, height: 100, layers: [] }));
  const exportDocument = vi.fn(async () => ({ path: '/tmp/archive.png', sha256: 'd'.repeat(64), archived: false, archiveError: 'TARGET_EXISTS' }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadDocumentScene, exportDocument };
  const project: Project = { id: 'archive-failure-project', workspaceId: 'workspace-1', documentId: 'doc-1', name: '归档失败', enName: 'Archive failure', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 1, documentEntries: [{ id: 'doc-1', name: '主海报', width: 100, height: 100 }] };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '导出' }));
  await waitFor(() => expect(screen.getByText(/归档副本失败/)).toBeInTheDocument());
  expect(screen.getByText(/可重试/)).toBeInTheDocument();
});

it('offers project package export for persisted projects', async () => {
  const exportProjectPackage = vi.fn(async () => ({ path: '/tmp/project.zip', sha256: 'a'.repeat(64) }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, exportProjectPackage };
  const project: Project = { id: 'project-1', workspaceId: 'workspace-1', documentId: 'doc-1', name: '项目', enName: 'Project', description: 'desc', enDescription: 'desc', designers: ['纸感排版'], artwork: 'blank', documents: 1 };
  render(<Harness initialView="delivery" deliveryProject={project} />);
  fireEvent.click(screen.getByRole('button', { name: '导出项目包' }));
  await waitFor(() => expect(exportProjectPackage).toHaveBeenCalledWith({ workspaceId: 'workspace-1', projectId: 'project-1' }));
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

it('loads workspace trash entries and restores them through the desktop bridge', async () => {
  const listTrashedProjects = vi.fn(async () => [{ projectId: 'project-1', originalRelativePath: 'projects/project-1', deletedAt: '2026-09-12T00:00:00.000Z' }]);
  const restoreProjectFromTrash = vi.fn(async () => ({ projectId: 'project-1', restoredRelativePath: 'projects/project-1' }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, listTrashedProjects, restoreProjectFromTrash };
  render(<Harness initialView="storage" workspaceId="workspace-1" />);

  expect(await screen.findByText('project-1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '恢复' }));
  await waitFor(() => expect(restoreProjectFromTrash).toHaveBeenCalledWith({ workspaceId: 'workspace-1', projectId: 'project-1' }));
  expect(await screen.findByText('废纸篓为空')).toBeInTheDocument();
});

it('persists backup destination and schedule per workspace', async () => {
  const createWorkspaceBackup = vi.fn(async () => ({ directory: '/Volumes/Backups/workspace-1-2026.designhub-backup', workspaceId: 'workspace-1', createdAt: '2026-09-13T12:00:00.000Z' }));
  localStorage.setItem('designhub.backup.workspace-1', JSON.stringify({ destinationParentDirectory: '/Volumes/Backups', schedule: 'daily', lastRunAt: null, lastArtifactPath: null }));
  window.designhub = { chooseWorkspaceDirectory: async () => null, createWorkspaceBackup };
  render(<Harness initialView="storage" workspaceId="workspace-1" />);
  fireEvent.click(screen.getByRole('button', { name: '备份' }));
  expect(screen.getByRole('combobox', { name: '备份周期' })).toHaveValue('daily');
  expect(screen.getByText('/Volumes/Backups')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: '备份周期' }), { target: { value: 'weekly' } });
  expect(JSON.parse(localStorage.getItem('designhub.backup.workspace-1') ?? '{}')).toMatchObject({ schedule: 'weekly' });
  fireEvent.click(screen.getByRole('button', { name: '创建备份' }));
  await waitFor(() => expect(createWorkspaceBackup).toHaveBeenCalledWith('workspace-1', '/Volumes/Backups'));
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
  window.designhub = { chooseWorkspaceDirectory: async () => null, loadWorkspaceSettings, saveWorkspaceSettings };
  render(<Harness initialView="storage" workspaceId="workspace-1" />);
  fireEvent.click(screen.getByRole('button', { name: '备份' }));
  expect(await screen.findByText('/WorkspaceBackups')).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: '备份周期' })).toHaveValue('weekly');
  fireEvent.change(screen.getByRole('combobox', { name: '备份周期' }), { target: { value: 'daily' } });
  await waitFor(() => expect(saveWorkspaceSettings).toHaveBeenCalledWith('workspace-1', expect.objectContaining({ formatVersion: 1, backup: expect.objectContaining({ schedule: 'daily' }) })));
});

it('exports a redacted diagnostics preview through the desktop bridge', async () => {
  const exportDiagnostics = vi.fn(async () => '/tmp/designhub-diagnostics.json');
  window.designhub = { chooseWorkspaceDirectory: async () => null, exportDiagnostics };
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
  window.designhub = { chooseWorkspaceDirectory: async () => null, listTasks };
  render(<Harness initialView="tasks" workspaceId="workspace-1" />);
  expect((await screen.findAllByText('处理中')).length).toBeGreaterThan(0);
  expect(screen.getAllByText('1')).toHaveLength(2);
  expect(listTasks).toHaveBeenCalledWith('workspace-1');
  expect(screen.getByText('2 张图')).toBeInTheDocument();
});

it('lets a running task be stopped through the desktop bridge', async () => {
  const listTasks = vi.fn(async () => [{
    id: 'task-1', requestId: 'request-1', state: 'running' as const, cancelRequested: false, attempt: 1,
    source: { kind: 'project' as const, id: 'project-1' },
  }]);
  const cancelTask = vi.fn(async () => true);
  window.designhub = { chooseWorkspaceDirectory: async () => null, listTasks, cancelTask };
  render(<Harness initialView="tasks" workspaceId="workspace-1" />);
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
  window.designhub = { chooseWorkspaceDirectory: async () => null, listTasks, retryTask };
  render(<Harness initialView="tasks" workspaceId="workspace-1" />);
  await screen.findByText('失败');
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await waitFor(() => expect(retryTask).toHaveBeenCalledWith('workspace-1', 'task-1'));
  expect((await screen.findAllByText('处理中')).length).toBeGreaterThan(0);
  expect(screen.getByText('2')).toBeInTheDocument();
});
