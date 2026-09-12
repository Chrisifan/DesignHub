# DesignHub V1 Release Verification

Status: prepared for execution. This record distinguishes browser preview evidence from native Electron, real-provider, and signed-package evidence.

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

- [ ] macOS packaged Electron: main/preload paths, native module unpacking, credential persistence, upgrade/uninstall data retention.
- [ ] Windows packaged Electron: the same checks on a real Windows host.
- [ ] Signed/notarized artifacts and exact hashes recorded.
- [ ] Real provider adapters, licensed image-tool samples, and 100-project/long-history performance sample.

Browser preview tests are not evidence for the native gates above. No release artifact is uploaded by this plan.

## 2026-09-12 execution evidence

- `pnpm test:e2e -- tests/e2e/full-design-journey.spec.ts tests/e2e/failure-recovery.spec.ts`: 24/24 passed, including the existing studio navigation matrix. Headless Chromium reports `backdrop-filter: none`; the test accepts this documented reduced-transparency fallback while retaining native blur verification as an open gate.
- `pnpm test:native`: Electron smoke and main-process storage passed; packaged storage test skipped because no packaged executable was available.
- `pnpm package`: macOS arm64 package preparation completed locally; signed artifact, Windows package, keychain persistence, and installer upgrade evidence remain open.
- Latest application regression after M06 task persistence/cancellation and M07 codec/export integration: `pnpm test:unit` 70 files/219 tests, `pnpm test:integration` 22 files/96 tests, `pnpm test:e2e` 24/24, `pnpm test:native` 2 passed/1 skipped, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check` all passed.
- The implemented offline path now includes workspace project creation/reopen, designer persistence and artwork rendering, project-scoped asset import/list/read, document scene hydration/save through Konva, and provider credential write/delete without renderer read-back.
