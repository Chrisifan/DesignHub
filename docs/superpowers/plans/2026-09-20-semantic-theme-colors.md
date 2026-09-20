# Semantic Theme Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give success, warning, error, and information states independent, accessible colors in both themes and stop using brand or decorative colors as status colors.

**Architecture:** Define the semantic palette once per theme in `tokens.css`, then route shared Badge tones and state-specific components through those variables. Keep primary, secondary, and tertiary for brand, selection, AI, and decorative roles; use a separate warm accent for non-semantic analysis decoration.

**Tech Stack:** CSS custom properties, React, TypeScript, Testing Library, Vitest.

---

### Task 1: Define the semantic theme palette

**Files:**
- Modify: `tests/integration/layout-contract.test.ts`
- Modify: `src/app/styles/tokens.css`

- [ ] **Step 1: Replace the narrow warning-token test with a failing semantic-palette contract**

Extract the dark, explicit-light, and system-light theme blocks and assert these values:

```ts
const semanticTokens = {
  dark: {
    success: '#4ade80', warning: '#fbbf24', error: '#fca5a5', info: '#93c5fd', accentWarm: '#fb923c',
  },
  light: {
    success: '#15803d', warning: '#a16207', error: '#b91c1c', info: '#1d4ed8', accentWarm: '#c2410c',
  },
} as const;

expect(darkTheme).toMatch(/--success:\s*#4ade80/);
expect(darkTheme).toMatch(/--success-container:\s*#14532d/);
expect(darkTheme).toMatch(/--info:\s*#93c5fd/);
expect(darkTheme).toMatch(/--accent-warm:\s*#fb923c/);
expect(lightTheme).toMatch(/--success:\s*#15803d/);
expect(lightTheme).toMatch(/--warning:\s*#a16207/);
expect(lightTheme).toMatch(/--error:\s*#b91c1c/);
expect(lightTheme).toMatch(/--info:\s*#1d4ed8/);
expect(lightTheme).toMatch(/--accent-warm:\s*#c2410c/);
expect(systemLightTheme).toMatch(/--success:\s*#15803d/);
expect(lightTheme).not.toMatch(/--success:\s*var\(--(?:primary|tertiary)\)/);
```

Also assert every semantic family contains `on-*`, `*-container`, and `on-*-container` variables.

- [ ] **Step 2: Run the integration test and verify RED**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts
```

Expected: FAIL because success and info families and the warm accent do not exist, while light warning and error still use their old values.

- [ ] **Step 3: Add the dark semantic variables**

In the dark theme block, define:

```css
--success: #4ade80;
--on-success: #052e16;
--success-container: #14532d;
--on-success-container: #dcfce7;
--warning: #fbbf24;
--on-warning: #422006;
--warning-container: #78350f;
--on-warning-container: #fef3c7;
--error: #fca5a5;
--on-error: #450a0a;
--error-container: #7f1d1d;
--on-error-container: #fee2e2;
--info: #93c5fd;
--on-info: #172554;
--info-container: #1e3a8a;
--on-info-container: #dbeafe;
--accent-warm: #fb923c;
```

- [ ] **Step 4: Add the light semantic variables to both light blocks**

In `:root[data-theme='light']` and `:root:not([data-theme='dark'])`, define the same names with:

```css
--success: #15803d;
--on-success: #ffffff;
--success-container: #dcfce7;
--on-success-container: #14532d;
--warning: #a16207;
--on-warning: #ffffff;
--warning-container: #fef3c7;
--on-warning-container: #78350f;
--error: #b91c1c;
--on-error: #ffffff;
--error-container: #fee2e2;
--on-error-container: #7f1d1d;
--info: #1d4ed8;
--on-info: #ffffff;
--info-container: #dbeafe;
--on-info-container: #1e3a8a;
--accent-warm: #c2410c;
```

- [ ] **Step 5: Run the token contract and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts
```

Expected: all layout-contract tests pass.

### Task 2: Route shared visual states through semantic tokens

**Files:**
- Modify: `tests/integration/layout-contract.test.ts`
- Modify: `src/app/studio/ui.tsx`
- Modify: `src/app/styles/studio.css`
- Modify: `src/app/studio/library.css`
- Modify: `src/app/studio/persona.css`
- Modify: `src/app/studio/workbench.css`

- [ ] **Step 1: Add failing CSS usage contracts**

Read the shared, library, persona, and workbench styles and assert:

```ts
expect(studioStyles).toMatch(/\.badge--success\s*\{[\s\S]*?color:\s*var\(--success\)/);
expect(studioStyles).toMatch(/\.badge--warning\s*\{[\s\S]*?color:\s*var\(--warning\)/);
expect(studioStyles).toMatch(/\.badge--error\s*\{[\s\S]*?color:\s*var\(--error\)/);
expect(studioStyles).toMatch(/\.inline-notice\s*>\s*\.ui-icon\s*\{[\s\S]*?color:\s*var\(--info\)/);
expect(libraryStyles).toMatch(/\.portfolio-steps li\.is-complete > span\s*\{[\s\S]*?background:\s*var\(--success\)/);
expect(libraryStyles).toMatch(/\.portfolio-analysis-section--texture[\s\S]*?var\(--accent-warm\)/);
expect(libraryStyles).toMatch(/\.portfolio-review__published\s*\{[\s\S]*?color:\s*var\(--success\)/);
expect(personaStyles).toMatch(/designer-profile-card__status--published[\s\S]*?var\(--success\)/);
expect(workbenchStyles).toMatch(/\.workbench-context-tools__finalize:not\(:disabled\)[\s\S]*?var\(--success\)/);
```

- [ ] **Step 2: Run the integration test and verify RED**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts
```

Expected: FAIL because these selectors still use tertiary, warning, primary, or have no tone rules.

- [ ] **Step 3: Type Badge tones and add shared tone styles**

In `ui.tsx`, introduce:

```ts
export type BadgeTone = '' | 'primary' | 'ai' | 'success' | 'warning' | 'error';
```

Use `BadgeTone` for the `tone` prop. In `studio.css`, keep AI on secondary, add primary on primary, and define success/warning/error foregrounds and containers from their semantic families. Change the generic inline-notice icon to `--info`, and make the local-storage note icon neutral rather than success-colored.

- [ ] **Step 4: Replace semantic and decorative misuses**

Apply these exact mappings:

```css
.portfolio-steps li.is-complete > span { color: var(--on-success); background: var(--success); }
.portfolio-analysis-section--texture .portfolio-analysis-section__icon { color: var(--accent-warm); }
.portfolio-analysis-section--texture .portfolio-analysis-metric__value { color: var(--accent-warm); }
.portfolio-analysis-section--texture .portfolio-analysis-metric__track i { background: var(--accent-warm); }
.designer-profile-card__active-label { color: var(--primary); }
.portfolio-review__published { color: var(--success); }
.designer-profile-card__status--published,
.designer-profile-card__status--built-in { color: var(--success); }
.workbench-context-tools .workbench-context-tools__finalize:not(:disabled) {
  color: var(--on-success);
  background: var(--success);
}
```

Keep `.profile-mark--tertiary` unchanged because it is decorative.

- [ ] **Step 5: Run the integration test and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/integration/layout-contract.test.ts
```

Expected: all layout-contract tests pass.

### Task 3: Correct state-to-tone mappings

**Files:**
- Modify: `src/app/studio/ProjectDetailPage.test.tsx`
- Modify: `src/app/studio/ProjectDetailPage.tsx`
- Modify: `src/app/studio/project-detail.css`
- Modify: `src/app/studio/LibraryPages.test.tsx`
- Modify: `src/app/studio/LibraryPages.tsx`

- [ ] **Step 1: Add failing project-status tone tests**

Render active, archived, and unsaved projects and assert their dot classes:

```ts
expect(screen.getByLabelText('项目状态与设计稿数量').querySelector('.project-detail-status-dot')).toHaveClass('project-detail-status-dot--success');
renderPage({ project: { ...project, archived: true } });
expect(screen.getByLabelText('项目状态与设计稿数量').querySelector('.project-detail-status-dot')).toHaveClass('project-detail-status-dot--neutral');
renderPage({ project: { ...project, workspaceId: undefined } });
expect(screen.getByLabelText('项目状态与设计稿数量').querySelector('.project-detail-status-dot')).toHaveClass('project-detail-status-dot--warning');
```

- [ ] **Step 2: Add failing task and export tone tests**

In the existing failed-task tests, assert the `失败` badge has `badge--error`. For a cancelled generation slot assert `badge--warning`, and for a failed export-history record assert `badge--error`.

- [ ] **Step 3: Run component tests and verify RED**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx src/app/studio/LibraryPages.test.tsx
```

Expected: FAIL because project dots have no tone modifier and failed states still resolve to warning.

- [ ] **Step 4: Implement project status tones**

Compute the tone beside `projectStatus`:

```ts
const projectStatusTone = project.archived ? 'neutral' : saved ? 'success' : 'warning';
```

Render `project-detail-status-dot--${projectStatusTone}` and style success with `--success`, warning with `--warning`, and neutral with `--outline`.

- [ ] **Step 5: Implement task, slot, and export tone mappings**

Type `taskTone` as `BadgeTone` and map completed to success, failed to error, unknown-after-restart and cancelled to warning, and ordinary queued/running states to neutral. Map failed slots and failed export records to error while keeping cancelled slots on warning.

- [ ] **Step 6: Run component and integration tests**

Run:

```bash
pnpm exec vitest run src/app/studio/ProjectDetailPage.test.tsx src/app/studio/LibraryPages.test.tsx tests/integration/layout-contract.test.ts
```

Expected: all selected tests pass.

### Task 4: Full verification

**Files:**
- Verify only

- [ ] **Step 1: Run unit and integration tests**

```bash
pnpm test:unit
pnpm test:integration
```

Expected: zero failures.

- [ ] **Step 2: Run static checks and production build**

```bash
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: every command exits successfully. Keep implementation changes uncommitted because the affected shared files already contain user-owned work from earlier tasks; do not stage or combine those changes without a separate user request.
