# Model Task List Display Design

## Goal

Make the model-task history easier to scan while preserving its existing filters and task actions.

## Layout

Use one compact six-column table:

`Task type | Status | Summary | Result | Time | Actions`

- Result information is separated from time and centered in a stable-width column.
- Generation progress is shown in the result column. Its expandable slot details remain available without shifting the main row.
- Time is formatted with the active application locale and the operating system's local time zone. The compact cell shows date, hour, and minute; its title exposes the full localized timestamp.
- The header remains fixed at the top of the task list while the page content scrolls. It uses an opaque background and stacking context so rows cannot show through it.

## Ordering And Data Projection

- Filter tasks with the existing category rules.
- Sort the filtered copy by `updatedAt`, falling back to `createdAt`, newest first.
- Break equal timestamps deterministically by task ID in descending order.
- Do not mutate the task array returned by storage.
- Show generation progress first in the result column, then image count. Show an em dash when neither exists.
- Keep cost as secondary result metadata rather than mixing it with time.

## Compatibility

Existing status filters, stop, retry, generation-slot retry, empty states, and polling behavior remain unchanged. Missing or invalid timestamps render as an em dash and sort after valid timestamps.

## Verification

- Component tests cover newest-first ordering, localized time output, the six headers, and the dedicated result cell.
- CSS contract coverage verifies the sticky header and centered result column.
- Run focused tests, unit tests, type checking, lint, build, and `git diff --check`.
- Inspect the Electron task page to verify alignment and sticky behavior with real scrolling.
