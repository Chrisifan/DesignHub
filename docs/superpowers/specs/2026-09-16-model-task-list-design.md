# Model Task List Design

## Goal

Make the model-task page scannable by moving status totals into the shared breadcrumb toolbar and rendering every task as a compact, single-line record.

## Scope

The breadcrumb toolbar gains the task page's first-position category control. It contains mutually exclusive filters for `全部`, `排队`, `处理中`, `已完成`, and `失败`, each with its current count. `失败` includes failed, cancelled, and result-unknown records so every terminal problem state remains discoverable. The page starts on `全部` and applies the selected category immediately to the task list.

The page-local three-column summary (`排队 / 处理中 / 本次会话`) is removed. The existing page header stays as the page context; only task controls are moved to the toolbar, consistent with the established category-first toolbar order.

Each visible task becomes one horizontal row in this visual sequence: task type, state badge, task summary, time/result metadata, then an optional end-aligned icon action. The task summary prioritizes the request text; when it is absent, it uses the source identifier or request identifier. A failed task incorporates its provider-failure explanation in that same summary area. Completed-task image count and cost appear together in the metadata area.

Queued and running records expose a compact stop icon at the row end. Retriable failed or cancelled records expose a compact retry icon there. Existing cases that require the user to choose sources again continue to show their guidance, incorporated into the row's summary rather than creating a separate wrapped line.

## Layout and overflow

Task rows use a stable grid/flex layout with `min-width: 0` on text regions. The type, summary, source/request ID, error explanation, result metadata, and date are all constrained to one line and truncate with ellipsis when the viewport cannot fit them. The complete underlying text remains available through the native `title` attribute on truncated text. Rows never gain height because of long requests, IDs, or provider errors.

The task list supports narrow screens by preserving the one-line record and allowing horizontal scrolling in the list container instead of wrapping its content. Action buttons remain visible at the row end. Toolbar categories use the existing segmented-control visual language and follow its responsive behavior.

## State and data flow

`TasksPage` owns the selected task category and derives filtered records plus category counts from the task records it already loads. The toolbar slot is active only while the task page is active, preventing its controls from leaking into another library page. `LibraryPages` passes the existing `active` flag through to `TasksPage`, matching the assets and delivery pages.

Task loading, cancellation, retrying, localization, empty state, and the existing desktop API contracts remain unchanged. The empty state reflects the active filter: an empty workspace continues to say there are no model tasks, while a filter with no matching tasks communicates that no records match the selected category.

## Accessibility and verification

Category buttons form a labelled, mutually exclusive segmented group and expose their selected state via `aria-pressed`. Task rows keep the existing task-list label; the compact action icons receive localized accessible labels. Full task content remains discoverable by native tooltips when visual truncation occurs.

Add focused LibraryPages tests for toolbar category filtering and counts, the absence of the old summary region, compact stop/retry actions, and a row structure that retains long task text without additional `<small>` lines. Run the focused test file, then `pnpm test:unit`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`.
