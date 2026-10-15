# Stage 2 batch browser workflow closure report

Date: 2026-10-15. Base commit: `d30b3ca164ee833ffa1b4c36453870fde9eedb4d`.

## Result

The real rendered browser journey is closed for the requested renderer scope. Six new Playwright cases exercise the production application, current user menu, lazy-loaded `ImageToolsPage`, command facade and typed desktop bridge. A real clipped-controls defect was exposed, captured RED before production edits, and fixed by excluding only the interactive image-tools header from the global screen-reader clipping selector. This is not a test/evidence-only change: it includes that minimal CSS fix. No backend, credentials, product navigation, project-package scope, native picker contract, executor or output-naming behavior changed.

Task-owned files:

- `tests/e2e/image-tools-workflow.spec.ts`
- `tests/e2e/image-tools-workspace.ts`
- `src/app/styles/studio.css`
- `docs/verification/CURRENT-STATUS-2026-10-14.md`
- `docs/verification/M07.md`
- this report (explicitly requested; force-added because `.superpowers` is ignored)

## Inspection and implementation

Before editing, inspected the actual `Studio.navigate`/destination rendering, `StudioUserMenu`, `LibraryPages` batch bridge callbacks and one-second list refresh, `ImageToolsPage`, shell/configurator/job list/job details/item details, commands/view-model/job types and scheduler transitions. Also read the existing `tests/e2e/test-workspace.ts`, `tests/e2e/image-tools-layout.spec.ts`, `tests/fixtures/image-tool-job.ts`, and desktop contracts. The old layout spec replaces `document.body` with static markup and remains CSS-only evidence; none of the new workflow tests do that.

The new fixture extends the existing test workspace only at `window.designhub`. It uses complete `ImageToolJobSnapshot` records from the existing typed factory, including identity, item IDs, source/output roots, params, state, timestamps, schema, library, local executor and per-item attempts. Picker results include `kind`, `path`, and `displayName`. Scan results include source type/root, accepted absolute/relative paths and bytes, rejected records and output paths. Bridge mutations update the recorded job/item state and return detached snapshots; real renderer refreshes consume these snapshots. Worker completion is published into the fake persisted store, not injected into the DOM. Tests assert visible state transitions and exact production bridge payloads, not the existence of doubles.

Coverage:

1. Four separate cases enter remove-background, upscale, resize and format-convert through the existing user menu. Each checks the correct production heading, tool value and composer. Provider tools expose the configured editing connection; local tools expose format controls without a provider selector.
2. The local resize journey chooses source/output, edits width/height and isolated folder name, keeps Create disabled until scanning, renders two accepted images plus a rejected `notes.txt`, creates the job, and verifies an actual list call follows creation.
3. A store-side completion update is consumed by the unchanged one-second renderer poll. Visible progress changes from `0 / 2` to `2 / 2`, results show `640 × 480`, and the result drawer shows the persisted path, preview and attempt.
4. Exact persisted `libraryId`, `jobId`, and result `path` are asserted for read/open/reveal; output opening uses the persisted job output root. Import additionally carries the current existing project context. The job ID deliberately differs from the user folder name and item identities, catching identity mix-ups.
5. The completed-results view reopens New job using a normal click, proving the entry remains reachable after the empty-state shortcut disappears.
6. The lifecycle case pauses/resumes/cancels one job, with refreshed visible controls and cancelled cards. It then selects a separate persisted recovery job through the real sidebar, retries failed and unknown items, and sees attempts increment to 2, Retry disappear, and queued cards appear. Recorded control payloads contain exact persisted job/item IDs. The fixture is installed once per journey; lifecycle call history remains intact.

## RED and minimal fix

Root cause: the final `.page-heading` rule in `src/app/styles/studio.css` absolutely positions, clips and reduces headers to 1px for screen readers. `ImageToolsShell` places its interactive New job button and batch-tool selector inside that header. The buttons exist in DOM tests but normal rendered clicking is intercepted by the workbench. Other pages can use toolbar-owned controls; this batch header still owns its actions.

Before production edits:

```text
pnpm exec vite build --config vite.config.ts
exit 0

pnpm exec playwright test --config playwright.config.ts tests/e2e/image-tools-workflow.spec.ts --workers=1
exit 1: 5 failed / 1 passed
Four route cases found production headings hidden.
Local resize timed out clicking New job; the workbench intercepted pointer events.
Lifecycle rendering/control case passed.

pnpm exec playwright test --config playwright.config.ts tests/e2e/image-tools-workflow.spec.ts --workers=1 -g 'local resize' --timeout=10000
exit 1: 1 failed
10-second timeout at the normal New job click, with workbench pointer interception.
```

Only after observing the focused RED, changed the final selector to `.page-heading:not(.image-tools-page__header)` and updated its comment. Existing batch header layout/design rules now apply normally. No component or command rewrite was needed.

## Commands and fresh results

All commands ran in `/Users/sifan/Documents/openSource/DesignHub`.

```text
pnpm exec vite build --config vite.config.ts
exit 0 after the fix: 165 modules; initial JS chunk 438.10 kB;
ImageToolsPage remains a separate lazy chunk (31.34 kB).

pnpm exec playwright test --config playwright.config.ts tests/e2e/image-tools-workflow.spec.ts --workers=1
exit 0: 6 passed (27.5s), after the CSS fix.

pnpm exec playwright test --config playwright.config.ts tests/e2e/image-tools-workflow.spec.ts tests/e2e/image-tools-layout.spec.ts --workers=1
final exit 0: 9 passed (26.0s).
Six production workflows plus three separate historical CSS probes.

pnpm exec vitest run --config vitest.config.ts src/features/image-tools/ImageToolsPage.test.tsx src/features/image-tools/image-tool-commands.test.ts src/desktop/ipc/image-tools.test.ts src/desktop/ipc/register-image-tools.test.ts tests/integration/desktop-boundary.test.ts
exit 0: 5 files / 35 tests passed (2.91s).
Includes renderer page/commands, registered result safety, IPC registrar and trusted renderer boundary.

pnpm exec eslint tests/e2e/image-tools-workflow.spec.ts tests/e2e/image-tools-workspace.ts --max-warnings=0
final exit 0, no diagnostics.

pnpm typecheck
Earlier post-fixture-correction snapshot: exit 0.
Intermediate concurrent-work snapshot: exit 2:
tests/integration/credential-boundary.test.ts(70,52): TS2554 Expected 1 arguments, but got 2.
tests/integration/credential-boundary.test.ts(70,53): TS7006 Parameter 'connectionId' implicitly has an 'any' type.
Latest requested rerun: exit 0, no diagnostics.
No credential-boundary or credential implementation file was changed by this task.
```

Development-only test corrections: the initial typed fixture omitted native selection `kind` fields and needed an explicit cast for a test-only window property; these were corrected before production changes. After strengthening lifecycle coverage to retain both persisted jobs and choose through the real sidebar, one intermediate combined run was 8 passed / 1 failed because the sidebar intentionally truncates long content names to `recover...`. The locator was corrected to target the visible truncated name. That test-only mismatch required no production change; the final combined run above is green.

`git diff --check` and documentation link validation are recorded in the final verification addendum below. Playwright emitted only existing `NO_COLOR`/`FORCE_COLOR` environment warnings. No new browser runner/config/dependency was added.

## Project context and concerns

Import is reachable with current semantics: `Studio.navigate` clears `selected`, but `LibraryPages` receives `projectId={selected?.id ?? projects[0]?.id}`. The unmodified existing workspace fixture provides project `project-e2e`; the exact import payload is `{ libraryId: 'library-e2e', projectId: 'project-e2e', jobId: 'persisted-resize-browser-job', path: '/tmp/batch-browser-output/browser-results/portrait.png' }`. No project/context/navigation was fabricated solely to reach import. This does not establish retained selection or a user-chosen target with multiple projects. Empty-library import remains outside this successful journey.

The current local create callback also forwards the configured `connectionId: 'openai-compatible'`; the test records that existing payload rather than changing it. The persisted resize executor remains local (`image-codec`), and actual codec/provider distinction remains covered by existing backend tests. Browser evidence alone does not prove native picker UI, local encoding or provider execution.

The shared checkout contains unrelated concurrent credential/main/provider-resolver/native changes. Their intermediate typecheck failure and later green snapshot are explicitly separated above. This task neither edits nor stages them, and the passing latest typecheck is evidence for that observed working-tree snapshot, not an independent credential assessment.

Windows, packaged codecs/native modules, filesystem interruption, Windows reparse points/junctions, hostile post-check replacement races, real provider processing/quality and broader release evidence remain open. Existing desktop IPC tests remain authoritative for filesystem safety; mocked browser bridge success must not be presented as native filesystem proof.

## Self-review

- Requirements 1–6: met by four real menu-route tests and two rendered workflow/lifecycle tests; there is no replacement application markup or component stub. Only the external desktop boundary is doubled, with complete typed snapshots and consistent store mutations.
- Requirement 7: four-tool set, native picker shape, isolated output naming, provider/local distinction, package scope and renderer design are preserved. The CSS change restores the already-defined batch header rather than introducing a new flow.
- Requirement 8: actual defect recorded RED before production edit; minimal selector fix then passed the same real journey.
- Requirement 9: both requested verification documents now distinguish rendered browser evidence from native/security/external gates.
- Requirement 10: required focused Playwright, page/commands/IPC/registrar checks, task-file ESLint and latest full typecheck have fresh green output; final diff/doc checks are in the addendum.
- Requirement 11: only the six listed task files will be staged and committed. Existing unrelated dirty files remain untouched.
- Mutation review: clipping the header again breaks normal entry clicks; wrong tool routing breaks route value/composer checks; dropping scan preflight breaks disabled/Create checks; missing list refresh breaks rendered progress/attempts; swapping job/item/path arguments breaks exact payload assertions; dropping import context breaks import payload matching.
- No subagents or reviewers were spawned. No broad formatting, dependency changes, native/provider execution or unrelated cleanup was performed.

## Final verification addendum

```text
pnpm docs:check
exit 0: Documentation link check passed (193 files).

git diff --check
exit 0: no diagnostics.
```

Only documentation/report text changed after the last green browser/typecheck/ESLint run. A final staged diff check and explicit path-limited commit protect the unrelated dirty working-tree files from inclusion.
