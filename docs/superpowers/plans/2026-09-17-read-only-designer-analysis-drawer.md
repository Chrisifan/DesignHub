# Read-only Designer Analysis Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the portfolio designer wizard drawer at one width and replace the editable analysis form with the approved read-only visual report.

**Architecture:** Keep phase orchestration and the localized `DesignerDraft` view model in `DesignerLibrary.tsx`. Render a dedicated read-only report from that view model, style it with the existing studio token system in `library.css`, and preserve the current analysis and artwork task flows.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Playwright.

---

## File Map

- Modify `src/app/studio/DesignerLibrary.tsx`: set the stable drawer class, remove analysis editing props and handlers, and render the read-only report primitives.
- Modify `src/app/studio/library.css`: replace editable-form presentation rules with the three-panel report layout and responsive behavior.
- Modify `src/app/studio/DesignerLibrary.test.tsx`: cover stable width, read-only semantics, result completeness, missing values, reanalysis, and the step-3 transition.
- Modify `tests/e2e/designer-drawer.spec.ts`: verify width stability, report containment, scrolling, and the artwork loading phase at desktop and narrow sizes.

The implementation files above already contain uncommitted work from the preceding response-recovery and artwork-generation fixes. Preserve those changes and stage only reviewed hunks if a commit is requested.

### Task 1: Lock The Drawer Width Across Wizard Phases

**Files:**
- Modify: `src/app/studio/DesignerLibrary.test.tsx:59-94`
- Modify: `src/app/studio/DesignerLibrary.tsx:949-981`

- [ ] **Step 1: Update the width assertions to describe one stable class**

Replace the compact/wide expectations with the dedicated creation-drawer class:

```tsx
it("keeps the portfolio creation drawer at one width", () => {
  render(<DesignerLibrary locale="zh-CN" notify={vi.fn()} preview initialProfiles={personaProfiles} />);
  fireEvent.click(screen.getByRole("button", { name: "从作品集创建" }));

  const drawer = screen.getByRole("dialog", { name: "导入作品集分析 · 生成 AI 设计师档案" });
  expect(drawer).toHaveClass("ui-drawer--portfolio");
  expect(drawer).not.toHaveClass("ui-drawer--compact", "ui-drawer--wide");
});
```

In the loading-state test, assert `ui-drawer--portfolio` rather than `ui-drawer--wide`.

- [ ] **Step 2: Run the focused tests and verify the new contract fails**

Run:

```bash
pnpm vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx
```

Expected: FAIL because the drawer still receives `ui-drawer--compact` or `ui-drawer--wide`.

- [ ] **Step 3: Apply the stable class and remove the redundant analysis footer action**

Use one class for every phase:

```tsx
<Drawer
  open
  title={t(locale, "导入作品集分析 · 生成 AI 设计师档案", "Portfolio analysis · Create AI designer profile")}
  className="ui-drawer--portfolio"
  locale={locale}
  onClose={onClose}
  footer={footer}
>
```

Remove the `onAddPortfolio` prop from `DesignerEditor`, its call site, and its analysis footer button. Keep `onBackToImport`, which is the single route back to source selection.

- [ ] **Step 4: Run the focused tests**

Run the command from step 2.

Expected: PASS for the stable-width assertions, with any remaining failures limited to tests that still expect editable analysis controls.

### Task 2: Convert The Analysis Result To A Read-only Report

**Files:**
- Modify: `src/app/studio/DesignerLibrary.test.tsx:246-341`
- Modify: `src/app/studio/DesignerLibrary.tsx:1080-1236`

- [ ] **Step 1: Replace editable-result assertions with report semantics**

After the completed candidate is displayed, assert the report content and absence of controls:

```tsx
const report = within(drawer).getByRole("region", { name: "作品集候选的视觉 DNA 分析" });
expect(within(report).getByText("克制构成")).toBeInTheDocument();
expect(within(report).getByText("保留层次")).toBeInTheDocument();
expect(within(report).getByText("#F5F0E6")).toBeInTheDocument();
expect(within(report).getByText("高对比衬线体配合紧凑说明文字，建立清晰而克制的阅读层级。")).toBeInTheDocument();
expect(within(report).getByText("对称网格与非对称垂直流结合，主体沿明确基线推进。")).toBeInTheDocument();
expect(within(report).getByText("粗粝纸张、低对比颗粒与柔和漫反射共同构成触感。")).toBeInTheDocument();
expect(within(report).getByText("柔和纸张漫反射")).toBeInTheDocument();
expect(within(report).getByText("避免霓虹渐变")).toBeInTheDocument();
expect(within(report).getAllByRole("progressbar")).toHaveLength(5);
expect(within(report).queryByRole("textbox")).not.toBeInTheDocument();
expect(within(report).queryByRole("spinbutton")).not.toBeInTheDocument();
expect(within(report).queryByRole("button", { name: /自定义否定/ })).not.toBeInTheDocument();
expect(within(drawer).getByRole("button", { name: "重新解析" })).toBeInTheDocument();
expect(within(drawer).queryByRole("button", { name: "追加作品集" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Add a missing-data test**

Reuse the completed-analysis setup with blank display strings, an empty palette, empty rules, and absent signals. Assert that the localized `未提取` text is present and that metric tracks expose no invented numeric value.

```tsx
expect(within(report).getAllByText("未提取").length).toBeGreaterThan(0);
expect(within(report).getByText("未提取色板")).toBeInTheDocument();
expect(within(report).getByText("未提取否定规则")).toBeInTheDocument();
expect(within(report).queryByText("NaN%")).not.toBeInTheDocument();
```

- [ ] **Step 3: Run tests and verify they fail on the editable form**

Run:

```bash
pnpm vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx
```

Expected: FAIL because the report region and semantic progress bars do not exist and editable controls are still rendered.

- [ ] **Step 4: Make `AnalysisMetric` presentational**

Replace its `onChange` API and number input with text plus an accessible progress bar:

```tsx
const AnalysisMetric = ({ label, value }: { label: string; value: string }) => {
  const hasValue = value.trim() !== "" && Number.isFinite(Number(value));
  const numericValue = percentageFromDraft(value);
  return <div className="portfolio-analysis-metric">
    <span>{label}</span>
    <strong>{hasValue ? `${numericValue}%` : "--"}</strong>
    <span
      className="portfolio-analysis-metric__track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      {...(hasValue ? { "aria-valuenow": numericValue } : {})}
    >
      <i style={{ width: `${hasValue ? numericValue : 0}%` }} />
    </span>
  </div>;
};
```

- [ ] **Step 5: Add read-only value primitives**

Add a local missing-value helper and small display component:

```tsx
const analysisValue = (locale: Locale, value: string): string =>
  value.trim() || t(locale, "未提取", "Not extracted");

const AnalysisValue = ({ label, value, locale }: { label: string; value: string; locale: Locale }) => (
  <div className="portfolio-analysis-value">
    <dt>{label}</dt>
    <dd>{analysisValue(locale, value)}</dd>
  </div>
);
```

Render palette entries as a list of swatch, code, and accessible title; split `tags` on commas and `negativeRules` on newlines before rendering their read-only lists.

- [ ] **Step 6: Replace the editor section with `PortfolioAnalysisReport`**

Create a local component receiving only read dependencies:

```tsx
const PortfolioAnalysisReport = ({ locale, draft, selectionCount, error }: {
  locale: Locale;
  draft: DesignerDraft;
  selectionCount: number;
  error: string;
}) => {
  const palette = draft.palette.split(",").map((value) => value.trim()).filter(Boolean);
  const tags = draft.tags.split(",").map((value) => value.trim()).filter(Boolean);
  const negativeRules = draft.negativeRules.split("\n").map((value) => value.trim()).filter(Boolean);
  return <section
    className="portfolio-analysis-report"
    aria-label={t(locale, `${draft.name}的视觉 DNA 分析`, `${draft.name} visual DNA analysis`)}
  >
    <header className="portfolio-analysis-report__intro">
      <div>
        <p className="section-kicker">{t(locale, "特征解构", "Feature analysis")}</p>
        <h2>{analysisValue(locale, draft.name)}</h2>
      </div>
      <span>{t(locale, `${selectionCount} 项来源 · AI 推断`, `${selectionCount} sources · AI inferred`)}</span>
      <p>{analysisValue(locale, draft.summary)}</p>
      <dl>
        <AnalysisValue locale={locale} label={t(locale, "创作原则", "Creative principle")} value={draft.principle} />
      </dl>
      <ul className="portfolio-analysis-tags" aria-label={t(locale, "风格标签", "Style tags")}>
        {tags.length ? tags.map((tag) => <li key={tag}>{tag}</li>) : <li>{t(locale, "未提取", "Not extracted")}</li>}
      </ul>
    </header>
    <div className="portfolio-analysis-report__grid">
      <AnalysisSection id="analysis-color" icon="palette" title={t(locale, "色彩倾向与光影分布", "Colour and light distribution")} code="COLOR MATRIX">
        <ul className="portfolio-analysis-palette" aria-label={t(locale, "主导色板", "Dominant palette")}>
          {palette.length ? palette.map((color, index) => <li key={`${color}-${index}`}>
            <i style={{ backgroundColor: color }} aria-hidden="true" />
            <span>{color}</span>
          </li>) : <li className="is-empty">{t(locale, "未提取色板", "Palette not extracted")}</li>}
        </ul>
        <AnalysisMetric label={t(locale, "柔和低对比度", "Soft contrast")} value={draft.contrast} />
        <AnalysisMetric label={t(locale, "暗部透气率", "Shadow airiness")} value={draft.darkAiriness} />
      </AnalysisSection>
      <AnalysisSection id="analysis-type-composition" icon="type" title={t(locale, "排版韵律与构图骨架", "Typography and composition")} code="TYPE / GRID">
        <p className="portfolio-analysis-copy">{analysisValue(locale, draft.typography)}</p>
        <p className="portfolio-analysis-copy">{analysisValue(locale, draft.composition)}</p>
        <dl className="portfolio-analysis-values">
          <AnalysisValue locale={locale} label={t(locale, "字体倾向", "Type tendency")} value={draft.typeFamily} />
          <AnalysisValue locale={locale} label={t(locale, "字重偏好", "Weight preference")} value={draft.typeWeight} />
          <AnalysisValue locale={locale} label={t(locale, "字距节奏", "Tracking rhythm")} value={draft.tracking} />
          <AnalysisValue locale={locale} label={t(locale, "构图拓扑", "Composition topology")} value={draft.compositionTopology} />
        </dl>
        <AnalysisMetric label={t(locale, "留白占比", "Whitespace ratio")} value={draft.whitespace} />
      </AnalysisSection>
      <AnalysisSection id="analysis-texture" icon="layers" title={t(locale, "材质肌理与感知参数", "Texture and material perception")} code="TEXTURE / MAT">
        <p className="portfolio-analysis-copy">{analysisValue(locale, draft.texture)}</p>
        <AnalysisMetric label={t(locale, "纹理颗粒度", "Grain")} value={draft.grain} />
        <AnalysisMetric label={t(locale, "光影漫反射率", "Diffuse light")} value={draft.diffuseLight} />
        <dl className="portfolio-analysis-values">
          <AnalysisValue locale={locale} label={t(locale, "着色与材质描述", "Rendering and material")} value={draft.rendering} />
        </dl>
      </AnalysisSection>
    </div>
    <AnalysisSection id="analysis-negative" icon="circle-alert" title={t(locale, "否定规则", "Negative constraints")} code={`${negativeRules.length} RULES`}>
      {negativeRules.length ? <ul className="portfolio-analysis-rules" aria-label={t(locale, "生效规则", "Active rules")}>
        {negativeRules.map((rule) => <li key={rule}><Icon name="circle-alert" size={13} />{rule}</li>)}
      </ul> : <p className="portfolio-analysis-empty">{t(locale, "未提取否定规则", "Negative constraints not extracted")}</p>}
    </AnalysisSection>
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>;
};
```

Update `PortfolioCreationDrawer` to render this component during `phase === "analyse"`, remove `onAnalysisDraftChange` from its props, and delete `setAnalysisField`.

- [ ] **Step 7: Run the focused unit suite**

Run the command from step 3.

Expected: all `DesignerLibrary.test.tsx` tests PASS.

### Task 3: Match The Approved Report Presentation

**Files:**
- Modify: `src/app/studio/library.css:378-827`
- Modify: `tests/e2e/designer-drawer.spec.ts:5-95`

- [ ] **Step 1: Update the E2E contract before styling**

Capture the import width, enter analysis, and require the same width within one pixel:

```ts
await expect(drawer).toHaveClass(/ui-drawer--portfolio/);
const importBox = await drawer.boundingBox();
await page.getByRole('textbox', { name: '作品集链接' }).fill('https://example.com/portfolio');
await page.getByRole('button', { name: '检查页面' }).click();
await page.getByRole('checkbox', { name: '作品集封面' }).check();
await page.getByRole('checkbox', { name: '我确认拥有分析这些来源的权利' }).check();
await page.getByRole('button', { name: '开始分析' }).click();
const analysisBox = await drawer.boundingBox();
expect(Math.abs(analysisBox!.width - importBox!.width)).toBeLessThanOrEqual(1);
await expect(drawer.getByRole('region', { name: '纸间秩序的视觉 DNA 分析' })).toBeVisible();
await expect(drawer.getByRole('textbox')).toHaveCount(0);
await expect(drawer.getByRole('spinbutton')).toHaveCount(0);
```

At the narrow viewport, retain the containment and horizontal-overflow scan. Update section queries to the report panel names and remove editable spinbutton assertions.

- [ ] **Step 2: Run the focused E2E and verify it fails**

Run:

```bash
pnpm playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts
```

Expected: FAIL until the new width class and report layout styles exist.

- [ ] **Step 3: Add the stable drawer and report grid styles**

Add the local drawer rule and establish the three-column desktop report:

```css
.ui-drawer--portfolio {
  inline-size: min(840px, 92vw);
}

.portfolio-analysis-report__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.portfolio-analysis-section {
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border-subtle);
  border-radius: 7px;
  background: var(--surface-container-lowest);
}
```

Replace form-specific selectors with report selectors for the identity summary, palette list, labelled values, metric rows, and warning tags. Keep cards at `7px` radius, use the existing cyan primary accent plus violet and amber section accents, preserve visible wrapping, and set letter spacing to `0`.

- [ ] **Step 4: Add responsive and reduced-motion behavior**

At `max-width: 720px`, collapse the report grid and metric subgrids to one column. Keep the four-step indicator readable without horizontal overflow. Retain the existing reduced-motion rules for loading animation.

```css
@media (max-width: 720px) {
  .portfolio-analysis-report__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

- [ ] **Step 5: Run the focused unit and E2E tests**

Run:

```bash
pnpm vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx
pnpm playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts
```

Expected: both commands PASS at the desktop and narrow viewports.

### Task 4: Verify The Step-3 Transition And Full Change Set

**Files:**
- Modify: `src/app/studio/DesignerLibrary.test.tsx:450-570` only if the current transition test lacks the assertions below
- Modify: `tests/e2e/designer-drawer.spec.ts` to exercise step 3 with a deferred artwork task

- [ ] **Step 1: Assert immediate step-3 feedback in the existing unit test**

Immediately after clicking `下一步：生成形象`, assert:

```tsx
expect(screen.getByText("正在生成设计师形象")).toBeInTheDocument();
expect(screen.getByTestId("portfolio-artwork-skeleton")).toBeInTheDocument();
expect(within(screen.getByRole("list", { name: "生成流程" })).getByText("角色拟合").closest("li")).toHaveClass("is-active");
expect(screen.queryByRole("region", { name: /视觉 DNA 分析/ })).not.toBeInTheDocument();
```

Keep the artwork submission deferred until after these synchronous assertions.

- [ ] **Step 2: Extend E2E to check the unchanged width in step 3**

Stub `submitDesignerArtworkGeneration` with a non-completing promise, click the next button, and assert:

```ts
await expect(drawer.getByText('正在生成设计师形象')).toBeVisible();
await expect(drawer.getByTestId('portfolio-artwork-skeleton')).toBeVisible();
const artworkBox = await drawer.boundingBox();
expect(Math.abs(artworkBox!.width - importBox!.width)).toBeLessThanOrEqual(1);
```

- [ ] **Step 3: Run focused verification**

Run:

```bash
pnpm vitest run --config vitest.config.ts src/app/studio/DesignerLibrary.test.tsx
pnpm playwright test --config playwright.config.ts tests/e2e/designer-drawer.spec.ts
```

Expected: PASS with no editable analysis controls and a visible step-3 loading state.

- [ ] **Step 4: Run repository verification**

Run:

```bash
pnpm test:unit
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all commands exit `0`. If the broader E2E suite is run, report any pre-existing unrelated failure separately rather than changing unrelated code.

- [ ] **Step 5: Inspect the final diff and screenshots**

Review only the intended files plus the existing preceding fixes:

```bash
git diff -- src/app/studio/DesignerLibrary.tsx src/app/studio/library.css src/app/studio/DesignerLibrary.test.tsx tests/e2e/designer-drawer.spec.ts
```

Inspect both Playwright screenshots at `1280x800` and `720x720`. Confirm fixed width within the viewport, no clipped text, no nested cards, no horizontal overflow, footer accessibility, and the report-to-step-3 transition.
