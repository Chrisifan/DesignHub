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
