# Read-only Designer Analysis Drawer Design

## Goal

Make the AI designer creation drawer keep one stable width throughout its four-step workflow and present the portfolio analysis as a read-only visual report. The report should follow the supplied design reference instead of presenting generated values as editable form fields.

## Scope

This change covers the portfolio-based AI designer creation drawer in `DesignerLibrary.tsx` and its styles and tests.

It does not change the portfolio analysis response schema, task execution, artwork generation, publishing behavior, or the separate editor for an already-created designer.

## Interaction Design

The creation drawer uses one width rule in every phase:

- Desktop: `min(840px, 92vw)`.
- Narrow viewports: the same rule naturally contracts to `92vw`.
- Moving between import, analysis, artwork, and review never changes the drawer width.

The analysis phase is fully read-only. It contains no text inputs, text areas, number inputs, sliders, or custom-negative-rule affordance. Its footer provides these actions:

1. Return to import.
2. Reanalyse the selected portfolio sources.
3. Continue to artwork generation.

The existing "Add portfolio" action is removed from the analysis footer because returning to import already provides the source-editing path.

Continuing from analysis immediately changes the active wizard phase to step 3. While artwork is being generated, step 3 displays the existing artwork-generation progress animation and skeleton. Generated artwork never appears beneath the step-2 report.

## Analysis Report Layout

The report uses native read-only markup rather than disabled or visually disguised form controls.

The introduction contains:

- Designer name.
- Number of analysed sources and the AI-inferred label.
- Style summary.
- Creative principle.
- Style tags.

The main report follows the supplied reference and groups the extracted visual DNA into three information panels:

### Colour And Light

- Dominant palette shown as swatches with hexadecimal labels.
- Soft-contrast percentage shown as a value and progress bar.
- Shadow-airiness percentage shown as a value and progress bar.

### Typography And Composition

- Typography traits and composition traits shown as explanatory text.
- Preferred type family, weight, tracking, and composition topology shown as compact labelled values.
- Whitespace ratio shown as a value and progress bar.

### Texture And Material

- Texture traits shown as explanatory text.
- Grain and diffuse-light values shown as percentages and progress bars.
- Rendering and material description shown as a labelled value.

Negative constraints appear below the three panels as read-only warning tags. The report does not offer add, edit, or delete operations for these rules.

On narrower viewports, the three panels collapse to a single column while preserving their reading order. Text wraps within its panel and does not force the drawer wider.

## Component Design

`PortfolioCreationDrawer` continues to own phase selection and renders a dedicated `PortfolioAnalysisReport` for a completed analysis.

`PortfolioAnalysisReport` receives the localized `analysisDraft`, source count, locale, and any current error. The draft remains an internal view model and downstream generation input, but the report cannot mutate it.

Reusable report primitives have narrow responsibilities:

- `AnalysisSection` provides a titled panel with its code label and accent.
- `AnalysisMetric` renders a label, clamped percentage, value, and visual track without an input.
- Palette and constraint collections render semantic lists so their content remains accessible and testable.

The `onAnalysisDraftChange` prop and the analysis-field change handlers are removed from the creation drawer path. Editing an existing published designer remains unchanged.

## Data Flow

1. Portfolio analysis produces a `PersonaProfile`.
2. Existing normalization creates the localized `analysisDraft` view model.
3. The report reads that view model without modifying it.
4. Reanalyse replaces the profile and draft with a new task result.
5. Continue passes the unchanged result into the existing artwork-generation flow.
6. Artwork generation moves the wizard to step 3 immediately and later populates the artwork choices.

No API or persisted-data migration is required.

## Missing And Error States

- A missing text value is displayed as a localized "Not extracted" placeholder.
- An empty palette or negative-rule collection displays a localized empty-state message rather than an empty container.
- Metric values are clamped to the `0-100` visual range. Missing metrics display `--` and an empty track.
- A missing complete analysis result continues to use the existing analysis loading state.
- Task failures continue to use the existing error alert and retry path.
- Reduced-motion preferences continue to disable progress and skeleton animation.

## Accessibility

- Report sections use headings and lists rather than form labels without controls.
- Percentage values remain available as text; progress bars are supplemental visuals.
- Palette swatches include their colour codes as visible text.
- Warning tags retain readable text and are not communicated by colour alone.
- Existing drawer focus handling, close behavior, and footer button semantics are preserved.

## Testing

Unit tests will verify:

- Every wizard phase uses the same drawer width class.
- The completed analysis contains no editable text, number, or multiline controls.
- Identity, colour, typography, composition, texture, rendering, metrics, and negative constraints are visible.
- Missing fields render stable placeholders.
- Reanalyse remains available.
- Continuing from analysis enters step 3 and shows the artwork-generation loading state.

The focused Playwright test will verify:

- Drawer width does not change between import, analysis, and artwork phases.
- The analysis report fits inside the drawer.
- The report footer and all result sections remain reachable by scrolling.
- The step-3 loading animation appears after continuing.
- Desktop and narrow-viewport screenshots have no clipping or overlapping content.

Existing typecheck, lint, build, and focused designer-drawer tests remain part of completion verification.
