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
      tags: [],
      referenceCount: 0,
      styleDna: { palette: [], typography: { zh: '', en: '' }, composition: { zh: '', en: '' }, texture: { zh: '', en: '' } },
      negativeRules: [],
      portfolioSheets: [],
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
