# DesignHub V1 Release Verification

Status: prepared for execution. Local/offline V1 paths are implemented and regression-tested; this record distinguishes browser preview evidence from native Electron, real-provider, and signed-package evidence.

## REL01: Spring Market end-to-end journey

1. Create a local workspace.
2. Create designer A from a description and confirm its persona draft.
3. Create a project manually, import the original artwork, and request two directions.
4. Edit Chinese copy, then switch to designer B and request a background change.
5. Create a square related document, select final revisions for both documents, export PNGs, and create a project package.
6. Open the package in a second workspace/device and verify history, source assets, offline editing, and A/B contribution attribution.

Expected evidence: final PNG magic/dimensions/pixels, two final revision IDs, immutable A/B contribution records, package manifest and SHA-256 values.

## REL02: alternate creation paths

- Conversation creation produces a reviewable brief task and does not create a project before confirmation.
- Portfolio creation requires rights confirmation, selected sources, and produces a reviewable designer draft.

## REL03: provider disclosure and cancellation

- First original-image upload shows scope, destination, and cost unknown when not provider-confirmed.
- Missing connection, cancellation, rate limiting, partial candidate failure, and unknown remote result each provide a concrete recovery action.

## Native and release gates

- [x] macOS packaged Electron: main/preload paths and native module unpacking verified with the packaged storage smoke; credential persistence and upgrade/uninstall data retention remain open.
- [ ] Windows packaged Electron: the same checks on a real Windows host.
- [ ] Signed/notarized artifacts and exact hashes recorded.
- [ ] Real provider adapters, licensed image-tool samples, and 100-project/long-history performance sample.

## 2026-09-14 release-closure implementation

- Added an offline provider conformance harness covering conversation, streaming, vision, image generation and image editing. The harness returns per-capability results and redacted errors without making network requests.
- Added `pnpm test:provider` and an opt-in `pnpm provider:live-smoke`. Live smoke requires `DESIGNHUB_LIVE_PROVIDER=1` plus explicit endpoint, key and model variables; without them it exits as `blocked`.
- Added optional `ImageMetadata.colorSpace` reporting and fail-closed sRGB validation during image export.
- Added `PackageClosureReport` to explain included and excluded package entries without changing the existing editable/read-only package policy.
- Added `pnpm release:check`, Forge ZIP/DMG/Squirrel makers, and a macOS/Windows GitHub Actions matrix. The release check exits non-zero only for failed local gates and reports missing Windows, signing, live-provider or packaged-native prerequisites as blockers.
- `release-check` runs local gates serially in this order: unit, integration, browser E2E, native Electron, lint, typecheck, build, optional package, then `git diff --check`. The final JSON report has `status`, per-command results, package content scan results, and explicit external blockers.
- Package scanning checks both artifact paths and credential-shaped values in generated files. It never prints file contents or environment values.
- Project package closure excludes credentials, conversations, fonts and unarchived `references/` material; the closure report records each exclusion reason.
- `pnpm test:install-upgrade` is an explicit manual evidence entry point. It remains `blocked` until `DESIGNHUB_INSTALL_SMOKE=1` and a reviewed marker JSON confirms install, upgrade, uninstall, and workspace retention on a real macOS or Windows host.
- Added temporary-workspace portfolio retention/discard integration coverage. Raw source bytes remain in memory only until the inspection is explicitly discarded.

## 2026-09-14 final local gate evidence

- `pnpm release:check` completed serially with unit 101 files / 477 tests, integration 25 files / 115 tests, browser E2E 25/25, source native 2 passed / 1 packaged-path skip, lint, typecheck, build and `git diff --check` all passed. Package scan covered 386 generated files with no credential-shaped paths or values.
- A fresh `pnpm package` completed for macOS arm64. Running `DESIGNHUB_PACKAGED_APP_PATH=out/designhub-darwin-arm64/designhub.app/Contents/MacOS/designhub pnpm test:native` passed 3/3, including packaged storage. Executable SHA-256: `588478afc5f2bc73b6433d6e565a214dc830144be39a3d79805723292754ccd8`.
- `pnpm test:provider` passed the offline fixture suite; `pnpm provider:live-smoke` returned `blocked` (exit 2) without explicit live-provider configuration, as required. `pnpm test:install-upgrade` remains an explicit blocked/manual evidence entry point until a reviewed marker is supplied.
- External blockers remain honest and unchanged: Windows packaged behavior, signing/notarization credentials, explicit OS Keychain persistence evidence, real provider quality/cost/remote cancellation, cross-device package recovery, advanced codec fidelity, large-image performance and human visual QA.

Browser preview tests are not evidence for the native gates above. No release artifact is uploaded by this plan.

## 2026-09-12 execution evidence

- `pnpm test:e2e -- tests/e2e/full-design-journey.spec.ts tests/e2e/failure-recovery.spec.ts`: 24/24 passed, including the existing studio navigation matrix. Headless Chromium reports `backdrop-filter: none`; the test accepts this documented reduced-transparency fallback while retaining native blur verification as an open gate.
- `pnpm test:native`: source/native smoke and main-process storage passed; packaged storage test is covered separately with the packaged executable below.
- `pnpm package`: macOS arm64 package completed locally; `DESIGNHUB_PACKAGED_APP_PATH=out/designhub-darwin-arm64/designhub.app/Contents/MacOS/designhub pnpm test:native` → 3 passed. Executable SHA-256 is `588478afc5f2bc73b6433d6e565a214dc830144be39a3d79805723292754ccd8`; signed artifact, Windows package, keychain persistence, and installer upgrade evidence remain open.
- Latest application regression after M03 portfolio task bridging, M05 scene bootstrap, M06 retry/review, M07 desktop export, and M08 diagnostics export: `pnpm test:unit` 73 files/231 tests, `pnpm test:integration` 22 files/96 tests, `pnpm test:e2e` 24/24, `DESIGNHUB_PACKAGED_APP_PATH=out/designhub-darwin-arm64/designhub.app/Contents/MacOS/designhub pnpm test:native` 3/3, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check` all passed.
- The implemented offline path now includes workspace project creation/reopen, designer persistence and artwork rendering, project-scoped asset import/list/read, document scene hydration/save through Konva, and provider credential write/delete without renderer read-back.
- The implemented local delivery path now also includes inspector scene persistence/bootstrap, native PNG/JPEG/PDF export with hash, redacted diagnostics export, explicit task retry execution, and creation-draft brief review before project creation.

## 2026-09-13 execution evidence

- Portfolio designer analysis now polls a running task to completion with a bounded 12-attempt/500ms schedule; the focused `DesignerLibrary` suite reports 15/15 passed, including failed, unavailable, and fake-timer completion paths.
- Latest full regression after image-tool selection, candidate persistence/finalization, portfolio review and polling: unit 83 files/294 tests, integration 23 files/100 tests, browser E2E 24/24, native 2 passed/1 skipped (packaged executable path not configured), `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check` all passed.
- Packaged macOS arm64 native regression was then rerun with `DESIGNHUB_PACKAGED_APP_PATH=out/designhub-darwin-arm64/designhub.app/Contents/MacOS/designhub`: 3/3 passed, including the packaged storage smoke.
- Remaining release gates are external: real provider quality/cost/cancellation, authorized portfolio transport, native generated persona assets, Windows host behavior, signed/notarized artifacts, keychain persistence, cross-device package closure, advanced codec fidelity, large-image performance, and human visual QA.

- M03 description creation closure: `DesignerLibrary` focused suite 16/16 passed after adding workspace `designer-draft` submission and completed-result review. This verifies task binding and honest failure behavior only; model quality and generated artwork remain external release gates.
- Post-change full regression: unit 83 files/295 tests, integration 23 files/100 tests, browser E2E 24/24, lint, typecheck, build and diff check passed. Native source smoke passed 2/2 with one packaged-path skip; the existing macOS arm64 packaged executable passed all 3/3 native tests.
- Immediate-completion designer task regression: completed results returned directly by submission are now reviewed without a second list call. Latest unit count is 83 files/296 tests; integration 23 files/100 tests, E2E 24/24, lint, typecheck, build, diff check, and native source smoke passed. The existing packaged executable also passed 3/3 native tests; it was not rebuilt for this renderer-only fix.

- Related-size document entry: a finalized source document can create an independent 1080x1080 (or user-specified) document while preserving source document/revision provenance. Focused Studio/metadata regression passed 22/22; automatic layout conversion and cross-document visual QA remain open release gates.

- Multi-contributor attribution and related-scene conversion: project credits can include multiple designer versions, revisions preserve lead/direction roles, and related-size creation scales the finalized source scene into an independent document. Affected focused suite passed 53/53; semantic layout reflow and human visual QA remain release gates.

- Custom persona artwork now remains visible on project detail pages for persisted profiles, with an explicit unavailable fallback when no artwork is available. Focused `DesignerHero` regression passed 1/1; generated bitmap persistence remains an external gate.

- New-design now carries persisted custom persona options into its selector and hero. Focused NewDesignPage regression passed 3/3; native generated bitmap persistence remains an external gate.

- Delivery now exposes WebP, backed by the existing native export codec. Focused delivery/Library suites passed 39/39; color-profile fidelity and packaged codec verification remain open.
- Delivery source selection now exports the explicitly finalized revision scene when requested, with a fail-closed error when the revision snapshot is unavailable. `LibraryPages` focused suite passed 22/22; full regression is required because this changes the M04 revision-to-M07 delivery boundary.

- Post-M07 finalized-delivery regression: `pnpm test:unit` 84 files/303 tests, `pnpm test:integration` 23 files/100 tests, `pnpm test:e2e` 24/24, `pnpm test:native` 2 passed/1 skipped (packaged path not configured), `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check` all passed on 2026-09-13. The packaged macOS executable was not rerun in this pass because the existing artifact predates the renderer-only change; Windows, signing, keychain persistence, provider quality, and manual image QA remain external gates.
- Post-M05 canvas and M07 delivery regression: `pnpm test:unit` 84 files/308 tests, `pnpm test:integration` 23 files/100 tests, `pnpm test:e2e` 24/24, `pnpm test:native` 2 passed/1 skipped (packaged path not configured), `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check` all passed on 2026-09-13. The packaged macOS executable remains an earlier artifact; Windows, signing, keychain persistence, provider quality, and manual image QA remain external gates.
- Post-M07 archive-copy regression: `pnpm test:unit` 84 files/309 tests, `pnpm test:integration` 23 files/100 tests, `pnpm test:e2e` 24/24, `pnpm test:native` 2 passed/1 skipped (packaged path not configured), `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check` all passed on 2026-09-13. The packaged macOS executable remains an earlier artifact; Windows, signing, keychain persistence, provider quality, and manual image QA remain external gates.
- Latest M06/M07 delivery and retry regression: `pnpm test:unit` 93 files/384 tests, `pnpm test:integration` 23 files/105 tests, `pnpm test:e2e` 24/24, `pnpm test:native` 2 passed/1 skipped, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check` all passed on 2026-09-13. Export history is persisted in the workspace and supports target liveness plus explicit historical re-export; managed image edits can retry from persisted source assets. Packaged Windows, signing, keychain, real providers and human image-quality gates remain external.
- Latest M06/M08 restart-recovery regression: `pnpm test:unit` 93 files/385 tests, `pnpm test:integration` 23 files/105 tests, `pnpm test:e2e` 24/24, sequential `pnpm test:native` 2 passed/1 skipped, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check` all passed on 2026-09-13. Persisted queued/running tasks are converted to `RESULT_UNKNOWN_AFTER_RESTART` and require explicit retry; no provider request is replayed during hydration. The native suite must run after the build completes because concurrent main/preload output replacement can start Electron on the welcome screen; this is a test execution ordering constraint, not application behavior. Packaged Windows, signed release, keychain, remote result lookup and real-provider gates remain external.
- Packaged recovery gate rerun: `pnpm package` completed for macOS arm64, then `DESIGNHUB_PACKAGED_APP_PATH=out/designhub-darwin-arm64/designhub.app/Contents/MacOS/designhub pnpm test:native` passed 3/3 on 2026-09-13. The packaged executable SHA-256 remains `588478afc5f2bc73b6433d6e565a214dc830144be39a3d79805723292754ccd8`; Windows, signing/notarization, keychain persistence, remote result lookup and real-provider gates remain external.

- M03/M06 portfolio image-source transport focused regression: `pnpm exec vitest run --config vitest.config.ts src/features/agent/task-service.test.ts src/desktop/ipc/agent.test.ts src/app/studio/DesignerLibrary.test.tsx` passed 3 files / 41 tests; `pnpm lint`, `pnpm typecheck`, and `git diff --check` passed. The renderer now submits explicit HTTP(S) and local-file vision sources through the dedicated bridge; authorized page/archive fetching, native persona artwork, provider quality and cross-platform image behavior remain external gates.

- Post-portfolio full regression: `pnpm test:unit` passed 93 files / 388 tests, `pnpm test:integration` passed 23 files / 105 tests, and `pnpm test:e2e` passed 24/24. `pnpm build` passed; source native smoke passed 2/3 with the packaged-path case skipped when no path was supplied, and the existing macOS arm64 executable passed 3/3 when supplied through `DESIGNHUB_PACKAGED_APP_PATH`. A fresh `pnpm package` attempt failed during Electron Forge copy/finalization with `RequestError: socket hang up`; this is retained as a network/package-cache gate and does not invalidate the source build or existing packaged smoke evidence.

- Retry disclosure regression: failed portfolio vision tasks and image edits without retained inputs no longer expose a no-op retry action; focused task-service/LibraryPages suites passed 2 files / 54 tests, with lint, typecheck and diff checks passing. Persisted masks and remote result lookup remain external gates.

- Image-edit retry-state regression: task records now distinguish `hasMask: false` (safe managed-source retry) from true/unknown mask state (reselect source); task-service, LibraryPages and task-store focused suites passed 3 files / 59 tests, with lint, typecheck and diff checks passing.

- Managed designer-portrait regression: an explicit `designer-draft` image task stores generated bytes under the active workspace, never creates a document candidate, and publishes only `artworkAssetId` plus a `designhub-artwork://<id>` reference. The main process serves that scheme only from the active workspace and the renderer CSP permits no additional remote image source. Focused service/storage/IPC/UI/CSP/protocol coverage passed 7 files / 61 tests; full unit passed 97 files / 417 tests, integration 23 files / 105 tests, E2E 24/24, lint, typecheck, build and diff check. A fresh macOS arm64 package passed native 3/3 when launched through its packaged executable. Real provider portrait quality, Windows rendering, signing/notarization and human visual QA remain release gates.

- M06 system credential-entry regression: keyring wiring and encrypted-file migration passed focused 4 files / 14 tests, full unit 98 files / 421 tests, integration 23 files / 105 tests, lint, typecheck, build, diff check, and source native smoke 2 passed / 1 packaged-path skip. A fresh package attempt timed out during Forge file copying (`20.205.243.166:443`), so the new packaged keyring path, actual OS entry persistence, Windows behavior, signing/notarization, and upgrade migration remain external gates.
