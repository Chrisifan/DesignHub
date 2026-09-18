# Designer Rule Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render designer negative rules as single-line ellipsized text with an accessible application Tooltip in analysis, review/inspector, and edit-preview surfaces.

**Architecture:** Add one focused `Tooltip` component that portals fixed-position content to `document.body` and exposes it on hover or keyboard focus. Existing designer components keep ownership of rule lists and localized values; they only wrap each visible rule value with the shared Tooltip and apply surface-specific truncation classes.

**Tech Stack:** React 19, TypeScript, React DOM portals, CSS, Vitest, Testing Library, Playwright.

---

## File Map

- Create `src/app/studio/Tooltip.tsx`: shared hover/focus Tooltip behavior, portal positioning, and accessibility attributes.
- Create `src/app/studio/Tooltip.test.tsx`: direct interaction and accessibility coverage.
- Modify `src/app/styles/studio.css`: shared Tooltip layer, dimensions, typography, and focus treatment.
- Modify `src/app/studio/DesignerProfileCard.tsx`: use Tooltip for dossier negative rules.
- Modify `src/app/studio/DesignerProfileCard.test.tsx`: dossier regression coverage.
- Modify `src/app/studio/DesignerLibrary.tsx`: use Tooltip in portfolio analysis and edit preview.
- Modify `src/app/studio/DesignerLibrary.test.tsx`: analysis and edit-preview regression coverage.
- Modify `src/app/studio/library.css`: one-line ellipsis contracts for all three rule presentations.
- Modify `tests/e2e/designer-drawer.spec.ts`: verify analysis and review rule Tooltip behavior in the creation flow.
- Modify `tests/e2e/studio.spec.ts`: verify inspector/edit rule containment and Tooltip behavior.
- Modify `tests/e2e/test-workspace.ts`: provide a deterministic long negative rule for browser coverage.

### Task 1: Build The Shared Tooltip

**Files:**
- Create: `src/app/studio/Tooltip.tsx`
- Create: `src/app/studio/Tooltip.test.tsx`
- Modify: `src/app/styles/studio.css`

- [ ] **Step 1: Write the failing Tooltip interaction test**

Create `src/app/studio/Tooltip.test.tsx` with tests that render the trigger, assert there is no native `title`, open on hover and focus, connect `aria-describedby`, and close on pointer leave, blur, and Escape:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import { Tooltip } from './Tooltip';

it('shows complete content on hover without a native title', () => {
  render(<Tooltip content="完整规则">省略规则</Tooltip>);
  const trigger = screen.getByText('省略规则');

  expect(trigger).not.toHaveAttribute('title');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

  fireEvent.mouseEnter(trigger);
  const tooltip = screen.getByRole('tooltip');
  expect(tooltip).toHaveTextContent('完整规则');
  expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);

  fireEvent.mouseLeave(trigger);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('supports keyboard focus and Escape dismissal', () => {
  render(<Tooltip content="完整规则">省略规则</Tooltip>);
  const trigger = screen.getByText('省略规则');

  fireEvent.focus(trigger);
  expect(screen.getByRole('tooltip')).toHaveTextContent('完整规则');

  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

  fireEvent.focus(trigger);
  fireEvent.blur(trigger);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the Tooltip test to verify RED**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/Tooltip.test.tsx
```

Expected: FAIL because `./Tooltip` does not exist.

- [ ] **Step 3: Implement the minimal portal Tooltip**

Create `src/app/studio/Tooltip.tsx` with this public contract and behavior:

```tsx
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  className?: string;
};

type TooltipPosition = { left: number; top: number };

export const Tooltip = ({ content, children, className = '' }: TooltipProps) => {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const tooltip = tooltipRef.current?.getBoundingClientRect();
      if (!trigger || !tooltip) return;
      const margin = 8;
      const gap = 8;
      const left = Math.min(
        window.innerWidth - tooltip.width - margin,
        Math.max(margin, trigger.left + trigger.width / 2 - tooltip.width / 2),
      );
      const below = trigger.bottom + gap;
      const top = below + tooltip.height <= window.innerHeight - margin
        ? below
        : Math.max(margin, trigger.top - tooltip.height - gap);
      setPosition({ left, top });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  return <>
    <span
      ref={triggerRef}
      className={`ui-tooltip-trigger ${className}`}
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >{children}</span>
    {open && createPortal(
      <span
        ref={tooltipRef}
        id={id}
        role="tooltip"
        className="ui-tooltip"
        style={{
          left: position?.left ?? 0,
          top: position?.top ?? 0,
          visibility: position ? 'visible' : 'hidden',
        }}
      >{content}</span>,
      document.body,
    )}
  </>;
};
```

Add shared styles to `src/app/styles/studio.css`:

```css
.ui-tooltip-trigger {
  outline: none;
}

.ui-tooltip-trigger:focus-visible {
  border-radius: 2px;
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.ui-tooltip {
  position: fixed;
  z-index: 1000;
  display: block;
  max-inline-size: min(320px, calc(100vw - 16px));
  padding: 7px 9px;
  border: 1px solid var(--outline-variant);
  border-radius: 4px;
  color: var(--on-surface);
  background: var(--surface-container-highest);
  box-shadow: var(--shadow-overlay);
  font-size: 11px;
  line-height: 17px;
  white-space: pre-line;
  pointer-events: none;
}
```

- [ ] **Step 4: Run the Tooltip test to verify GREEN**

Run the command from Step 2.

Expected: 2 tests pass with no warnings.

- [ ] **Step 5: Commit the shared Tooltip**

```bash
git add src/app/studio/Tooltip.tsx src/app/studio/Tooltip.test.tsx src/app/styles/studio.css
git commit -m "feat: add accessible studio tooltip"
```

### Task 2: Apply Tooltip And Ellipsis To Dossier Rules

**Files:**
- Modify: `src/app/studio/DesignerProfileCard.tsx`
- Modify: `src/app/studio/DesignerProfileCard.test.tsx`
- Modify: `src/app/studio/library.css`

- [ ] **Step 1: Write the failing dossier regression test**

Add a test using a deliberately long localized rule. Assert the trigger has no `title`, uses the dedicated truncation class, and reveals the full rule through `role="tooltip"` on hover:

```tsx
it('keeps dossier rules on one line and exposes full text with the shared tooltip', () => {
  const rule = '避免使用会破坏安全边距、信息层级与主体识别度的复杂背景纹理';
  render(<DesignerDossier locale="zh-CN" profile={{
    ...profile,
    negativeRules: [{ zh: rule, en: 'Avoid complex backgrounds that harm hierarchy' }],
  }} />);

  const trigger = screen.getByText(rule);
  expect(trigger).toHaveClass('designer-profile-rule__text');
  expect(trigger).not.toHaveAttribute('title');
  fireEvent.mouseEnter(trigger);
  expect(screen.getByRole('tooltip')).toHaveTextContent(rule);
});
```

- [ ] **Step 2: Run the dossier test to verify RED**

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerProfileCard.test.tsx
```

Expected: FAIL because the rule is plain list-item text and no Tooltip exists.

- [ ] **Step 3: Wrap dossier rule text with Tooltip**

Import `Tooltip` and change each rule row to preserve its icon while truncating only the text:

```tsx
const label = localize(locale, rule);
return <li key={`${rule.zh}-${rule.en}`}>
  <Icon name="circle-alert" size={13} />
  <Tooltip content={label} className="designer-profile-rule__text">{label}</Tooltip>
</li>;
```

Update `src/app/studio/library.css`:

```css
.designer-profile-card__rules li {
  align-items: center;
  overflow: hidden;
  white-space: nowrap;
}

.designer-profile-rule__text {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Remove the dossier rule row's `overflow-wrap: anywhere` and icon top margin so the row cannot become multiline.

- [ ] **Step 4: Run dossier tests to verify GREEN**

Run the command from Step 2.

Expected: all `DesignerProfileCard` tests pass.

- [ ] **Step 5: Commit dossier integration**

```bash
git add src/app/studio/DesignerProfileCard.tsx src/app/studio/DesignerProfileCard.test.tsx src/app/studio/library.css
git commit -m "fix: truncate designer dossier rules"
```

### Task 3: Apply Tooltip To Analysis And Edit Preview

**Files:**
- Modify: `src/app/studio/DesignerLibrary.tsx`
- Modify: `src/app/studio/DesignerLibrary.test.tsx`
- Modify: `src/app/studio/library.css`

- [ ] **Step 1: Replace the old analysis assertion with a failing shared-Tooltip assertion**

In the completed-analysis test, replace the native `title` expectation with:

```tsx
const negativeRule = within(report).getByText('避免霓虹渐变');
expect(negativeRule).not.toHaveAttribute('title');
expect(negativeRule).toHaveClass('portfolio-analysis-rule__text');
fireEvent.mouseEnter(negativeRule);
expect(screen.getByRole('tooltip')).toHaveTextContent('避免霓虹渐变');
```

Add an edit-preview test that opens a seeded profile, selects Edit, finds the complete draft rule value, and expects the dedicated single-line class and shared Tooltip:

```tsx
it('shows the complete edit-preview rules through the shared tooltip', () => {
  const rule = '避免使用会破坏安全边距与信息层级的复杂背景纹理';
  const edited = { ...personaProfiles[0]!, negativeRules: [{ zh: rule, en: 'Avoid complex backgrounds' }] };
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} preview initialProfiles={[edited]} />);

  fireEvent.click(screen.getByRole('button', { name: /纸感排版/ }));
  fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  const previewRule = screen.getByText(rule);
  expect(previewRule).toHaveClass('designer-draft-rule__text');
  expect(previewRule).not.toHaveAttribute('title');
  fireEvent.mouseEnter(previewRule);
  expect(screen.getByRole('tooltip')).toHaveTextContent(rule);
});
```

- [ ] **Step 2: Run DesignerLibrary tests to verify RED**

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx
```

Expected: FAIL because analysis still uses `title` and edit preview has no Tooltip trigger.

- [ ] **Step 3: Use Tooltip in both DesignerLibrary presentations**

Import `Tooltip`. Replace the analysis `title` span with:

```tsx
<Tooltip content={rule} className="portfolio-analysis-rule__text">{rule}</Tooltip>
```

Split edit-preview label and value, preserving the source string for Tooltip content:

```tsx
<div className="draft-rule">
  <span className="draft-rule__label">{t(locale, '规则', 'Rules')}</span>
  {draft.negativeRules ? (
    <Tooltip content={draft.negativeRules} className="designer-draft-rule__text">
      {draft.negativeRules.replace(/\s*\n\s*/gu, ' · ')}
    </Tooltip>
  ) : <span className="designer-draft-rule__empty">{t(locale, '尚未填写', 'Not provided')}</span>}
</div>
```

Update `src/app/studio/library.css` so `.draft-rule__label` retains the current label styling and both `.portfolio-analysis-rule__text` and `.designer-draft-rule__text` are flex-safe one-line ellipsis containers:

```css
.draft-rule__label,
.designer-draft-rule__empty {
  display: block;
}

.designer-draft-rule__text {
  display: block;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Narrow the existing `.draft-rule span` selector to `.draft-rule__label` so the Tooltip trigger does not inherit label color and margin.

- [ ] **Step 4: Run DesignerLibrary tests to verify GREEN**

Run the command from Step 2.

Expected: all `DesignerLibrary` tests pass.

- [ ] **Step 5: Commit analysis and edit integration**

```bash
git add src/app/studio/DesignerLibrary.tsx src/app/studio/DesignerLibrary.test.tsx src/app/studio/library.css
git commit -m "fix: truncate designer workflow rules"
```

### Task 4: Add Browser Regression Coverage

**Files:**
- Modify: `tests/e2e/designer-drawer.spec.ts`
- Modify: `tests/e2e/studio.spec.ts`
- Modify: `tests/e2e/test-workspace.ts`

- [ ] **Step 1: Add failing browser assertions for analysis and review**

In `tests/e2e/designer-drawer.spec.ts`, replace the native `title` assertion and extend the review step:

```ts
await expect(ruleText).not.toHaveAttribute('title');
await expect(ruleText).toHaveCSS('white-space', 'nowrap');
await expect(ruleText).toHaveCSS('text-overflow', 'ellipsis');
await ruleText.hover();
await expect(page.getByRole('tooltip')).toHaveText(longNegativeRule);

const reviewRule = dossier.getByText(longNegativeRule, { exact: true });
await expect(reviewRule).toHaveCSS('white-space', 'nowrap');
await expect(reviewRule).toHaveCSS('text-overflow', 'ellipsis');
await reviewRule.hover();
await expect(page.getByRole('tooltip')).toHaveText(longNegativeRule);
```

- [ ] **Step 2: Add failing browser assertions for inspector and edit preview**

Replace the short test-workspace rule in `tests/e2e/test-workspace.ts` with a deterministic long rule. Add a focused E2E test in `tests/e2e/studio.spec.ts` that opens the designer inspector, checks `.designer-profile-rule__text`, hovers to display the Tooltip, opens Edit, and repeats the checks against `.designer-draft-rule__text`.

The test must also assert for each trigger:

```ts
await expect(trigger).not.toHaveAttribute('title');
await expect(trigger).toHaveCSS('white-space', 'nowrap');
await expect(trigger).toHaveCSS('text-overflow', 'ellipsis');
expect(await trigger.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
```

After hover, verify Tooltip containment:

```ts
const tooltipBox = await page.getByRole('tooltip').boundingBox();
expect(tooltipBox).not.toBeNull();
expect(tooltipBox!.x).toBeGreaterThanOrEqual(0);
expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
```

- [ ] **Step 3: Run focused E2E tests to verify the integrated behavior**

Run:

```bash
pnpm exec playwright test tests/e2e/designer-drawer.spec.ts tests/e2e/studio.spec.ts --config playwright.config.ts
```

Expected: all focused browser tests pass. Tasks 1-3 already established RED/GREEN coverage at the component level; this step verifies the integrated browser layout and portal positioning.

- [ ] **Step 4: Inspect screenshots at 1280px and 1024px**

Review the generated analysis, review, inspector, and edit-preview screenshots. Confirm rule rows remain one line, alert icons remain fixed, ellipses are visible, Tooltip content is readable, and neither drawer nor modal gains horizontal overflow.

- [ ] **Step 5: Commit browser coverage**

```bash
git add tests/e2e/designer-drawer.spec.ts tests/e2e/studio.spec.ts tests/e2e/test-workspace.ts
git commit -m "test: cover designer rule tooltips"
```

### Task 5: Complete Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run focused component tests**

```bash
pnpm exec vitest run --config vitest.config.ts src/app/studio/Tooltip.test.tsx src/app/studio/DesignerProfileCard.test.tsx src/app/studio/DesignerLibrary.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 2: Run full unit and integration suites**

```bash
pnpm test:unit
pnpm test:integration
```

Expected: zero failures.

- [ ] **Step 3: Run static verification and production build**

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands exit 0. Existing Vite chunk-size and `sharp` externalization warnings may remain, but no new warnings or errors are allowed.

- [ ] **Step 4: Run the complete E2E suite**

```bash
pnpm test:e2e
```

Expected: zero failures across the complete Playwright suite.

- [ ] **Step 5: Confirm repository state**

```bash
git status --short --branch
git diff --check
git log --oneline -8
```

Expected: clean `main`, no whitespace errors, and the Tooltip commits at the top of the history.
