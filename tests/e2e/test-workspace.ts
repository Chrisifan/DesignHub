import type { Page } from 'playwright/test';
import type { DesignScene } from '../../src/features/canvas/scene';

type TestWorkspaceOptions = {
  conversationConnected?: boolean;
  imageConnected?: boolean;
  failProjectCreation?: boolean;
  failProjectPackageImportOnce?: boolean;
  projectCount?: number;
};

const testProfile = {
  formatVersion: 1 as const,
  displayName: 'E2E Operator',
  avatarDataUrl: 'data:image/webp;base64,AA==',
  onboarding: { profileCompleted: true, modelStepCompleted: true },
};

const testLibrary = {
  libraryId: 'library-e2e',
  name: 'E2E Project Library',
  directory: '/tmp/designhub-e2e',
  formatVersion: 1,
  openMode: 'writable' as const,
};

/** Opens an explicit test workspace; production has no equivalent seed path. */
export const gotoTestWorkspace = async (
  page: Page,
  scene: DesignScene | null = null,
  options: TestWorkspaceOptions = {},
): Promise<void> => {
  await page.addInitScript(({ initialScene, fixtureOptions, profile, library }) => {
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
      designs: [{ id: 'design-e2e-source', projectId: 'project-e2e', assetId: 'asset-source-image', sourceTaskId: 'task-source-image', width: 800, height: 600, title: '测试图片', createdAt: '2026-09-12T00:00:00.000Z' }],
      archived: false,
  };
    let createdProjectInput: { name: string; documents?: Array<{ id: string; name: string; width: number; height: number }> } | undefined;
    let projectCoverBytes: Uint8Array | undefined;
    const projectCoverAssetId = 'asset-0123456789abcdef';
    const sourceImageAssetId = 'asset-source-image';
    const sourceImageBytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw2X7wAAAABJRU5ErkJggg=='), (character) => character.charCodeAt(0));
    const projectDesign = {
      id: 'design-e2e-source',
      projectId: project.projectId,
      assetId: sourceImageAssetId,
      sourceTaskId: 'task-source-image',
      width: 800,
      height: 600,
      title: '测试图片',
      createdAt: '2026-09-12T00:00:00.000Z',
    };
    const submittedTasks: Array<Record<string, unknown>> = [];
    let projectPackageImportAttempts = 0;
    let projectPackageImported = false;
    let selectedLibrary = localStorage.getItem('designhub.e2e.library-selected') === '1';
    (window as typeof window & { designhub?: unknown }).designhub = ({
      loadProfile: async () => structuredClone(profile),
      saveProfile: async () => structuredClone(profile),
      getProjectLibraryStatus: async () => selectedLibrary ? ({ state: 'ready', library: structuredClone(library) }) : ({ state: 'unselected' }),
      chooseProjectLibrary: async () => {
        selectedLibrary = true;
        localStorage.setItem('designhub.e2e.library-selected', '1');
        return structuredClone(library);
      },
      listActiveProjects: async () => projectPackageImported
        ? [{ ...structuredClone(project), projectId: 'project-imported', name: '导入项目' }]
        : Array.from(
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
        libraryId: library.libraryId,
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
      listProjectDesigns: async () => [structuredClone(projectDesign)],
      readAsset: async (input: { assetId: string }) => input.assetId === projectCoverAssetId
        ? projectCoverBytes ?? null
        : input.assetId === sourceImageAssetId ? sourceImageBytes.slice() : null,
      listTasks: async () => submittedTasks,
      publishCompositionCandidate: async (input: { projectId: string; documentId: string; candidate: Record<string, unknown> & { sourceTaskId: string; createdAt?: string } }) => {
        const task = {
          id: input.candidate.sourceTaskId,
          requestId: input.candidate.sourceTaskId,
          state: 'completed',
          cancelRequested: false,
          attempt: 1,
          source: { kind: 'project', id: input.projectId },
          documentId: input.documentId,
          capability: 'local-composition',
          createdAt: input.candidate.createdAt,
          result: { compositionCandidate: structuredClone(input.candidate) },
        };
        submittedTasks.push(task);
        return structuredClone(task);
      },
      resolveCompositionCandidate: async (input: { taskId: string; resolution: 'confirmed' | 'discarded' }) => {
        const task = submittedTasks.find((candidate) => candidate.id === input.taskId);
        if (!task) return null;
        task.candidateResolution = input.resolution;
        return structuredClone(task);
      },
      loadProviderConfigs: async () => ({
        'openai-compatible': {
          conversation: { baseUrl: 'https://text.example.test/v1', models: { conversation: 'chat-model', 'vision-analysis': 'vision-model' } },
          image: { baseUrl: 'https://image.example.test/v1', imageTransport: 'images', models: { 'image-generation': 'image-model', 'image-editing': 'edit-model' } },
        },
      }),
      hasCredential: async (account: string) => account === 'openai-compatible:conversation'
        ? fixtureOptions.conversationConnected ?? false
        : account === 'openai-compatible:image' ? fixtureOptions.imageConnected ?? false : false,
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
      submitImageEdit: async (input: { tool?: string }) => {
        const task = {
          id: 'task-image-edit-e2e',
          requestId: 'request-image-edit-e2e',
          requestText: input.tool ?? 'image edit',
          capability: 'image-editing',
          state: 'queued',
          cancelRequested: false,
          attempt: 1,
          source: { kind: 'project', id: project.projectId },
          tool: input.tool,
        };
        submittedTasks.splice(0, submittedTasks.length, task);
        return task;
      },
      importProjectPackage: async () => {
        projectPackageImportAttempts += 1;
        if (fixtureOptions.failProjectPackageImportOnce && projectPackageImportAttempts === 1) {
          throw new Error('PROJECT_PACKAGE_IMPORT_FAILED');
        }
        projectPackageImported = true;
        return { projectId: 'project-imported' };
      },
      loadDocumentScene: async () => initialScene,
      loadDocumentRevisions: async () => ({ revisions: [], timeline: [], finalRevisionId: null }),
      saveDocumentScene: async () => true,
    } as never);
  }, { initialScene: scene, fixtureOptions: options, profile: testProfile, library: testLibrary });
  await page.goto('/');
  await page.getByRole('button', { name: /选择项目库|Choose project library/ }).click();
  await page.getByRole('textbox', { name: /设计需求|Design request/ }).waitFor();
};

export const navigateFromUserMenu = async (page: Page, name: string | RegExp): Promise<void> => {
  await page.getByRole('button', { name: /打开用户菜单|Open user menu/ }).click();
  await page.getByRole('menuitem', { name, exact: typeof name === 'string' }).click();
  await page.waitForFunction(() => Boolean(
    document.querySelector('.destination.destination--active')
      || document.querySelector('.ui-dialog[open]')
      || document.querySelector('.ui-drawer-root .ui-dialog[open]'),
  ));
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLElement>('.studio-view-enter, .ui-drawer-root, .ui-dialog[open]')]
    .every((element) => element.getAnimations().every((animation) => animation.playState !== 'running')));
};
