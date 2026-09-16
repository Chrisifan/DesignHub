# Model Task List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the model-task summary with toolbar category filters and a compact, non-wrapping task list.

**Architecture:** Keep loaded task records and the selected task category local to `TasksPage`. Derive category counts and visible records from those records, render the category control through the existing `PageToolbarSlot`, and convert each task to named single-line cells. CSS owns overflow, responsive horizontal scrolling, and end-aligned actions; no desktop IPC or task-state contracts change.

**Tech Stack:** React 19, TypeScript, Vitest with Testing Library, CSS custom properties.

---

## File structure

- Modify: `src/app/studio/LibraryPages.tsx` — pass toolbar activity into `TasksPage`; derive task categories, labels, summaries, metadata, and end actions; replace the summary cards with toolbar filters and compact rows.
- Modify: `src/app/studio/library.css` — remove summary-card rules and add one-line task list grid, truncation, horizontal overflow, responsive sizing, and action alignment.
- Modify: `src/app/studio/LibraryPages.test.tsx` — import `TaskRecord`; assert toolbar filtering/counts, removal of the old summary, the compact row contract, and preserved stop/retry behavior.

### Task 1: Lock the task-list contract with tests

**Files:**
- Modify: `src/app/studio/LibraryPages.test.tsx:542-634`

- [ ] **Step 1: Add a task fixture helper and a toolbar host test wrapper**

At the test-file imports, add `PageToolbarHost` and `PageToolbarProvider` from `./PageToolbar`. Add a helper before the task tests so every fixture has the required state fields:

```tsx
const taskRecord = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: 'task-1',
  requestId: 'request-1',
  state: 'completed',
  cancelRequested: false,
  attempt: 1,
  ...overrides,
});

const TaskHarness = ({ workspaceId = 'workspace-1' }: { workspaceId?: string }) => (
  <PageToolbarProvider>
    <PageToolbarHost />
    <Harness initialView="tasks" workspaceId={workspaceId} />
  </PageToolbarProvider>
);
```

- [ ] **Step 2: Add the failing category-toolbar and single-line row test**

Append a test that gives `listTasks` one queued, one running, one completed, one failed, and one cancelled task. Include a deliberately long completed `requestText` and a failed provider error. After rendering `TaskHarness`, assert the toolbar's `任务状态` group contains `全部`, `排队`, `处理中`, `已完成`, and `失败` buttons with counts; click `失败` and assert only the failed/cancelled task rows remain. Assert no `.task-summary` exists, the long summary's element has class `task-row__summary` and its `title` equals the complete text, and every task row contains named content cells.

```tsx
expect(screen.queryByText('本次会话')).not.toBeInTheDocument();
expect(document.querySelector('.task-summary')).toBeNull();
fireEvent.click(screen.getByRole('button', { name: /失败 2/ }));
expect(screen.getByRole('article', { name: 'task-failed' })).toBeInTheDocument();
expect(screen.getByRole('article', { name: 'task-cancelled' })).toBeInTheDocument();
expect(screen.queryByRole('article', { name: 'task-completed' })).not.toBeInTheDocument();
expect(screen.getByText(longRequest)).toHaveClass('task-row__summary');
expect(screen.getByText(longRequest)).toHaveAttribute('title', longRequest);
```

- [ ] **Step 3: Add focused action and empty-filter expectations**

Extend the existing running/failed task tests so they render `TaskHarness`, find compact icon buttons by their existing localized labels, and continue to assert the desktop bridge receives the task ID. Update the hydration test's count assertions to scope numeric counts to the `任务状态` toolbar group, since the old summary cards no longer exist. Add a test which selects an empty category and expects the page-level empty state title `没有匹配任务` while the selected toolbar filter remains pressed.

```tsx
fireEvent.click(screen.getByRole('button', { name: '排队 0' }));
expect(screen.getByRole('heading', { name: '没有匹配任务' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: '排队 0' })).toHaveAttribute('aria-pressed', 'true');
```

- [ ] **Step 4: Run the focused test to verify it fails**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx`

Expected: FAIL because the old task summary remains, no `任务状态` toolbar group is rendered, and task rows do not expose compact-cell classes.

- [ ] **Step 5: Commit the red tests**

```bash
git add src/app/studio/LibraryPages.test.tsx
git commit -m "test: cover compact model task list"
```

### Task 2: Implement task categories and compact task rows

**Files:**
- Modify: `src/app/studio/LibraryPages.tsx:754-874`
- Modify: `src/app/studio/LibraryPages.tsx:1709`

- [ ] **Step 1: Add task-view state, classification, and localized presentation helpers**

Inside `TasksPage`, accept `active: boolean`, add `const [category, setCategory] = useState<TaskCategory>('all')`, and define the category union near the other local types:

```tsx
type TaskCategory = 'all' | 'queued' | 'running' | 'completed' | 'failed';
```

Derive category counts from `tasks`, treating `failed`, `cancelled`, and `RESULT_UNKNOWN_AFTER_RESTART` records as the `failed` category. Derive `visibleTasks` from the selected category. Extract local helpers that return the existing localized status label and badge tone, a summary string with provider failure/reselection guidance folded into it, and a metadata string joining `updatedAt ?? createdAt`, image count, and cost only when present.

```tsx
const matchesCategory = (task: TaskRecord, value: TaskCategory): boolean => {
  if (value === 'all') return true;
  if (value === 'failed') return task.state === 'failed'
    || task.state === 'cancelled'
    || task.errorCode === 'RESULT_UNKNOWN_AFTER_RESTART';
  return task.state === value;
};
const visibleTasks = tasks.filter((task) => matchesCategory(task, category));
```

- [ ] **Step 2: Render the active toolbar category segment and remove local summary cards**

Immediately after `PageHeader`, render the task page's existing toolbar portal, then delete `.task-summary` JSX and the queued/running-only counters. Use the standard segmented pattern, ordered `全部 → 排队 → 处理中 → 已完成 → 失败`, with a count `<span>` on every button.

```tsx
<PageToolbarSlot active={active}>
  <div className="toolbar-segmented" role="group" aria-label={t(locale, '任务状态', 'Task status')}>
    {taskCategories.map((option) => (
      <button
        type="button"
        key={option.value}
        className={category === option.value ? 'is-active' : ''}
        aria-pressed={category === option.value}
        onClick={() => setCategory(option.value)}
      >
        {option.label}<span>{taskCounts[option.value]}</span>
      </button>
    ))}
  </div>
</PageToolbarSlot>
```

- [ ] **Step 3: Replace stacked task content with an accessible one-line record**

Map `visibleTasks` instead of `tasks`. Give each article `aria-label={task.id}` and render only named cells: `task-row__type`, `task-row__state`, `task-row__summary`, `task-row__meta`, and `task-row__actions`. Give text cells their complete string in `title`. Use `IconButton` instead of text `Button` for stop/retry; preserve the same cancel/retry callbacks and only render retry for the existing recoverable cases.

```tsx
<article className="task-row" aria-label={task.id} key={task.id}>
  <strong className="task-row__cell task-row__type" title={capability}>{capability}</strong>
  <span className="task-row__cell task-row__state"><Badge tone={taskTone(task)}>{taskStateLabel(task)}</Badge></span>
  <span className="task-row__cell task-row__summary" title={summary}>{summary}</span>
  <span className="task-row__cell task-row__meta" title={metadata}>{metadata}</span>
  <span className="task-row__actions">
    {canStop && <IconButton name="x" label={t(locale, '停止', 'Stop')} onClick={() => { void stopTask(task.id); }} />}
    {canRetry && <IconButton name="rotate-ccw" label={t(locale, '重试', 'Retry')} onClick={() => { void retryTask(task.id); }} />}
  </span>
</article>
```

When `tasks` is nonempty but `visibleTasks` is empty, render `page-empty-state` with `没有匹配任务 / No matching tasks`. Preserve the existing unfiltered no-task state and connection button.

- [ ] **Step 4: Thread toolbar activation into the task page**

Replace the task-page entry in `pages` with:

```tsx
tasks: <TasksPage locale={locale} navigate={navigate} workspaceId={workspaceId} active={active} />,
```

Update the `TasksPage` prop type to include `active` so its controls portal only when the tasks destination is currently visible.

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx`

Expected: PASS, including toolbar filtering, compact rows, failure guidance, stop, and retry coverage.

- [ ] **Step 6: Commit the behavior change**

```bash
git add src/app/studio/LibraryPages.tsx
git commit -m "feat: compact model task list"
```

### Task 3: Style and verify the non-wrapping layout

**Files:**
- Modify: `src/app/studio/library.css:902-931,1509-1520`
- Test: `src/app/studio/LibraryPages.test.tsx:542-634`

- [ ] **Step 1: Replace summary-card CSS with compact task list rules**

Delete `.task-summary` and its mobile override. Add a horizontally scrollable `task-list`, a fixed-minimum grid for rows, ellipsis rules for all text cells, and a nonshrinking action cell. Retain the existing token palette and borders.

```css
.task-list {
  overflow-x: auto;
  border-top: 1px solid var(--border-subtle);
}

.task-row {
  display: grid;
  grid-template-columns: minmax(112px, .8fr) auto minmax(220px, 2.4fr) minmax(148px, 1fr) auto;
  align-items: center;
  gap: 14px;
  min-width: 760px;
  min-height: 52px;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.task-row__cell {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-row__summary,
.task-row__meta { color: var(--on-surface-variant); font-size: 12px; }
.task-row__actions { display: inline-flex; justify-content: flex-end; min-width: 32px; }
```

- [ ] **Step 2: Add narrow-viewport refinements without allowing wrapping**

In the existing `@media (max-width: 720px)` section, reduce row padding and gaps only. Keep `min-width`, `white-space: nowrap`, and scroll behavior so the row remains one record rather than stacking fields.

```css
@media (max-width: 720px) {
  .task-row { gap: 10px; padding-inline: 14px; }
}
```

- [ ] **Step 3: Run focused tests and static validation**

Run:

```bash
pnpm vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx
pnpm typecheck
pnpm lint
```

Expected: all commands exit 0.

- [ ] **Step 4: Build the production bundles**

Run: `pnpm build`

Expected: both renderer and Electron Vite builds complete successfully.

- [ ] **Step 5: Run the full unit suite**

Run: `pnpm test:unit`

Expected: all unit tests pass.

- [ ] **Step 6: Commit styles and verification-backed final change**

```bash
git add src/app/studio/library.css src/app/studio/LibraryPages.test.tsx
git commit -m "style: align compact task records"
```
