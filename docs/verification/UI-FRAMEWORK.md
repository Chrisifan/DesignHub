# UI framework verification

Date: 2026-09-09. Scope: P01–P20 UI navigation, example-session interaction and theme/layout only. M02–M08 business completion is not asserted.

| ID | Behavior / failure caught | Acceptance |
| --- | --- | --- |
| UF01 | Example entry/navigation missing or loses current context | All major destinations reachable; project→document→workbench and back work. |
| UF02 | Search/filter reset or incorrect empty result | Search narrows projects, empty state offers reset, returning preserves query. |
| UF03 | Draft creation falsely claims persistence | Required fields validated; explicit preview draft visible in current session; no save claim. |
| UF04 | Theme/locale remount loses draft or selection | Three theme choices and bilingual UI preserve live state; preferences survive reload. |
| UF05 | Missing native or model capability produces fake success | Directory error recoverable; unavailable save/generation/export/connection clearly identified. |
| UF06 | Modal leaks focus or ignores Escape | Browser dialog focuses content, Escape dismisses, returns focus to trigger. |
| UF07 | Workbench controls are decorative | Layer selection/visibility, zoom, grid and panel changes update the view. |
| UF08 | Responsive chrome hides primary actions | 1280×800 / 1024×720, zh/en, dark/light have no unintended page overflow; inspector can be dismissed. |
| UF09 | Prior M01 contracts regress | Existing unit/integration, lint, typecheck and build pass; host files untouched. |

Execution: UI scope verified; native and business gates remain separate. Native macOS/Windows materials, IME, packaged host, filesystem persistence and real provider calls are outside this UI result.

## Design and dependency evidence

- Existing 2026-09-09 approved UI baseline defines P01–P20 roles, 11 allowed Figma frames, semantic theme colors, typography, desktop spacing and accessibility. This UI implements the user's request to build the framework before backend verification completes.
- Figma `get_figma_data` for `39:14262` succeeded during this task. It confirms the 1280px composition, 40/44px top bars, 280px left navigation and layered canvas/context panel. The project-home frame `39:14783` returned 429; remaining composition follows the approved repository UI guide. The installed Figma connector does not expose `get_design_context`; no pixel-perfect equivalence is asserted.
- All theme colors were mapped from `DESIGN-DARK.md` and `DESIGN-LIGHT.md` frontmatter. Sample artwork colors are separate content tokens and do not change with theme.
- The UI uses browser-native `<dialog>` with `showModal()` for platform focus handling and Escape; no custom focus trap or overlay library. Native browser behavior will be exercised by UF06 in installed Chrome. jsdom's open-attribute fallback only supports component rendering and is not modal behavior evidence.
- Lucide static 0.468.0 assets downloaded from npm registry with TLS verification; source and upstream license are in `public/icons/`. No runtime dependency was added. Existing React 19.2.8, Vite 8.2.2, TypeScript 5.9.3 and Vitest 5.0.0 are reused. Named fonts use approved system fallback stacks; this framework does not embed or download fonts.
- Isolated worktree starts at `4c5a1f7` on `codex/ui-framework`. Shared installed packages are used read-only; Vite cache belongs to this worktree. The original checkout's package/lock/native changes are not included.

## Test-first record

- Baseline `pnpm test:unit`: exit 0, 8 files / 17 tests.
- UF01–UF02 navigation and project/document journey first failed because the existing application had no `浏览示例` entry: 3 new behavioral failures with the 17 baseline tests still passing. This is UI behavior Red, not a dependency/install error.
- Intermediate integration was attempted while delegated page files were still being written; missing CSS was a temporary assembly failure, not counted as behavior Red or acceptance.


## Final execution evidence

- `pnpm test:unit`: exit 0, **11 files / 42 tests**. Includes existing M01 integration tests, navigation/search/draft retention, native chooser error recovery, contextual delivery, designer draft isolation, and workbench layer/lock behavior.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`: exit 0. Production renderer, Electron main and preload bundles build successfully. Local SVG icons are copied into the renderer output.
- `DESIGNHUB_CHROMIUM_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm exec playwright test --config playwright.ui.config.ts`: exit 0, **12 browser tests**. All 8 combinations of 1280/1024px, dark/light and Chinese/English traverse projects → workbench → management pages. Narrow zoom/grid controls remain visible, and no document-level horizontal overflow was found. Welcome screen at both dimensions is included.
- The browser suite also verifies actual native-dialog initial field focus, Escape dismissal, focus return, cancelled-draft retention, preview creation, empty-search reset, and UI preferences surviving reload.
- Real Chrome visual inspection covered the project library, designer library and workbench. Scratch screenshots are in `.superpowers/sdd/2026-09-09-ui-framework/`; reproducible workbench screenshots are generated under Playwright `test-results/` by the committed test. No page errors were recorded during visual capture.
- Review fixes: retain separate designer create/edit drafts; carry source project into delivery; label delivery thumbnail as example source rather than edited rendering; show radio keyboard focus; use proper storage button semantics; preserve selected designer translation; fix modal lifecycle focus; limit inspector fields to supported text edits; enforce locked text; preserve narrow view controls; label reset truthfully; align all main documents to 1080×1440; move selection handles with text; expose only existing sample layers.
- Separate code reviews of shell/libraries and workbench, followed by scoped re-reviews, found all important findings addressed.

### UI acceptance boundary

UF01–UF09 pass within the browser/UI scope above. UI02, UI05–UI07 are exercised by browser tests; reduced motion/transparency rules and stable artwork theme colors are implemented. True OS scaling, font/IME behavior, native macOS/Windows material and window operations, real canvas performance and release packaging remain native acceptance work. This framework does not mark full UI01–UI10, M01, or M02–M08 verified.

Preview state is session-only. Theme and locale are the only preferences persisted by this framework; it creates no real workspaces, publishes no designer profiles, connects no providers and renders/exports no real design files. The creation form exposes only the currently supported 1080×1440 preview size. Other document thumbnails explain their pending backend rather than showing fake success.

## Shell Material Refinement

Date: 2026-09-10. Scope: persistent window bar, global toolbar and workspace navigation shelf only.

- User feedback identified the earlier screenshot's opaque shell as materially different from the target. Root-cause inspection in Chrome confirmed support for `backdrop-filter`; the three shell surfaces instead had `backdropFilter: none` and opaque backgrounds. This was not caused by browser preview.
- TDD evidence: the shell material test first failed on `backdropFilter: none`, then passed after applying the theme-aware shell material. It asserts a 280px desktop shelf, 40px window bar, 44px global toolbar, the dark and light alpha gradients, and a non-empty blur/background image on all three surfaces.
- Chrome DevTools emulation covers `prefers-reduced-transparency: reduce`. The regression first failed because the later-loaded window bar rule won the CSS cascade; the fallback now changes shared shell tokens, and the browser contract verifies that all three shell surfaces have `backdrop-filter: none` and the dark solid background.
- The dark and light 1280px shell screenshots plus the 1024px compact workbench screenshot were captured by the local Chrome review script. The final run logged no page errors and `document.scrollWidth === innerWidth` at 1024px.
- `pnpm test:unit && pnpm lint && pnpm typecheck && pnpm build` passed: 43 unit/integration tests, lint, TypeScript and all renderer/main/preload bundles. The full UI browser suite passed 15 tests across dark/light, Chinese/English, 1280/1024, workbench shelf width, reduced transparency, dialog focus and preferences.
- Electron now opens the example workspace directly when its preloaded `window.designhub` bridge is present; browser `/` remains the welcome entry. The revised `pnpm test:native` timed out while awaiting the Electron window after 30 seconds. `docs/verification/M01.md` records the same host limitation, so native vibrancy/Mica composition and actual-window startup remain unverified and must not be inferred from Chrome or jsdom results.

## Run and integrate

Run `pnpm start` in this worktree to open the example workspace directly in Electron. For browser review, run `pnpm exec vite --host 127.0.0.1 --port 5178 --strictPort` and open `http://127.0.0.1:5178/?preview=1`; `/` remains the browser welcome entry. Standard `pnpm build` still builds all three existing bundles.

The `node_modules` symlink is a local setup convenience, ignored by Git; a fresh checkout uses normal `pnpm install --frozen-lockfile`. No application dependency or lockfile change is part of this UI branch. The parallel feasibility checkout and its uncommitted SQLite/native changes remain independent. Merge/cherry-pick only when its owner is ready to integrate the App entry and UI.
