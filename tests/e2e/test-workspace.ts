import type { Page } from 'playwright/test';
import type { DesignScene } from '../../src/features/canvas/scene';

type TestWorkspaceOptions = {
  conversationConnected?: boolean;
  failProjectCreation?: boolean;
  projectCount?: number;
};

/** Opens an explicit test workspace; production has no equivalent seed path. */
export const gotoTestWorkspace = async (
  page: Page,
  scene: DesignScene | null = null,
  options: TestWorkspaceOptions = {},
): Promise<void> => {
  await page.addInitScript(({ initialScene, fixtureOptions }) => {
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
    let createdProjectInput: { name: string; documents?: Array<{ id: string; name: string; width: number; height: number }> } | undefined;
    let projectCoverBytes: Uint8Array | undefined;
    const projectCoverAssetId = 'asset-0123456789abcdef';
    const submittedTasks: Array<Record<string, unknown>> = [];
    (window as typeof window & { designhub?: unknown }).designhub = ({
      chooseWorkspaceDirectory: async () => '/tmp/designhub-e2e',
      openWorkspace: async () => ({ workspaceId: 'workspace-e2e', name: '测试工作区', directory: '/tmp/designhub-e2e', formatVersion: 1, openMode: 'writable' }),
      listActiveProjects: async () => Array.from(
        { length: fixtureOptions.projectCount ?? 1 },
        (_, index) => index === 0 ? structuredClone(project) : {
          ...structuredClone(project),
          projectId: `project-e2e-${index}`,
          name: `测试项目 ${index + 1}`,
        },
      ),
      createProjectContainer: async (input: typeof createdProjectInput) => {
        if (fixtureOptions.failProjectCreation) throw new Error('PROJECT_CREATE_FAILED');
        createdProjectInput = input;
        return { projectId: 'project-created' };
      },
      importAssets: async (input: { items: Array<{ name: string; mimeType?: string; data?: Uint8Array }> }) => {
        const item = input.items[0];
        projectCoverBytes = item?.data instanceof Uint8Array ? item.data.slice() : undefined;
        return item ? [{ status: 'success', asset: { id: projectCoverAssetId, name: item.name, format: 'PNG', mimeType: item.mimeType ?? 'image/png', contentHash: '0'.repeat(64), managed: true } }] : [];
      },
      updateProjectMetadata: async (input: { projectId: string; patch: { coverAssetId?: string } }) => ({
        projectId: input.projectId,
        workspaceId: 'workspace-e2e',
        name: createdProjectInput?.name ?? project.name,
        ...input.patch,
        documents: (createdProjectInput?.documents ?? []).map((document) => ({ ...document, updatedAt: '2026-09-19T00:00:00.000Z' })),
        archived: false,
        createdAt: '2026-09-19T00:00:00.000Z',
        updatedAt: '2026-09-19T00:00:00.000Z',
      }),
      loadDesignerState: async () => ({ profiles: [paper, commerce], defaultId: 'e2e-paper', drafts: {} }),
      inspectPortfolioSources: async () => ({ id: 'inspection-e2e', candidates: [{ id: 'source-e2e', label: '作品集封面', description: '作品集封面', origin: 'local-image', previewUrl: '' }] }),
      submitPortfolioSelection: async () => ({ id: 'task-portfolio-e2e', requestId: 'request-portfolio-e2e', state: 'running', cancelRequested: false, attempt: 1 }),
      loadBrandState: async () => ({ brands: [] }),
      listAssets: async () => [],
      readAsset: async (input: { assetId: string }) => input.assetId === projectCoverAssetId ? projectCoverBytes ?? null : null,
      listTasks: async () => submittedTasks,
      hasCredential: async () => fixtureOptions.conversationConnected ?? false,
      submitConversation: async (input: { message: string; documentId?: string }) => {
        const task = {
          id: 'task-home-conversation',
          requestId: 'request-home-conversation',
          requestText: input.message,
          documentId: input.documentId,
          capability: 'conversation',
          state: 'completed',
          cancelRequested: false,
          attempt: 1,
          analysisThreadId: 'analysis-home-conversation',
          result: { text: '已完成首轮设计分析。' },
        };
        submittedTasks.splice(0, submittedTasks.length, task);
        return task;
      },
      loadDocumentScene: async () => initialScene,
      loadDocumentRevisions: async () => ({ revisions: [], timeline: [], finalRevisionId: null }),
      saveDocumentScene: async () => true,
    } as never);
  }, { initialScene: scene, fixtureOptions: options });
  await page.goto('/');
  await page.getByRole('button', { name: /打开工作区|Open workspace/ }).click();
  await page.getByRole('textbox', { name: /设计需求|Design request/ }).waitFor();
};

export const navigateFromUserMenu = async (page: Page, name: string | RegExp): Promise<void> => {
  await page.getByRole('button', { name: /打开用户菜单|Open user menu/ }).click();
  await page.getByRole('menuitem', { name, exact: typeof name === 'string' }).click();
};
