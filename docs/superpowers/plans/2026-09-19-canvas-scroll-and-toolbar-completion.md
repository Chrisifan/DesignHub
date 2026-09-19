# Canvas Scroll and Toolbar Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide canvas scrollbars, reliably center each new generation placeholder, and complete the partially implemented top and right toolbar actions.

**Architecture:** Keep Workbench as the owner of viewport scrolling and display zoom. CandidateBoard reports the newest placeholder element through a callback; Workbench computes exact scroll coordinates against its stage ref. CanvasWorkspace receives an explicit inspector request that may select the first editable layer when no layer is selected.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library

---

### Task 1: Exact placeholder centering

**Files:**
- Modify: `src/app/studio/CandidateBoard.tsx`
- Modify: `src/app/studio/Workbench.tsx`
- Test: `src/app/studio/CandidateBoard.test.tsx`
- Test: `src/app/studio/Workbench.test.tsx`

- [ ] Add failing tests proving CandidateBoard reports only the newest running placeholder and Workbench calls its stage `scrollTo()` with horizontal and vertical center coordinates.
- [ ] Run `pnpm exec vitest run src/app/studio/CandidateBoard.test.tsx src/app/studio/Workbench.test.tsx` and confirm failures reference the missing focus callback and direct scrolling.
- [ ] Add `onRequestFocus?: (element: HTMLElement) => void` to CandidateBoard and invoke it from the latest-placeholder layout effect instead of `scrollIntoView()`.
- [ ] Add a stage ref and `centerDraft(element)` to Workbench using container and element rectangles plus current scroll offsets, then call `scrollTo({ left, top, behavior: 'smooth' })` with non-negative coordinates.
- [ ] Run the two tests and confirm they pass.

### Task 2: Hidden scrollbars and unified draft zoom

**Files:**
- Modify: `src/app/studio/Workbench.tsx`
- Modify: `src/app/studio/CandidateBoard.tsx`
- Modify: `src/app/studio/workbench.css`
- Test: `src/app/studio/Workbench.test.tsx`
- Test: `src/app/studio/CandidateBoard.test.tsx`

- [ ] Add failing tests proving zoom changes the shared draft display width and reset requests draft recentering.
- [ ] Run the targeted tests and confirm the shared display-width assertions fail.
- [ ] Derive `draftDisplayWidth = 280 * zoom / 68` in Workbench, apply it to the official draft, and pass it to CandidateBoard for candidate and skeleton cards while keeping document aspect ratios.
- [ ] Change embedded CanvasWorkspace to use its fit zoom inside the resized card so zoom is not applied twice.
- [ ] Update reset to restore 68 and recenter the selected candidate, newest generation, or official draft.
- [ ] Add `scrollbar-width: none`, `-ms-overflow-style: none`, and a zero-sized `::-webkit-scrollbar` to the canvas stage while retaining `overflow: auto`.
- [ ] Run the targeted tests and confirm they pass.

### Task 3: Complete the properties toolbar action

**Files:**
- Modify: `src/features/canvas/CanvasWorkspace.tsx`
- Modify: `src/app/studio/Workbench.tsx`
- Test: `src/features/canvas/CanvasWorkspace.test.tsx`
- Test: `src/app/studio/Workbench.test.tsx`

- [ ] Add failing tests proving an inspector request selects the first interactive layer when nothing is selected and Workbench notifies on a completely empty document.
- [ ] Run the targeted tests and confirm the inspector does not open before implementation.
- [ ] Update the embedded inspector request effect to preserve an existing selection or select the first interactive scene layer before reopening the inspector.
- [ ] Update the Workbench properties action to notify when `scene.layers` contains no editable layer; otherwise send the inspector request.
- [ ] Run the targeted tests and confirm they pass.

### Task 4: Regression verification

**Files:**
- Test: `src/app/studio/Workbench.test.tsx`
- Test: `src/app/studio/CandidateBoard.test.tsx`
- Test: `src/features/canvas/CanvasWorkspace.test.tsx`

- [ ] Run `pnpm exec vitest run src/app/studio/Workbench.test.tsx src/app/studio/AnalysisPanel.test.tsx src/app/studio/CandidateBoard.test.tsx src/features/canvas/CanvasWorkspace.test.tsx` and require zero failures.
- [ ] Run `pnpm typecheck` and require exit code 0.
- [ ] Run `pnpm lint` and require exit code 0.
- [ ] Run `pnpm build` and require exit code 0.
