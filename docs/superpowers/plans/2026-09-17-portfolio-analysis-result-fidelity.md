# Portfolio Analysis Result Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the complete structured visual analysis and present it in the dense, editable analysis layout defined by the approved portfolio designer design.

**Architecture:** Extend `PersonaProfile.styleDna` with optional, backward-compatible inferred signals so existing workspace files and task history remain readable. Require new vision prompts to request those signals, normalize them at the parser boundary, carry them through the session draft without collapsing bilingual values, and render the result as five scannable sections in the existing wide drawer.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, CSS.

---

### Task 1: Structured analysis contract

**Files:**
- Modify: `src/app/studio/personas.ts`
- Modify: `src/features/agent/analyze-portfolio.ts`
- Modify: `src/features/designers/persistence.ts`
- Test: `src/features/agent/analyze-portfolio.test.ts`
- Test: `src/features/designers/persistence.test.ts`

- [ ] Add failing tests proving structured contrast, airiness, whitespace, typography, composition, grain, diffuse-light, and rendering signals survive provider parsing and persistence validation.
- [ ] Run the focused tests and confirm they fail because the fields are missing.
- [ ] Add the optional typed signal contract, prompt schema, parser normalization, range validation, and backward-compatible persistence validation.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Complete editable analysis view

**Files:**
- Modify: `src/app/studio/DesignerLibrary.tsx`
- Modify: `src/app/studio/library.css`
- Test: `src/app/studio/DesignerLibrary.test.tsx`

- [ ] Add a failing interaction test that opens a completed analysis and asserts the identity, color, typography/composition, material, and negative-rule sections expose complete editable content and structured signals.
- [ ] Run the component test and confirm the missing sections cause the expected failure.
- [ ] Extend the session draft mapping and replace the generic two-column form with dense semantic sections, full-width text areas, palette swatches, editable metric controls, and rule chips.
- [ ] Preserve the provider's non-active locale when the active-locale draft is published.
- [ ] Run the component test and confirm it passes.

### Task 3: Regression and visual verification

**Files:**
- Modify as required by verification findings only.

- [ ] Run the agent, persistence, and designer library focused suites.
- [ ] Run the complete unit suite, type check, lint, and production build.
- [ ] Start the application and verify the analysis drawer at desktop and narrow widths, checking that long text is visible, controls do not overlap, and the fixed footer remains usable.
- [ ] Review the final diff for unrelated changes and document verification results.
