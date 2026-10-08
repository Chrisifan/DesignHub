# Analysis Envelope and Generation Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display only the analysis brief for supported provider JSON variants and restore documentless project-canvas generation without weakening document-scoped Workbench binding.

**Architecture:** Normalize provider field variants inside `parseVisualContextEnvelope` before strict validation so task state retains one canonical schema. Keep generation scope explicit at the Studio boundary: the project canvas may omit `documentId`, while Workbench derives and sends the active document ID.

**Tech Stack:** TypeScript, React, Electron IPC contracts, Vitest, Testing Library

---

## File Map

- Modify `src/features/agent/visual-context.ts`: normalize supported envelope and item field aliases.
- Modify `src/features/agent/visual-context.test.ts`: lock parser compatibility and canonical output.
- Modify `src/features/agent/task-service.test.ts`: prove task state publishes only the parsed brief.
- Modify `src/app/studio/Studio.tsx`: distinguish project-scoped generation from document-scoped generation.
- Modify `src/app/Studio.test.tsx`: cover both generation scopes and the reported documentless project path.

### Task 1: Normalize Provider Envelope Variants

**Files:**
- Modify: `src/features/agent/visual-context.ts:70-108`
- Test: `src/features/agent/visual-context.test.ts:1-120`

- [ ] **Step 1: Write the failing parser regression test**

Add this case to the `parseVisualContextEnvelope` describe block:

```ts
it('normalizes singular role and releasedAssets provider variants', () => {
  expect(parseVisualContextEnvelope(JSON.stringify({
    brief: '抠出人物并输出透明背景。',
    visualContext: {
      version: 1,
      items: [{ assetId: 'asset-person', role: 'edit-target', confidence: 0.99 }],
      clarificationRequired: false,
    },
    releasedAssets: [],
  }))).toEqual({
    brief: '抠出人物并输出透明背景。',
    visualContextPlan: {
      version: 1,
      items: [{ assetId: 'asset-person', roles: ['edit-target'], confidence: 0.99 }],
      clarificationRequired: false,
    },
    releasedAssetIds: [],
  });
});
```

- [ ] **Step 2: Run the parser test and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/features/agent/visual-context.test.ts -t 'normalizes singular role'
```

Expected: FAIL because `parseVisualContextEnvelope` returns `null`.

- [ ] **Step 3: Implement normalization before validation**

In `parseVisualContextEnvelope`, derive one canonical top-level released-assets value and normalize singular item roles:

```ts
const releasedAssetIds = isRecord(parsed)
  ? parsed.releasedAssetIds ?? parsed.releasedAssets
  : undefined;
const visualContext = isRecord(parsed) && isRecord(parsed.visualContext)
  ? {
      ...parsed.visualContext,
      items: Array.isArray(parsed.visualContext.items)
        ? parsed.visualContext.items.map((item) => {
            if (!isRecord(item)) return item;
            const roles = item.roles ?? (typeof item.role === 'string' ? [item.role] : undefined);
            const { role: _role, ...canonical } = item;
            return {
              ...canonical,
              ...(roles === undefined ? {} : { roles }),
              ...(!Object.prototype.hasOwnProperty.call(item, 'confidence') ? { confidence: 0 } : {}),
            };
          })
        : parsed.visualContext.items,
    }
  : undefined;
```

Update top-level validation to allow `releasedAssets` as an input alias, reject an envelope that supplies both aliases, validate `releasedAssetIds`, and return the canonical array. The internal return type remains unchanged.

- [ ] **Step 4: Run parser tests and verify GREEN**

Run:

```bash
npx vitest run --config vitest.config.ts src/features/agent/visual-context.test.ts
```

Expected: all tests in the file PASS.

- [ ] **Step 5: Commit the parser change**

```bash
git add src/features/agent/visual-context.ts src/features/agent/visual-context.test.ts
git commit -m "fix: normalize visual context response variants"
```

### Task 2: Prove Task State Publishes Only the Brief

**Files:**
- Test: `src/features/agent/task-service.test.ts:120-250`

- [ ] **Step 1: Write the task-service regression test**

Add a test beside the existing structured-response tests. Configure `chat` to return the variant JSON from Task 1, use one persisted attachment named `asset-person`, submit a conversation, flush the service, and assert:

```ts
expect(runtime.get(task.id)?.result?.text).toBe('抠出人物并输出透明背景。');
expect(runtime.get(task.id)?.progressText).toBe('抠出人物并输出透明背景。');
expect(runtime.get(task.id)?.visualContextPlan).toEqual({
  version: 1,
  items: [{ assetId: 'asset-person', roles: ['edit-target'], confidence: 0.99 }],
  clarificationRequired: false,
});
```

- [ ] **Step 2: Run the task-service test**

Run:

```bash
npx vitest run --config vitest.config.ts src/features/agent/task-service.test.ts -t 'publishes only the brief for provider field variants'
```

Expected: PASS after Task 1. Temporarily reverting the Task 1 normalization must make this test fail by returning raw JSON, which confirms the integration assertion covers the reported symptom.

- [ ] **Step 3: Commit the integration regression test**

```bash
git add src/features/agent/task-service.test.ts
git commit -m "test: cover provider analysis field variants"
```

### Task 3: Restore Project-Scoped Design Generation

**Files:**
- Modify: `src/app/studio/Studio.tsx:687-750`
- Test: `src/app/Studio.test.tsx:675-725`

- [ ] **Step 1: Write the failing project-canvas regression test**

Add a Studio test that loads a documentless project and a completed project-scoped analysis task:

```ts
it('generates project candidates without requiring an open document', async () => {
  const conversation = {
    id: 'conversation-project', requestId: 'request-project', state: 'completed' as const,
    cancelRequested: false, attempt: 1, capability: 'conversation' as const,
    source: { kind: 'project' as const, id: 'project-1' }, analysisThreadId: 'thread-project',
    visualContextPlan: { version: 1 as const, items: [], clarificationRequired: false },
    result: { text: '项目级设计简报' },
  };
  const submitDesignGeneration = vi.fn(async () => ({
    id: 'design-project', requestId: 'request-design', state: 'running' as const,
    cancelRequested: false, attempt: 1, capability: 'design-generation' as const,
    source: { kind: 'project' as const, id: 'project-1' }, analysisThreadId: 'thread-project',
  }));
  window.designhub = {
    listActiveProjects: async () => [{ projectId: 'project-1', name: '无文档项目', documents: [] }],
    listProjectDesigns: async () => [],
    loadProjectCanvasLayout: async () => null,
    listTasks: async () => [conversation],
    submitDesignGeneration,
    hasCredential: async () => true,
  } as never;

  render(<Studio locale="zh-CN" theme="system" library={{ libraryId: 'workspace-1', name: 'Local', directory: '/tmp/local', formatVersion: 1, openMode: 'writable' }} onLocaleChange={vi.fn()} onThemeChange={vi.fn()} onExit={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: '无文档项目' }));
  fireEvent.click(await screen.findByRole('button', { name: '生成单张' }));

  await waitFor(() => expect(submitDesignGeneration).toHaveBeenCalledWith(expect.objectContaining({
    libraryId: 'workspace-1',
    projectId: 'project-1',
    conversationTaskId: 'conversation-project',
  })));
  expect(submitDesignGeneration.mock.calls[0]![0]).not.toHaveProperty('documentId');
  expect(screen.queryByText('请先打开文档。')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the Studio regression and verify RED**

Run:

```bash
npx vitest run --config vitest.config.ts src/app/Studio.test.tsx -t 'generates project candidates without requiring an open document'
```

Expected: FAIL because the current `submitProjectDesignGeneration` guard emits `请先打开文档。` and does not call the bridge.

- [ ] **Step 3: Make generation scope explicit in Studio**

Change `submitProjectDesignGeneration` to accept an optional explicit document binding:

```ts
const submitProjectDesignGeneration = async (
  project: Project,
  conversationTaskId: string,
  baseRevisionId: string | null = null,
  generationRatio: Project['generationRatio'] = project.generationRatio ?? '3:4',
  count: 1 | 3 = 3,
  documentId?: string,
): Promise<TaskRecord | null> => {
  if (!workspace || workspace.openMode !== 'writable' || !project.libraryId) {
    notify(t(locale, '请先打开可写工作区。', 'Open a writable workspace first.'));
    return null;
  }
  if (!imageConnectionId) {
    notify(t(locale, '请先配置图片生成连接。', 'Configure an image generation connection first.'));
    return null;
  }
  try {
    const task = await getDesktopApi().submitDesignGeneration?.({
      libraryId: workspace.libraryId,
      projectId: project.id,
      ...(documentId ? { documentId } : {}),
      conversationTaskId,
      baseRevisionId,
      connectionId: imageConnectionId,
      ...(providerConfigs?.[imageConnectionId as keyof ProviderConfigMap]?.image.models['image-generation']
        ? { model: providerConfigs[imageConnectionId as keyof ProviderConfigMap]!.image.models['image-generation'] }
        : {}),
      generationRatio,
      count,
    });
    if (!task) {
      notify(t(locale, '模型连接不可用，任务未提交。', 'Model connection unavailable; task was not submitted.'));
      return null;
    }
    notify(t(locale, '设计稿生成任务已排队。', 'Design draft generation queued.'));
    return task;
  } catch {
    notify(t(locale, '设计稿生成失败，请重试。', 'Design draft generation failed; try again.'));
    return null;
  }
};
```

Remove the unconditional `documentIdForProject` lookup and "Open a document first" notification from this helper. Keep the ProjectCanvas callback project-scoped. Pass the active document binding only from Workbench:

```tsx
onSubmitDesignGeneration={(conversationTaskId, baseRevisionId, generationRatio, count) =>
  submitProjectDesignGeneration(
    project,
    conversationTaskId,
    baseRevisionId,
    generationRatio,
    count,
    activeDocumentId ?? project.documentId,
  )}
```

- [ ] **Step 4: Verify project and document generation tests**

Run:

```bash
npx vitest run --config vitest.config.ts src/app/Studio.test.tsx -t 'generates project candidates without requiring an open document|binds design generation to the open document'
```

Expected: both tests PASS. The project call omits `documentId`; the Workbench call contains `documentId: 'doc-1'`.

- [ ] **Step 5: Commit the scope fix**

```bash
git add src/app/studio/Studio.tsx src/app/Studio.test.tsx
git commit -m "fix: preserve project-level design generation"
```

### Task 4: Full Verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused regression tests**

```bash
npx vitest run --config vitest.config.ts \
  src/features/agent/visual-context.test.ts \
  src/features/agent/task-service.test.ts \
  src/app/Studio.test.tsx \
  src/app/studio/ProjectCanvas.test.tsx \
  src/app/studio/Workbench.test.tsx
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run static validation**

```bash
npm run typecheck
npm run lint
```

Expected: both commands exit 0 with no warnings.

- [ ] **Step 3: Run the complete unit suite and production build**

```bash
npm run test:unit
npm run build
```

Expected: all unit tests PASS and all renderer, main, and preload builds complete successfully. The existing bundle-size advisory may still be printed by Vite.

- [ ] **Step 4: Inspect the running application without triggering paid generation**

Open the existing documentless project and verify that the completed analysis shows only its brief and that the generation controls no longer show "Open a document first". Do not submit a live image request during this verification.
