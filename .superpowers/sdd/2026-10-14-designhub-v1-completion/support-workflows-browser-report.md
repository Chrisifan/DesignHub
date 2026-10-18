# Support workflows browser closure report

Date: 2026-10-15. Base: `2c70f05deae90a122a75f492a4b51c463de9f423`.

Status: test/evidence-only closure. No production defect requiring an implementation change was established; no production files were edited.

## Scope and inspected contracts

Read the task brief, production `src/app/studio/Studio.tsx`, `LibraryPages.tsx`, `ui.tsx` and supporting CSS, the shared browser workspace and existing settings/handoff/preference tests, `src/platform/contracts.ts`, asset import/store types, trash/restore types, backup artifact/restore types, workspace settings and diagnostics serialization before editing.

Added `tests/e2e/support-workflows.spec.ts` (seven isolated browser journeys) and `tests/e2e/support-workflows-workspace.ts` (typed `Partial<DesktopApi>` host double). Reused the existing workspace bootstrap and current user-menu routes. Updated M04, M08 and current-status evidence. The bridge fixture merges with the shared bootstrap independent of init-script order, stores host state in per-page sessionStorage across reloads, clones returned structures and computes the PNG content hash. Each default Playwright context starts fresh; no test depends on another test's localStorage.

- Assets: real PNG through normal Import/file chooser, native File/DataTransfer drop and clipboard events on the production import region; exact library ID, first-project fallback among two projects, name, MIME and bytes; visible managed copy, dimensions, detail/source and readAsset payload. Reload invokes production list/read hydration against persisted fixture state.
- Trash: complete real-shaped project ID, original relative path and deletion time; restore result includes projectId/restoredRelativePath; list removes restored entry, confirmed purge removes the remaining row, cancelled confirmation sends no purge, and reload still displays empty trash.
- Backup: choose destination, save exact workspace settings, change schedule to weekly, clear the renderer backup fallback before reload to prove host hydration, create a complete artifact with directory/libraryId/createdAt, verify visible success/time/path, and restore from a selected source to a newly selected parent using exact payloads. All three cancellation points produce no notice or settings/create/restore mutation.
- Settings: warmed production UI with networking disabled exports exactly `{ runtime: 'Electron', errorCode: null }`, handles null cancellation silently, and displays the returned path notice. No diagnostic JSON/content/secret/file-byte return is modeled. Rendered label and custom-select controls persist theme/language through reload. Networking is briefly restored to reload the preview server; this does not claim cold offline startup.

## Commands and observed results

All commands ran in `/Users/sifan/Documents/openSource/DesignHub`.

1. `pnpm exec vite build --config vite.config.ts` — exit 0; 165 modules transformed, production renderer built in 570 ms.
2. `pnpm exec vitest run --config vitest.config.ts src/app/studio/LibraryPages.test.tsx src/features/assets/AssetLibrary.test.tsx src/features/assets/import-assets.test.ts src/features/workspace/backup-schedule.test.ts src/features/settings/diagnostics.test.ts src/desktop/ipc/assets.test.ts src/desktop/ipc/backup.test.ts src/desktop/ipc/diagnostics.test.ts src/desktop/ipc/settings.test.ts src/desktop/ipc/register-support-handlers.test.ts src/desktop/storage/asset-store.test.ts src/desktop/storage/settings-store.test.ts tests/integration/assets-import.test.ts tests/integration/backup-migration.test.ts tests/integration/trash-restore.test.ts tests/integration/desktop-boundary.test.ts` — exit 0; 16 files / 107 tests passed, 3.38 s.
3. `pnpm exec playwright test --config playwright.config.ts tests/e2e/project-handoff.spec.ts tests/e2e/offline-settings.spec.ts tests/e2e/studio.spec.ts --grep 'project handoff|project package import|settings shell|preferences survive reload' --workers=1` — exit 0; 4/4 passed, 16.2 s.
4. Initial `pnpm exec playwright test --config playwright.config.ts tests/e2e/support-workflows.spec.ts --workers=1` — exit 1; 4 passed / 3 failed. The new test incorrectly treated the custom combobox as a native select, waited for an absent empty-notice status element and expected the intentionally clipped duplicate Settings heading to be visible. Corrected test assumptions only.
5. `pnpm exec playwright test --config playwright.config.ts tests/e2e/support-workflows.spec.ts --grep 'Backup persists|Cancelled backup|Settings exports' --workers=1` — 2 passed / 1 failed; the invisible theme input receives its user interaction through the enclosing visible label. Corrected the test to click that label and assert the radio checked state.
6. `pnpm exec playwright test --config playwright.config.ts tests/e2e/support-workflows.spec.ts --grep 'Settings exports' --workers=1` — first follow-up failed on the assumption language changes preserve the current page. Traced the existing Studio locale-dependent hydration effect, which returns to Projects (also consistent with existing preference regression). Kept this behavior and re-entered Settings through the menu. The same focused command then passed 1/1, 8.7 s. These were test-authoring failures, not product RED evidence.
7. Final `pnpm exec playwright test --config playwright.config.ts tests/e2e/support-workflows.spec.ts tests/e2e/project-handoff.spec.ts tests/e2e/offline-settings.spec.ts tests/e2e/studio.spec.ts --grep 'Assets imports|Trash shows|Backup persists|Cancelled backup|Settings exports|project handoff|project package import|settings shell|preferences survive reload' --workers=1` — exit 0; 11/11 passed, 1.0 min (all seven new cases plus four existing regressions).
8. `pnpm typecheck` — exit 0, including the final test edits. `pnpm exec eslint tests/e2e/support-workflows.spec.ts tests/e2e/support-workflows-workspace.ts --max-warnings=0` — exit 0, no warnings.
9. `pnpm docs:check` — exit 0; documentation link check passed, 193 files. `git diff --check` — exit 0.

## Self-review

Checked requirement coverage against the brief and reviewed both new files and evidence edits. All support doubles satisfy the typed bridge, including managed asset hash/decode/managed fields, complete trash entries and restore result, complete backup artifact/restore result, workspace formatVersion/backup settings and diagnostics path-or-null. Fixture state survives refresh/reload; assertions prove both boundary inputs and production-visible effects. No replacement markup, hidden-control forcing, timers/sleeps, cross-test storage dependency or production mock hook was added. UTC is fixed per test for displayed timestamps; filenames, IDs, paths and bytes are deterministic. The production locale-to-Projects behavior, user-menu first-project fallback and current controls remain unchanged.

No project-package export, canvas file picker, designer navigation, provider semantics, credential storage or native picker contract changed. Existing dirty credential/main/provider-resolver/native credential files were neither edited, formatted nor staged. Only task-owned browser tests, verification records and this report are included in the task commit.

## Remaining external limits

Browser bridge doubles prove renderer wiring, not native dialog correctness or actual filesystem/diagnostic writes. Real macOS/Windows file/directory/save dialog interaction and cancellation, native clipboard/drag source behavior, cross-device restore, Windows/reparse-point semantics, filesystem/process interruption and disk-full behavior, packaged codecs, large-image behavior, manual diagnostic package scanning, cold offline startup, accessibility/manual UX and signed packaged releases remain open. Scheduled backup timer execution is covered by existing schedule unit tests; this browser task checks schedule persistence and manual create/restore, not elapsed-day execution. No external gate is closed by this evidence.
