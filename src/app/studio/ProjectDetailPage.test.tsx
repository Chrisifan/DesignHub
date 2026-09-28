import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectDetailPage } from './ProjectDetailPage';
import type { PersonaProfile } from './personas';
import type { Project } from './types';

const project: Project = {
  id: 'project-1',
  libraryId: 'workspace-1',
  documentId: 'poster',
  name: '秋季发布会',
  enName: 'Autumn launch',
  description: '为新品发布准备一套克制、具有材质感的视觉。',
  enDescription: 'A restrained, tactile visual system for the launch.',
  designers: ['林墨'],
  activeDesignerVersionId: 'designer-1',
  contributorDesignerVersionIds: ['designer-1', 'designer-2'],
  designerSnapshot: { version: 'v3.2' },
  brandSnapshot: {
    id: 'brand-1',
    version: 'v2',
    name: 'North Star',
    logo: '',
    colorPalette: ['#111827', '#f97316'],
    fonts: ['Noto Sans SC', 'Fraunces'],
    tone: '冷静、明确',
    fixedCopy: '',
    sizes: [],
  },
  artwork: 'market',
  documents: 2,
  documentEntries: [
    { id: 'poster', name: '主海报', width: 1080, height: 1440, finalizedRevisionId: 'revision-final' },
    { id: 'square', name: '社媒方图', width: 1080, height: 1080, sourceRevisionId: 'revision-source' },
  ],
};

const profile = (id: string, zh: string, en: string, version: string): PersonaProfile => ({
  id,
  name: { zh, en },
  signature: { zh: '', en: '' },
  summary: { zh: '', en: '' },
  principle: { zh: '', en: '' },
  personaCode: id,
  version,
  status: 'published',
  artworkUrl: '',
  artworkAlt: { zh, en },
  tags: [],
  referenceCount: 0,
  styleDna: {
    palette: [],
    typography: { zh: '', en: '' },
    composition: { zh: '', en: '' },
    texture: { zh: '', en: '' },
  },
  negativeRules: [],
  portfolioSheets: [],
});

const profiles = [
  profile('designer-1', '林墨', 'Lin Mo', 'v3.2'),
  profile('designer-2', '周野', 'Zhou Ye', 'v1.0'),
];

const renderPage = (overrides: Partial<ComponentProps<typeof ProjectDetailPage>> = {}) => {
  const props: ComponentProps<typeof ProjectDetailPage> = {
    locale: 'zh-CN',
    project,
    profiles,
    projectTitle: '秋季发布会',
    activeDesignerId: 'designer-1',
    designerLabel: '林墨',
    contributorIds: ['designer-1', 'designer-2'],
    contributorLabel: '林墨 · 周野',
    onOpenDocument: vi.fn(),
    ...overrides,
  };
  const result = render(<ProjectDetailPage {...props} />);
  return { ...result, props };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProjectDetailPage', () => {
  it('groups project status and design count while keeping the summary compact', () => {
    renderPage();
    const header = screen.getByTestId('project-detail-header');

    expect(header).toContainElement(screen.getByRole('img', { name: '秋季发布会项目封面' }));
    expect(header).toContainElement(screen.getByRole('heading', { name: '秋季发布会' }));
    expect(header).toContainElement(screen.getByText(project.description));
    expect(screen.getByLabelText('项目状态与设计稿数量')).toHaveTextContent(/进行中.*2 份设计稿/);
    expect(screen.getByLabelText('项目状态与设计稿数量').querySelector('.project-detail-status-dot')).toHaveClass('project-detail-status-dot--success');
    expect(screen.queryByText('本地保存')).not.toBeInTheDocument();
    expect(within(header).queryByRole('button', { name: '打开画布' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('button', { name: '导出交付' })).not.toBeInTheDocument();
  });

  it('uses a neutral status indicator for archived projects', () => {
    renderPage({ project: { ...project, archived: true } });

    expect(screen.getByLabelText('项目状态与设计稿数量').querySelector('.project-detail-status-dot')).toHaveClass('project-detail-status-dot--neutral');
  });

  it('uses a warning status indicator for unsaved projects', () => {
    renderPage({ project: { ...project, libraryId: undefined } });

    expect(screen.getByLabelText('项目状态与设计稿数量').querySelector('.project-detail-status-dot')).toHaveClass('project-detail-status-dot--warning');
  });

  it('opens the document represented by each card and labels its revision state', () => {
    const { props } = renderPage();

    expect(screen.getByText('已定稿')).toBeInTheDocument();
    expect(screen.getByText('衍生稿')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开社媒方图' }));

    expect(props.onOpenDocument).toHaveBeenCalledWith('square', 1);
  });

  it('sizes document covers from their dimensions instead of their list position', () => {
    const { container } = renderPage({
      project: {
        ...project,
        documents: 4,
        documentEntries: [
          { id: 'portrait-a', name: '竖版 A', width: 1080, height: 1440 },
          { id: 'portrait-b', name: '竖版 B', width: 1080, height: 1440 },
          { id: 'square', name: '方图', width: 1080, height: 1080 },
          { id: 'tall', name: '长图', width: 540, height: 1440 },
        ],
      },
    });

    const sheets = Array.from(container.querySelectorAll<HTMLElement>('.project-detail-document-card__sheet'));
    expect(sheets).toHaveLength(4);
    expect(sheets[0]?.style.aspectRatio).toBe('1080 / 1440');
    expect(sheets[1]?.style.aspectRatio).toBe('1080 / 1440');
    expect(sheets[0]?.style.width).toBe(sheets[1]?.style.width);
    expect(sheets[2]?.style.aspectRatio).toBe('1080 / 1080');
    expect(Number.parseFloat(sheets[3]?.style.width ?? '')).toBeLessThan(Number.parseFloat(sheets[0]?.style.width ?? ''));
    expect(container.querySelector('[class*="document-cover--"]')).not.toBeInTheDocument();
  });

  it('localizes the conventional primary document name in English', () => {
    renderPage({ locale: 'en' });

    expect(screen.getByRole('heading', { name: 'Main poster' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open main poster' })).toBeInTheDocument();
  });

  it('keeps the empty brief state explicit', () => {
    renderPage({ project: { ...project, description: '', enDescription: '', brandSnapshot: undefined } });

    expect(screen.getByText('暂无项目简介')).toBeInTheDocument();
  });

  it('keeps the brief and designer rows explicit when project metadata is missing', () => {
    renderPage({
      project: { ...project, description: '', enDescription: '' },
      activeDesignerId: '',
      designerLabel: '',
      contributorIds: [],
      contributorLabel: '',
    });

    expect(screen.getByText('暂无项目简介')).toBeInTheDocument();
    expect(screen.getByText('未设置设计师')).toBeInTheDocument();
  });

  it('does not render an unusable primary action without documents', () => {
    renderPage({ project: { ...project, documents: 0, documentId: undefined, documentEntries: [] } });

    expect(screen.queryByRole('button', { name: '打开画布' })).not.toBeInTheDocument();
    expect(screen.getByText('暂无设计文档')).toBeInTheDocument();
  });

  it('uses the full page width for design documents without a project-information sidebar', () => {
    renderPage();

    expect(screen.getByTestId('project-detail-page')).toHaveClass('project-detail-page');
    expect(screen.getByTestId('project-detail-hero')).toHaveClass('project-detail-hero');
    expect(screen.getByTestId('project-detail-layout')).toHaveClass('project-detail-layout--documents-only');
    expect(screen.getByRole('region', { name: '设计文档' })).toHaveClass('project-detail-documents--full');
    expect(screen.queryByRole('complementary', { name: '项目信息' })).not.toBeInTheDocument();
    expect(screen.queryByText('项目上下文')).not.toBeInTheDocument();
    expect(screen.queryByText('设计协作')).not.toBeInTheDocument();
    expect(screen.queryByText('品牌快照')).not.toBeInTheDocument();
    expect(screen.queryByText('本地')).not.toBeInTheDocument();
  });
});
