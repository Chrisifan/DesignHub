# Canvas Analysis History Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Include the newest canvas analysis in the history list, make the list visually consistent, anchor it to the lower-left, and shorten the canvas conversation dock.

**Architecture:** Keep task selection and history derivation in `ProjectCanvas`, with a small pure helper so ordering and inclusion are independently testable. Render the history list before its trigger inside a bottom-anchored column, allowing the list to grow upward while keeping the trigger at the bottom. Adjust only the canvas-specific dock width and history styles.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, CSS.

---

### Task 1: Cover history derivation and rendering behavior

**Files:**
- Create: `src/app/studio/ProjectCanvas.test.tsx`
- Modify: `src/app/studio/ProjectCanvas.tsx`

- [ ] **Step 1: Write failing tests**

Add a pure-helper test proving the selected/latest conversation is retained, sorted newest first, and counted, plus a component test proving selecting the newest history item updates the analysis panel. Mock the desktop runtime and canvas stage so the test focuses on the analysis controls.

- [ ] **Step 2: Run the focused test and verify it fails**

Run `pnpm exec vitest run --config vitest.config.ts src/app/studio/ProjectCanvas.test.tsx`.
Expected: the history helper is missing or the latest item is absent, demonstrating the regression before implementation.

- [ ] **Step 3: Implement minimal history derivation**

Export a helper that accepts the task list, active thread id, and displayed task, filters conversation tasks for the active thread, adds the displayed task when it is not already present, and sorts by `createdAt` descending. Use the helper in `ProjectCanvas` and remove the exclusion of `analysisTask?.id`.

- [ ] **Step 4: Render the history list with the current task included**

Keep the count based on the helper result. Render the list items before the trigger so the trigger stays at the bottom of the anchored section. Preserve existing selection behavior and labels.

- [ ] **Step 5: Run the focused tests and verify they pass**

Run `pnpm exec vitest run --config vitest.config.ts src/app/studio/ProjectCanvas.test.tsx`.
Expected: all focused tests pass.

### Task 2: Apply canvas layout and visual treatment

**Files:**
- Modify: `src/app/studio/project-canvas.css`
- Modify: `src/app/studio/ProjectCanvas.test.tsx`

- [ ] **Step 1: Add CSS contract assertions**

Add a test that imports the canvas stylesheet through the test environment and verifies the rendered history section and list classes are present after opening the trigger. Keep behavioral assertions DOM-based; use the stylesheet change for visual verification.

- [ ] **Step 2: Update the layout**

Change the analysis column from `top` anchoring to `bottom` anchoring, retain a bounded height, and use `overflow: hidden`/`min-height: 0` so its children remain inside the canvas. Keep the history list scrollable within a fixed maximum height.

- [ ] **Step 3: Make the list expand upward**

Move the list before the trigger in JSX/CSS flow, change the divider to the list’s bottom edge, and keep the trigger as the bottom control. Use the same shell glass border, background, backdrop, radius, and overlay shadow tokens as the analysis panel.

- [ ] **Step 4: Shorten the canvas conversation dock**

Reduce `.project-canvas-toolbar--bottom` to `width: min(620px, calc(100% - 32px))`, leaving the existing mobile override intact.

- [ ] **Step 5: Run focused tests**

Run `pnpm exec vitest run --config vitest.config.ts src/app/studio/ProjectCanvas.test.tsx src/app/studio/AnalysisPanel.test.tsx`.
Expected: all focused tests pass.

### Task 3: Verify the repository-wide impact

**Files:**
- No additional source files expected.

- [ ] **Step 1: Run typecheck**

Run `pnpm typecheck`.
Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 2: Run lint**

Run `pnpm lint`.
Expected: exit code 0 with no ESLint errors or warnings.

- [ ] **Step 3: Run the full unit suite**

Run `pnpm test:unit`.
Expected: all unit tests pass.

- [ ] **Step 4: Inspect the final diff**

Run `git diff -- src/app/studio/ProjectCanvas.tsx src/app/studio/ProjectCanvas.test.tsx src/app/studio/project-canvas.css` and confirm only the requested history, anchoring, style, and width changes are present.
