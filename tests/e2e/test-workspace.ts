import type { Page } from 'playwright/test';

/** Opens an explicit test workspace; production has no equivalent seed path. */
export const gotoTestWorkspace = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const paper = {
      id: 'e2e-paper',
      name: { zh: '纸感排版', en: 'Paper & Type' },
      signature: { zh: '测试署名', en: 'Test signature' },
      summary: { zh: '测试工作区档案', en: 'Test workspace profile' },
      principle: { zh: '先建立文字层级', en: 'Build type hierarchy first' },
      personaCode: 'E2E-A',
      version: 'v1.0',
      status: 'published',
      artworkUrl: '',
      artworkAlt: { zh: '纸感排版', en: 'Paper & Type' },
      tags: [
        { zh: '编辑网格', en: 'Editorial grid' },
        { zh: '纸张质感', en: 'Paper texture' },
      ],
      referenceCount: 0,
      styleDna: {
        palette: ['#F4EFE7', '#24262B', '#8C7057'],
        typography: { zh: '衬线标题与紧凑说明', en: 'Serif titles with compact copy' },
        composition: { zh: '窄栏对齐与明确基线', en: 'Narrow columns and clear baseline' },
        texture: { zh: '纸纤维与低对比颗粒', en: 'Paper fiber and low-contrast grain' },
        signals: {
          contrast: 68,
          darkAiriness: 82,
          whitespace: 38,
          grain: 15,
          diffuseLight: 92,
          typeFamily: { zh: '衬线倾向', en: 'Serif tendency' },
          typeWeight: { zh: '半粗体', en: 'Semibold' },
          tracking: { zh: '紧凑', en: 'Compact' },
          compositionTopology: { zh: '非对称垂直流', en: 'Asymmetric vertical flow' },
          rendering: { zh: '纸张漫反射', en: 'Paper diffusion' },
        },
      },
      negativeRules: [{
        zh: '避免使用会破坏安全边距、信息层级与主体识别度的霓虹渐变、高强度装饰效果以及复杂背景纹理',
        en: 'Avoid neon gradients, intense decoration, and complex backgrounds that harm safe margins, hierarchy, or subject clarity',
      }],
      portfolioSheets: [{
        id: 'e2e-sheet',
        artwork: 'market',
        title: { zh: '春生特刊', en: 'Spring issue' },
        note: { zh: '编辑展览海报', en: 'Editorial exhibition poster' },
      }],
    };
    const commerce = {
      ...paper,
      id: 'e2e-commerce',
      name: { zh: '清晰商业', en: 'Clear Commerce' },
      principle: { zh: '让商品先被看见', en: 'Let the product lead' },
      personaCode: 'E2E-B',
    };
    const project = {
      projectId: 'project-e2e',
      name: '春间市集',
      brief: '测试项目',
      activeDesignerVersionId: 'e2e-paper',
      contributorDesignerVersionIds: ['e2e-paper'],
      designerSnapshot: structuredClone(paper),
      documents: [{ id: 'doc-e2e', name: '主海报', width: 1080, height: 1440, updatedAt: '2026-09-12T00:00:00.000Z' }],
      archived: false,
    };
    (window as typeof window & { designhub?: unknown }).designhub = ({
      chooseWorkspaceDirectory: async () => '/tmp/designhub-e2e',
      openWorkspace: async () => ({ workspaceId: 'workspace-e2e', name: '测试工作区', directory: '/tmp/designhub-e2e', formatVersion: 1, openMode: 'writable' }),
      listActiveProjects: async () => [project],
      createProjectContainer: async () => ({ projectId: 'project-created' }),
      loadDesignerState: async () => ({ profiles: [paper, commerce], defaultId: 'e2e-paper', drafts: {} }),
      inspectPortfolioSources: async () => ({ id: 'inspection-e2e', candidates: [{ id: 'source-e2e', label: '作品集封面', description: '作品集封面', origin: 'local-image', previewUrl: '' }] }),
      submitPortfolioSelection: async () => ({ id: 'task-portfolio-e2e', requestId: 'request-portfolio-e2e', state: 'running', cancelRequested: false, attempt: 1 }),
      loadBrandState: async () => ({ brands: [] }),
      listAssets: async () => [],
      listTasks: async () => [],
      hasCredential: async () => false,
      loadDocumentScene: async () => null,
      loadDocumentRevisions: async () => ({ revisions: [], timeline: [], finalRevisionId: null }),
      saveDocumentScene: async () => true,
    } as never);
  });
  await page.goto('/');
  await page.getByRole('button', { name: /打开工作区|Open workspace/ }).click();
  await page.getByRole('navigation', { name: /主导航|Main navigation/ }).waitFor();
};
