import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectDetailPage } from './ProjectDetailPage';
import type { PersonaProfile } from './personas';
import type { Project } from './types';

const project: Project = {
  id: 'project-1',
  workspaceId: 'workspace-1',
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
    writable: true,
    projectTitle: '秋季发布会',
    activeDesignerId: 'designer-1',
    designerLabel: '林墨',
    contributorIds: ['designer-1', 'designer-2'],
    contributorLabel: '林墨 · 周野',
    onOpenDocument: vi.fn(),
    onExport: vi.fn(),
    onCreateDocument: vi.fn(),
    onSwitchDesigner: vi.fn(),
    onToggleContributor: vi.fn(),
    ...overrides,
  };
  const result = render(<ProjectDetailPage {...props} />);
  return { ...result, props };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProjectDetailPage', () => {
  it('groups the cover and project summary into one compact header card', () => {
    const { props } = renderPage();
    const header = screen.getByTestId('project-detail-header');

    expect(header).toContainElement(screen.getByRole('img', { name: '秋季发布会项目封面' }));
    expect(header).toContainElement(screen.getByRole('heading', { name: '秋季发布会' }));
    expect(header).toContainElement(screen.getByText(project.description));
    expect(screen.getByText('2 份文档')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '打开画布' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '打开画布' }));

    expect(props.onOpenDocument).toHaveBeenCalledWith('poster', 0);
  });

  it('opens the document represented by each card and labels its revision state', () => {
    const { props } = renderPage();

    expect(screen.getByText('已定稿')).toBeInTheDocument();
    expect(screen.getByText('衍生稿')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开社媒方图' }));

    expect(props.onOpenDocument).toHaveBeenCalledWith('square', 1);
  });

  it('localizes the conventional primary document name in English', () => {
    renderPage({ locale: 'en' });

    expect(screen.getByRole('heading', { name: 'Main poster' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open main poster' })).toBeInTheDocument();
  });

  it('shows real brand fields for a valid snapshot', () => {
    renderPage();

    expect(screen.getByText('North Star')).toBeInTheDocument();
    expect(screen.getByText('Noto Sans SC · Fraunces')).toBeInTheDocument();
    expect(screen.getByText('冷静、明确')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(document.querySelectorAll('.project-detail-brand-swatch')).toHaveLength(2);
  });

  it('keeps empty brief and brand states explicit', () => {
    renderPage({ project: { ...project, description: '', enDescription: '', brandSnapshot: undefined } });

    expect(screen.getByText('暂无项目简介')).toBeInTheDocument();
    expect(screen.getByText('未附加品牌包')).toBeInTheDocument();
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

  it('shows editing controls only for a writable saved project', () => {
    const { props } = renderPage();

    fireEvent.click(screen.getByRole('button', { name: '新建设计稿' }));
    expect(props.onCreateDocument).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('设计师')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /周野/ })).toBeInTheDocument();
  });

  it('hides editing controls for a read-only project', () => {
    renderPage({ writable: false });

    expect(screen.queryByRole('button', { name: '新建设计稿' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('设计师')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('exposes the approved layout regions without nested horizontal scrollers', () => {
    renderPage();

    expect(screen.getByTestId('project-detail-page')).toHaveClass('project-detail-page');
    expect(screen.getByTestId('project-detail-hero')).toHaveClass('project-detail-hero');
    expect(screen.getByTestId('project-detail-layout')).toHaveClass('project-detail-layout');
    expect(screen.getByRole('region', { name: '设计文档' })).toHaveClass('project-detail-documents');
    expect(screen.getByRole('complementary', { name: '项目信息' })).toHaveClass('project-detail-sidebar');
  });
});
