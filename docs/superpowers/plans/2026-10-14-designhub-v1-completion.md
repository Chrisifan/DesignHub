# DesignHub V1 completion plan

Date: 2026-10-14. Status: active. Specification: [V1 release baseline](../specs/2026-10-14-designhub-v1-release-baseline-design.md).

Each numbered task uses TDD where behavior changes, lands as an independently reviewable commit, and must pass its stage gate before the next stage begins.

When this plan conflicts with a capability that the current product has intentionally removed, stop and confirm the intended scope before changing code. Project package export is explicitly out of scope; package import remains supported.

## Stage 0: freeze the current baseline

1. Publish the canonical V1 specification and supersede the old multi-document plan.
2. Synchronize `CONTEXT.md`, the application guide, M01-M08 status, the module register, and ADRs.
3. Remove deleted Workbench, scene, revision, Brand Kit, and old task suites from `test:focused`.
4. Add a repository contract scan that rejects removed persisted APIs.
5. Gate: documentation links, focused tests, contracts, and typecheck pass.

## Stage 1: restore the local green baseline

1. Split delivery removal, historical task notification handling, and the single-instance lock into reviewable commits.
2. Remove the stale `.brand-list` layout assertion.
3. Replace Workbench E2E expectations with ProjectCanvas project menu, nodes, selection, image toolbar, canvas export, compact conversation dock, and persisted layout coverage.
4. Use project actions then Home instead of the removed Back to project control.
5. Assert the bottom toolbar owns `bottom: 18px` and its conversation dock is relatively positioned.
6. Run native Playwright with one worker and isolated test user-data directories.
7. Gate: `pnpm release:check` has no local failures.

## Stage 2: close product workflows

1. Remove the project package export bridge, IPC handler, service, UI assumptions, and release requirements while preserving package import.
2. Use streaming validated package import in production.
3. Prove every image input and output appends the same durable `ProjectDesign`.
4. Close all nine canvas image tools.
5. Close all four batch tools, including recovery and result import.
6. Close designer portfolio, analysis, review, publish/default/archive, portrait generation, and rights confirmation.
7. Close assets, search, trash, backup/restore, diagnostics, settings, and project package import.
8. Gate: offline success/error E2E journeys pass and an isolated library can import and edit a supported package.

## Stage 3: close a real provider

1. Route live smoke through the production adapter and task service.
2. Verify conversation, vision, generation, and editing with authorized fixed samples.
3. Verify queueing, streaming, cancellation, timeout, rate limiting, partial results, explicit retry, and restart-to-unknown behavior.
4. Record cost and remote cancellation as unavailable when the provider omits them.
5. Confirm tasks, logs, and diagnostics contain no key, image bytes, or unredacted provider errors.
6. Gate: all four capabilities have redacted result, duration, cost availability, and human quality evidence.

## Stage 4: performance, security, and UX

Meet the agreed history, batch, search, package-import memory, large-image, responsiveness, and memory targets. Regress traversal, ZIP bombs, links/reparse points, overwrite, disk-full, interrupted writes, CSP, IPC sender checks, and the single-writer lock. Verify themes, languages, target viewports/scales, keyboard, screen reader, reduced motion, and reduced transparency. Remove controls without backend behavior.

## Stage 5: dual-platform release

Build and sign macOS arm64, macOS x64, and Windows x64 with architecture-specific native module checks. Produce three platform reports and SHA-256 manifests before release aggregation. Verify install, launch, keyring CRUD, upgrade, uninstall with library retention, package import, and the packaged core journey on real devices. Set version `1.0.0` and publish manual-update release notes only after M01-M08 are all verified.
