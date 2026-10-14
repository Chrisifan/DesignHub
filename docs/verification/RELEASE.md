# DesignHub V1 Release Verification

> Current scope: [2026-10-14 verification matrix](CURRENT-STATUS-2026-10-14.md). Project package export has been removed from V1; older export entries below are retained only as historical evidence. Package import remains supported.

## 2026-10-14 project package export removal

- Removed the renderer bridge, IPC channel/handler, main-process service, archive writer, encoder, export-only policy, and export performance/integration assumptions. Package import and its trusted writable-library boundary remain.
- `pnpm release:check` passed focused 172, unit 750 passed/3 skipped, integration 111, browser E2E 50, native source 2 passed/packaged 1 skipped, lint, typecheck, build, documentation links, V1 contracts, diff check, and the package scan.
- Windows packaging, signed/notarized artifacts, live provider, packaged native, Keychain persistence, and installer upgrade remain explicit external blockers.

## 2026-10-05 remaining IPC continuation

- project-library lifecycle、credentials、document export IPC 注册已从 main.ts 抽出；对应 handler/registrar 聚焦测试通过。
- 保留 keyring、active library、archive-copy、export-history 和 trusted-window 行为；未重新宣称完整 E2E、packaged native 或真实 provider 通过。

## 2026-10-05 post-remaining-IPC local verification

- Focused: 38 files / 164 passed / 8 skipped.
- Unit: 164 files / 933 passed / 8 skipped.
- Integration: 30 files / 131 passed.
- Build, lint, typecheck, and diff-check passed.
- Renderer bundle warning remains. Full browser E2E, packaged native, live provider, Windows, signing/notarization, Keychain, ZIP large-package streaming, and human visual QA remain open or blocked.

## 2026-10-04 content IPC continuation

- 内容 IPC 注册已从 main.ts 抽出；相关 contract 6 files / 12 passed。
- pnpm lint、pnpm typecheck 通过；未重新宣称完整 E2E、packaged native 或真实 provider 通过。

## 2026-10-04 post-content local verification

- Focused: 32 files / 151 passed / 8 skipped.
- Unit: 161 files / 929 passed / 8 skipped.
- Integration: 30 files / 131 passed.
- Build, lint, typecheck, and diff-check passed.
- Renderer bundle warning remains. Full browser E2E, packaged native, live provider, Windows, signing/notarization, Keychain, ZIP large-package streaming, and human visual QA remain open or blocked.

## 2026-10-03 project IPC continuation

- project lifecycle IPC 注册已从 main.ts 抽出；相关 contract 2 files / 4 passed。
- pnpm lint、pnpm typecheck 通过；未重新宣称完整 E2E、packaged native 或真实 provider 通过。

## 2026-10-03 post-project local verification

- Focused: 26 files / 139 passed / 8 skipped.
- Unit: 160 files / 928 passed / 8 skipped.
- Integration: 30 files / 131 passed.
- Build, lint, typecheck, and diff-check passed.
- Renderer bundle warning remains. Full browser E2E, packaged native, live provider, Windows, signing/notarization, Keychain, ZIP large-package streaming, and human visual QA remain open or blocked.

## 2026-10-03 profile IPC continuation

- profile load/save IPC 注册已从 main.ts 抽出；相关 contract 2 files / 6 passed。
- pnpm lint、pnpm typecheck 通过；未重新宣称完整 E2E、packaged native 或真实 provider 通过。

## 2026-10-03 post-profile local verification

- Focused: 24 files / 135 passed / 8 skipped.
- Unit: 159 files / 927 passed / 8 skipped.
- Integration: 30 files / 131 passed.
- Build, lint, typecheck, and diff-check passed.
- Renderer bundle warning remains. Full browser E2E, packaged native, live provider, Windows, signing/notarization, Keychain, ZIP large-package streaming, and human visual QA remain open or blocked.

## 2026-10-03 project-package IPC continuation

- 项目包导入/导出 IPC 注册已从 main.ts 抽出；pnpm test:focused 包含 package contract，相关 2 files / 3 passed。

## 2026-10-03 consolidated local verification

- Focused: 18 files / 123 passed / 8 skipped.
- Unit: 157 files / 925 passed / 8 skipped.
- Integration: 30 files / 131 passed.
- Build, lint, typecheck, and diff-check passed.
- Full browser E2E, packaged native, live provider, Windows, signing/notarization, Keychain, ZIP large-package streaming, and human visual QA remain open or blocked.

## 2026-10-03 support IPC continuation

- backup、export-history、diagnostics IPC 注册已从 main.ts 抽出；相关 contract 4 files / 6 passed。
- pnpm lint、pnpm typecheck 通过；未重新宣称完整 E2E、packaged native 或真实 provider 通过。

## 2026-10-03 consolidated local verification

- Focused: 22 files / 129 passed / 8 skipped.
- Unit: 158 files / 926 passed / 8 skipped.
- Integration: 30 files / 131 passed.
- Build, lint, typecheck, and diff-check passed.
- Renderer bundle warning remains. Full browser E2E, packaged native, live provider, Windows, signing/notarization, Keychain, ZIP large-package streaming, and human visual QA remain open or blocked.
- pnpm lint、pnpm typecheck 通过；项目包格式、归档实现和跨项目库行为未改变。
- 大包流式/固定内存、完整 browser E2E、packaged native、Windows、签名/公证、Keychain、真实 provider 和人工视觉质量仍 blocked。

## 2026-10-03 search IPC continuation

- search rebuild/query IPC 注册已从 main.ts 抽出；相关 package-independent contract 2 files / 3 passed。
- pnpm lint、pnpm typecheck 通过；未重新宣称完整 E2E、packaged native 或真实 provider 通过。
Status: the 2026-09-28 working tree has a fresh local functionality update. `pnpm release:check` is `passed-with-blockers`: unit 138 files/825 passed/8 skipped, integration 29 files/129 passed, E2E 41/41, native source 2 passed/1 packaged skipped, provider 3/3, lint/typecheck/build/diff-check and package scan all passed. Fresh status is tracked in [CURRENT-STATUS-2026-09-24.md](CURRENT-STATUS-2026-09-24.md). Windows packaging/runtime, signed/notarized artifacts, Keychain persistence, live provider, installer upgrade, cross-device recovery, performance and human visual gates remain blocked.

2026-09-25 local closure update: the current worktree now has fresh unit 135 files/796 passed/8 skipped, integration 29 files/129 passed, browser E2E 39/39, native source smoke 2 passed with the packaged executable case explicitly skipped, offline provider 3/3, lint, typecheck, build, and diff check passing. This does not close Windows packaging/runtime, signing/notarization, Keychain persistence, live provider, cross-device recovery, performance, or human visual gates. The Windows Forge dry check is tracked separately and must not be reported as Windows runtime evidence.

2026-09-27 functionality update: provider-backed task submission now carries the configured capability model into adapter requests and persists it in task records; failed image tasks retain the model for explicit retry. Browser E2E now includes project-package import failure recovery, while the package import remains bridge-fixture evidence rather than filesystem or model-quality evidence. The final rerun completed with the local gates green and the external blockers unchanged.

2026-09-28 functionality update: completed design-generation and image-tool candidates now render immediately in an isolated canvas branch with explicit original/result comparison, confirm/discard/continue actions; real CanvasWorkspace selection is bound to image-tool target layers. Restarted queued/running tasks now use `unknown` instead of `failed`, never auto-resubmit, and require explicit retry. Persistent grayscale masks, concrete provider tool capabilities, and atomic ImageToolJob storage are covered by focused tests. The native batch selector/worker, project-package large-file recovery, live provider quality, Windows, signing, Keychain and human visual gates remain open.

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
## 2026-09-28 本地功能推进登记

本轮完成候选画布确认、持久化 mask 基础、provider 具体工具能力校验和 image-tool job 存储契约。聚焦测试已通过：候选/Workbench/task-service 107 passed、mask/provider/task storage/IPC/job store 116 passed；typecheck、lint、diff-check 通过。

本轮没有重新执行全量 E2E/native/provider live 或打包命令，因此旧日期的全量数字不作为当前工作树证据。批处理原生入口与 worker、项目包大文件回滚、智能编排、样机、真实 provider 质量和人工视觉质量仍未关闭；Windows、签名、公证、Keychain、跨设备恢复继续 blocked。

补充门禁证据（2026-09-28）：`pnpm release:check` 为 `passed-with-blockers`。unit 138 files / 825 passed / 8 skipped，integration 29 files / 129 passed，E2E 41/41，native source 2 passed / packaged 1 skipped，lint/typecheck/build/diff-check 和 package scan（290 files）通过；外部 blockers 为 Windows、签名、公证、live provider、packaged native、Keychain 和 installer upgrade。
# 2026-09-28 本地功能推进说明

本轮只登记已实际执行的聚焦证据：image-tools、Workbench、LibraryPages 共 13 files / 139 passed / 8 skipped；`pnpm typecheck` 通过。批量结果导入已通过主进程路径校验后写入受管素材，renderer 不直接授权任意路径。

仍 blocked：真实 provider 质量/费用/远端取消、Windows 真机、签名/公证、Keychain 持久化、项目包大文件和跨设备恢复、native 文件选择器实机证据及人工视觉质量。

最终本地门禁：`pnpm release:check` 为 `passed-with-blockers`；unit 144 files / 843 passed / 8 skipped，integration 29 files / 129 passed，E2E 41/41，native source 2 passed / packaged 1 skipped，lint/typecheck/build/diff-check 和 package scan 290 files 通过。`pnpm provider:live-smoke` 返回 blocked，未伪造真实 provider 证据。

## 2026-10-01 当前工作树功能推进证据

- 高级创建入口、候选确认和项目包交接聚焦套件：21 files / 247 passed / 8 skipped。
- `pnpm typecheck`、`pnpm lint`、`pnpm build`、`git diff --check`：通过。
- 未在本轮重新执行全量 `pnpm test:unit`、`pnpm test:integration`、`pnpm test:e2e`、`pnpm test:native`、`pnpm test:provider` 或 `pnpm release:check`，不得把历史全量数字写成本轮证据。
- 真实 provider、Windows、签名/公证、Keychain、packaged native、ZIP 流式/大包性能和人工视觉质量仍为 blocked。

## 2026-10-01 候选持久化门禁复核

- 本地智能构图/样机候选已通过任务存储跨重启恢复，并以明确审计状态关闭确认或放弃流程。
- 全量本地证据：unit 148 files / 905 passed / 8 skipped；integration 30 files / 131 passed；E2E 47/47；native source 2 passed / packaged 1 skipped；provider offline 3/3。
- `pnpm lint`、`pnpm typecheck`、`pnpm build`、`git diff --check` 通过；build 保留 Vite bundle size warning。
- 未配置 packaged executable，未执行 live provider；Windows、签名/公证、Keychain、安装升级、ZIP 大包流式/固定内存和人工视觉质量继续标记为 blocked。

## 2026-10-01 code optimization evidence

- Added internal task error policy, image-tool view-model helpers, and a dedicated image-tool IPC registrar without changing public bridge contracts.
- Fresh local evidence: unit 151 files / 914 passed / 8 skipped; integration 30 files / 131 passed; focused browser E2E 4/4; native source 2 passed / packaged 1 skipped; provider offline 3/3; lint, typecheck, build and diff-check passed.
- A full browser E2E rerun was interrupted by 18 connection-refused failures after the preview server stopped accepting connections. This is recorded as an environment/test-server issue, not as a passing full-gate result.
- Renderer bundle warning remains. Windows, signing/notarization, live provider, Keychain, packaged native, ZIP large-package streaming and human visual QA remain blocked.

## 2026-10-02 IPC registrar continuation

- 完成 task 与 settings/provider 两组主进程 IPC registrar 抽取；保持 typed bridge、活动 libraryId、可信窗口和现有 provider 配置契约不变。
- pnpm test:focused：14 files / 117 passed / 8 skipped；pnpm build、pnpm lint、pnpm typecheck、git diff --check 通过。
- 仍不宣称完整 browser E2E、packaged native、Windows、签名/公证、Keychain、真实 provider、ZIP 大包流式或人工视觉质量通过。

## 2026-10-02 code optimization continuation

- Workbench candidate selection/scene resolution now lives in `candidate-controller.ts`; task refresh timing and disposer behavior live in `task-polling.ts`. Public bridge and candidate revision semantics remain unchanged.
- Fresh focused evidence: `pnpm test:focused` passed 9 files / 108 tests, with 8 skips.
- Fresh local regression: `pnpm test:unit` passed 153 files / 921 tests with 8 skips; `pnpm test:integration` passed 30 files / 131 tests; lint, typecheck, build and `git diff --check` passed.
- Renderer initial chunk is 824.91 kB and ImageToolsPage is split to 28.70 kB; Vite still reports the >500 kB warning.
- Full browser E2E remains open because the previous rerun had 18 preview-server connection-refused failures. Windows, signing/notarization, live provider, Keychain, packaged native, ZIP large-package streaming and human visual QA remain blocked.

## 2026-10-05 IPC registrar continuation

- Portfolio and agent IPC registration moved out of `src/desktop/main.ts` into tested registrar modules without changing the public bridge contract.
- `pnpm test:focused`: 41 files / 182 passed / 8 skipped. `pnpm test:unit`: 166 files / 937 passed / 8 skipped. `pnpm test:integration`: 30 files / 131 passed.
- `pnpm lint`, `pnpm typecheck`, and `git diff --check`: passed.
- Release status remains local-source verified with blockers. Full browser E2E is not re-claimed after the previous preview-server connection-refused run; packaged native, live provider, Windows, signing/notarization, Keychain, ZIP large-package streaming, and human visual quality remain blocked.

补充本轮稳定门禁：`pnpm test:e2e` 47/47 通过；`pnpm test:native` source 2 passed / packaged 1 skipped；`pnpm release:check` 为 `passed-with-blockers`，package scan 433 files。renderer 初始 chunk 824.91 kB 仍有 Vite warning；packaged native、live provider、Windows、签名/公证、Keychain、ZIP 大包流式和人工视觉质量仍 blocked。

`pnpm test:provider` 离线契约 3/3 通过；`pnpm provider:live-smoke` 未执行，真实 provider 仍是外部门禁。

2026-10-05：批量图像结果预览读取已抽为独立 hook，聚焦门禁更新为 42 files / 184 passed / 8 skipped；lint/typecheck/diff-check 通过。此为内部优化，不改变 release blocker 状态。

## 2026-10-06 优化阶段门禁

- `pnpm test:focused`：45 files / 191 passed / 8 skipped。
- `pnpm test:perf`：2/2 门槛测试通过（任务历史 100、批量索引 1000）。
- `pnpm test:unit`：170 files / 946 passed / 8 skipped；`pnpm test:integration`：30 files / 131 passed。
- `pnpm lint`、`pnpm typecheck`、`pnpm build`、`git diff --check`：通过。
- renderer 初始 chunk 仍为 824.91 kB，Vite warning 仍存在，不能标记 bundle 优化完成。
- `pnpm test:unit`、`pnpm test:integration`、`pnpm test:e2e`、`pnpm test:native`、`pnpm test:provider` 和 `pnpm release:check` 未在本轮重新执行，历史数字不作为本轮全量证据。
- Windows、packaged native、签名/公证、Keychain、live provider、ZIP 固定内存和人工视觉质量保持 blocked。

补充完整门禁证据：`pnpm release:check` 返回 `passed-with-blockers`；unit 170 files / 946 passed / 8 skipped，integration 30 files / 131 passed，E2E 47/47，native source 2 passed / packaged 1 skipped，package scan 433 files。renderer 初始 chunk 824.91 kB 的 Vite warning 仍保留。

## 2026-10-07 Code Optimization Closure Update

- Local evidence was added for task execution boundaries, batch image tooling, selected-layer submission, task service factory, shared fixtures and package/image-tools performance commands.
- Renderer initial chunk remains 824.91 kB with a Vite warning; strict ZIP streaming/fixed-memory behavior is not claimed.
- Windows package/native smoke, packaged native, signing/notarization, Keychain persistence, live provider cost/quality/cancellation, cross-device recovery and manual visual QA remain `blocked`.

## 2026-10-07 Remaining optimization local closure

- `pnpm release:check` returned `passed-with-blockers`: unit 176 files / 965 passed / 8 skipped; integration 30 files / 131 passed; E2E 47/47; native source 2 passed / packaged 1 skipped; provider offline 3/3; lint, typecheck, build, `git diff --check`, and package scan 435 files passed.
- Task executor/recovery/candidate/runtime boundaries, ImageTools page and batch scheduler/job-store boundaries, selected-layer submission, and desktop provider/image-tool/project-package services are now in place without changing typed IPC or `libraryId` semantics.
- Renderer output now has entry `index` 499.19 kB, `canvas` 325.60 kB, and `ImageToolsPage` 30.15 kB; Vite emitted no >500 kB warning. Strict ZIP streaming/fixed-memory and full first-load network profiling remain unclaimed.
- Windows, packaged native, signing/notarization, Keychain, live provider quality/cost/cancellation, cross-device recovery, installer upgrade, and manual visual QA remain `blocked`.
