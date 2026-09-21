# Project Generation Ratio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted project default generation ratio to the shared conversation dock and make every new design-generation task snapshot and use that ratio.

**Architecture:** Define the three allowed ratios and their pixel sizes in the project size module, persist only the ratio in project metadata, and expose a controlled selector in `ConversationDock`. The renderer passes the selected ratio to `submitDesignGeneration`; IPC and the task service validate it, clone the conversation context with the resolved dimensions, and use those immutable dimensions for placeholders, provider calls, retries, and persisted designs.

**Tech Stack:** React 19, TypeScript, Electron IPC, Vitest, CSS.

---

### Task 1: Add the canonical ratio model and project persistence

**Files:**
- Modify: `src/features/projects/size.ts`
- Modify: `src/features/projects/metadata.ts`
- Modify: `src/features/projects/metadata.test.ts`
- Modify: `src/app/studio/types.ts`

- [ ] **Step 1: Write failing ratio and metadata tests**

Add tests that require the canonical ratio resolver and metadata round-trip:

```ts
expect(resolveGenerationRatioSize('3:4')).toEqual({ width: 1080, height: 1440 });
expect(resolveGenerationRatioSize('1:1')).toEqual({ width: 1080, height: 1080 });
expect(resolveGenerationRatioSize('16:9')).toEqual({ width: 1920, height: 1080 });
expect(createProjectMetadata({ ...input, generationRatio: '1:1' }).generationRatio).toBe('1:1');
expect(updateProjectMetadata(metadata, { generationRatio: '16:9' }).generationRatio).toBe('16:9');
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```bash
pnpm exec vitest run src/features/projects/metadata.test.ts src/features/projects/size.test.ts --config vitest.config.ts
```

Expected: FAIL because the ratio type, resolver, and metadata field do not exist.

- [ ] **Step 3: Implement the canonical ratio definitions**

Add to `src/features/projects/size.ts`:

```ts
export const projectGenerationRatios = ['3:4', '1:1', '16:9'] as const;
export type ProjectGenerationRatio = typeof projectGenerationRatios[number];

const generationRatioSizes: Record<ProjectGenerationRatio, DocumentSize> = {
  '3:4': { width: 1080, height: 1440 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
};

export const isProjectGenerationRatio = (value: unknown): value is ProjectGenerationRatio =>
  typeof value === 'string' && projectGenerationRatios.includes(value as ProjectGenerationRatio);

export const resolveGenerationRatioSize = (ratio: ProjectGenerationRatio): DocumentSize =>
  ({ ...generationRatioSizes[ratio] });
```

Add `generationRatio?: ProjectGenerationRatio` to project metadata input, metadata, and patch types. Normalize missing values to `'3:4'`, reject invalid runtime values, and copy the field through create/update. Add the same optional property to the UI `Project` type.

- [ ] **Step 4: Run tests and typecheck**

```bash
pnpm exec vitest run src/features/projects/metadata.test.ts src/features/projects/size.test.ts --config vitest.config.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the model change**

```bash
git add src/features/projects/size.ts src/features/projects/size.test.ts src/features/projects/metadata.ts src/features/projects/metadata.test.ts src/app/studio/types.ts
git commit -m "feat: persist project generation ratio"
```

### Task 2: Add the controlled ratio selector to the shared conversation dock

**Files:**
- Modify: `src/app/studio/ConversationDock.tsx`
- Modify: `src/app/studio/conversation-dock.css`
- Modify: `src/app/studio/ConversationDock.test.tsx`

- [ ] **Step 1: Write the failing selector test**

Render the dock with controlled ratio props and verify order and selection:

```tsx
const onGenerationRatioChange = vi.fn();
render(<ConversationDock {...props} variant="compact" generationRatio="3:4" onGenerationRatioChange={onGenerationRatioChange} />);
const ratio = screen.getByRole('combobox', { name: '设计稿比例' });
const designer = screen.getByLabelText('设计师：未设置设计师');
expect(ratio.compareDocumentPosition(designer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
fireEvent.click(ratio);
fireEvent.click(screen.getByRole('option', { name: '1:1' }));
expect(onGenerationRatioChange).toHaveBeenCalledWith('1:1');
```

- [ ] **Step 2: Run the test and confirm failure**

```bash
pnpm exec vitest run src/app/studio/ConversationDock.test.tsx --config vitest.config.ts
```

Expected: FAIL because the ratio props and control do not exist.

- [ ] **Step 3: Implement the selector**

Add controlled props:

```ts
generationRatio: ProjectGenerationRatio;
onGenerationRatioChange: (ratio: ProjectGenerationRatio) => void;
```

Render a compact, accessible select immediately before `.conversation-dock__connection`, using `projectGenerationRatios`. The visible control shows the selected ratio and uses `aria-label` translated as `设计稿比例 / Design ratio`. Style it to match the 30px designer control, with the shared single-color translucent surface, no gradient, and a maximum width that does not crowd the send button.

- [ ] **Step 4: Run the dock tests**

```bash
pnpm exec vitest run src/app/studio/ConversationDock.test.tsx --config vitest.config.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the shared UI**

```bash
git add src/app/studio/ConversationDock.tsx src/app/studio/conversation-dock.css src/app/studio/ConversationDock.test.tsx
git commit -m "feat: add generation ratio selector"
```

### Task 3: Persist selections from home, project canvas, and editor

**Files:**
- Modify: `src/app/studio/HomeConversationComposer.tsx`
- Modify: `src/app/studio/HomeConversationComposer.test.tsx`
- Modify: `src/app/studio/StudioHome.tsx`
- Modify: `src/app/studio/types.ts`
- Modify: `src/app/studio/ProjectCanvas.tsx`
- Modify: `src/app/studio/Workbench.tsx`
- Modify: `src/app/studio/Studio.tsx`
- Modify: `src/app/Studio.test.tsx`

- [ ] **Step 1: Write failing integration-oriented component tests**

Cover these behaviors:

```ts
expect(screen.getByRole('combobox', { name: '设计稿比例' })).toHaveValue('3:4');
fireEvent.change(screen.getByRole('combobox', { name: '设计稿比例' }), { target: { value: '1:1' } });
expect(updateProjectMetadata).toHaveBeenCalledWith(expect.objectContaining({ patch: { generationRatio: '1:1' } }));
expect(createProjectContainer).toHaveBeenCalledWith(expect.objectContaining({ generationRatio: '16:9' }));
```

Also assert that a project reopened with `generationRatio: '1:1'` displays `1:1`.

- [ ] **Step 2: Run the focused UI tests and confirm failure**

```bash
pnpm exec vitest run src/app/studio/HomeConversationComposer.test.tsx src/app/Studio.test.tsx --config vitest.config.ts
```

Expected: FAIL because ratio state is not wired to project creation or metadata updates.

- [ ] **Step 3: Wire the home creation flow**

Extend `HomeConversationRequest` with:

```ts
generationRatio: ProjectGenerationRatio;
```

Keep local ratio state in `HomeConversationComposer`, default it to `'3:4'`, pass it to `ConversationDock`, and include it in `onSubmit`. In `Studio.createProjectFromHome`, pass `generationRatio` to `createProjectContainer` and copy it into the new `Project` object.

- [ ] **Step 4: Wire existing projects and the legacy editor**

Pass `selected.generationRatio ?? '3:4'` to `ProjectCanvas` and `Workbench`. Add an `onGenerationRatioChange` callback that calls the existing metadata update path:

```ts
const changeGenerationRatio = (ratio: ProjectGenerationRatio): void => {
  void updateProject({ generationRatio: ratio });
};
```

Both project-level conversation docks use the controlled project value, so switching views or reopening the workspace preserves the selection.

- [ ] **Step 5: Run focused tests and typecheck**

```bash
pnpm exec vitest run src/app/studio/HomeConversationComposer.test.tsx src/app/studio/ConversationDock.test.tsx src/app/Studio.test.tsx --config vitest.config.ts
pnpm typecheck
```

Expected: PASS for the new ratio assertions. Historical tests for removed project-detail behavior may remain excluded from the focused run.

- [ ] **Step 6: Commit renderer persistence**

```bash
git add src/app/studio/HomeConversationComposer.tsx src/app/studio/HomeConversationComposer.test.tsx src/app/studio/StudioHome.tsx src/app/studio/types.ts src/app/studio/ProjectCanvas.tsx src/app/studio/Workbench.tsx src/app/studio/Studio.tsx src/app/Studio.test.tsx
git commit -m "feat: save conversation generation ratio"
```

### Task 4: Snapshot the selected ratio in design-generation tasks

**Files:**
- Modify: `src/features/agent/task-service.ts`
- Modify: `src/features/agent/task-service.test.ts`
- Modify: `src/desktop/ipc/agent.ts`
- Modify: `src/desktop/ipc/agent.test.ts`
- Modify: `src/app/studio/Studio.tsx`
- Modify: `src/app/studio/ProjectCanvas.tsx`
- Modify: `src/app/studio/Workbench.tsx`

- [ ] **Step 1: Write failing service and IPC tests**

Submit a completed conversation context with `1080 × 1440`, then request `1:1` and assert:

```ts
expect(generateImage).toHaveBeenCalledWith(expect.objectContaining({ size: '1080x1080', count: 1 }), expect.any(AbortSignal));
expect(task.designContext?.document).toMatchObject({ width: 1080, height: 1080 });
expect(persistProjectDesigns).toHaveBeenCalledWith(expect.objectContaining({
  designs: [expect.objectContaining({ width: 1080, height: 1080 })],
}));
```

Add IPC cases that accept the three enum values and reject `4:5`, arbitrary strings, and objects.

- [ ] **Step 2: Run tests and confirm failure**

```bash
pnpm exec vitest run src/features/agent/task-service.test.ts src/desktop/ipc/agent.test.ts --config vitest.config.ts
```

Expected: FAIL because `DesignGenerationInput` does not carry a ratio.

- [ ] **Step 3: Extend and validate the generation contract**

Change the input type to:

```ts
export type DesignGenerationInput = {
  workspaceId: string;
  projectId: string;
  documentId?: string;
  conversationTaskId: string;
  baseRevisionId?: string | null;
  connectionId: string;
  generationRatio: ProjectGenerationRatio;
};
```

Use `isProjectGenerationRatio` in `isDesignGenerationInput`. In `submitDesignGeneration`, resolve the size and create a cloned context:

```ts
const generationSize = resolveGenerationRatioSize(input.generationRatio);
const generationContext = {
  ...parent.designContext,
  document: { ...parent.designContext.document, ...generationSize },
};
```

Build `requestText` and `task.designContext` from `generationContext`. Because retries read `task.designContext`, they automatically retain the original dimensions.

- [ ] **Step 4: Pass the ratio from renderer submit callbacks**

Extend the `ProjectCanvas` and `Workbench` generation callbacks with `generationRatio`. In `Studio.submitProjectDesignGeneration`, send it to `submitDesignGeneration`. Update pending project-canvas dimensions to use each generation task's `task.designContext.document` dimensions instead of the analysis task dimensions.

- [ ] **Step 5: Run service, IPC, and canvas tests**

```bash
pnpm exec vitest run src/features/agent/task-service.test.ts src/desktop/ipc/agent.test.ts src/app/studio/ProjectCanvasStage.test.tsx src/app/studio/Workbench.test.tsx --config vitest.config.ts
pnpm typecheck
```

Expected: PASS, including three parallel calls at the selected size and same-sized placeholders.

- [ ] **Step 6: Commit the generation snapshot chain**

```bash
git add src/features/agent/task-service.ts src/features/agent/task-service.test.ts src/desktop/ipc/agent.ts src/desktop/ipc/agent.test.ts src/app/studio/Studio.tsx src/app/studio/ProjectCanvas.tsx src/app/studio/Workbench.tsx
git commit -m "feat: apply project ratio to generated drafts"
```

### Task 5: Final verification

**Files:**
- Verify all files changed in Tasks 1–4.

- [ ] **Step 1: Run focused acceptance tests**

```bash
pnpm exec vitest run src/features/projects src/features/agent src/desktop/ipc/agent.test.ts src/app/studio/ConversationDock.test.tsx src/app/studio/HomeConversationComposer.test.tsx src/app/studio/ProjectCanvasStage.test.tsx src/app/studio/Workbench.test.tsx --config vitest.config.ts
```

Expected: PASS.

- [ ] **Step 2: Run static verification**

```bash
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: PASS. If full lint reports pre-existing errors in unrelated dirty files, record them and run ESLint on every file changed by this plan.

- [ ] **Step 3: Verify the user flow manually**

Start the app and confirm:

1. Ratio selector is immediately left of the designer control.
2. New projects start at `3:4`.
3. Selecting `1:1`, leaving, and reopening the project preserves `1:1`.
4. Generating creates three square animated placeholders in one row.
5. Completed designs remain square and keep their task row.
6. Changing the project to `16:9` does not resize or alter the earlier square task.

- [ ] **Step 4: Commit any final test-only corrections**

```bash
git add <only-files-changed-for-final-verification>
git commit -m "test: cover project generation ratios"
```
