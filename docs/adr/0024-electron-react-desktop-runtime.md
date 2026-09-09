# Electron and React desktop runtime

> Status: accepted; selected on 2026-09-09 at the user's direction, with implementation versions and platform gates still recorded as delivery prerequisites.

DesignHub will use Electron as its macOS and Windows desktop runtime with React/TypeScript in the renderer. Electron lets application code remain in JavaScript/TypeScript, provides a Node-capable main process for local files, SQLite and credential-bearing provider requests, and avoids introducing a Rust exception to the project's arrow-function rule. The renderer remains isolated and receives only narrow preload/contextBridge APIs. A credential entered by the user is sent to the main process and cleared from the form; stored secrets are never read back into the renderer.

## Boundaries and consequences

- Main process owns windows, filesystem, project transactions, native dialogs, credential operations and background/utility work. Renderer owns UI, canvas state and user-visible workflow.
- Explicitly set `nodeIntegration: false`, `contextIsolation: true` and `sandbox: true`. Preload exposes named operations; main validates the caller and arguments. UI components cannot import Node, credential storage or unrestricted IPC implementations.
- Preserve ADR 0015's OS credential-store requirement. `safeStorage` is a comparison candidate: it encrypts data for application-managed storage using Keychain-backed keys on macOS and DPAPI on Windows; it does not store each provider secret as a native credential-store item. Research maintained Node keyring bindings first. Using application-managed ciphertext instead would require an explicit storage-semantics decision, not an implicit consequence of choosing Electron. No plaintext fallback is allowed.
- Native Node modules must provide a compatible prebuilt binary or be rebuilt for the exact Electron ABI and target architecture. Verify loading in packaged builds; retain lockfiles and the required rebuild/unpack configuration. Node-API compatibility must be checked per library, not assumed to require the same treatment as every ABI-bound addon.
- Electron bundles Chromium and Node; it reduces reliance on differing system WebViews but makes runtime updates and installed size part of our release responsibility. Memory and size advantages have not been measured.
- Evaluate the officially recommended Electron Forge first, without installing competing packaging stacks. WebdriverIO and Playwright Electron are documented automation routes; Playwright's Electron support is experimental and must pass a version-specific spike. Neither route proves native dialogs or IME coverage by itself.

Tauri ADR 0018 is superseded by this decision. Its disposable macOS probe remains historical evidence and is not an Electron acceptance test. Electron still requires the same R01–R08 workload, with Windows and signed packaging evidence before release claims.

Sources and remaining work: [Electron research record](../research/M01-electron-runtime-results.md), [module verification](../verification/M01.md).
