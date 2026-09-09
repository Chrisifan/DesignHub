# Electron disposable host probe

This directory is a throwaway M01 evidence probe, not application source. It contains no product UI, project files, SQLite code, credentials, diagnostics upload, or Tauri code. Its self-authored `.mjs` callbacks use arrow syntax; Electron and Playwright code in `node_modules` is third-party and excluded from that rule.

## Locked probe inputs

- Node `v22.19.0`, pnpm `10.23.0`
- Electron `44.3.0` (MIT)
- Playwright `1.63.0` (Apache-2.0; Electron support remains documented as experimental)

`pnpm-lock.yaml` is the exact transitive lock for these two probe dependencies. The Electron macOS arm64 binary is downloaded by Electron's official postinstall after dependency resolution; it is intentionally ignored and is not committed.

## Commands

From the repository root:

```sh
pnpm install --dir experiments/runtime/electron-probe --frozen-lockfile=false
pnpm --dir experiments/runtime/electron-probe probe:arrow-check
pnpm --dir experiments/runtime/electron-probe probe:automation
```

`probe:automation` launches Electron using Playwright, verifies the isolated preload bridge and no renderer `require`/`process`, then checks a visible, opaque, hidden-title-bar macOS window for resize, maximize/unmaximize and full-screen transitions. On a successful run it writes the ignored `result.json` evidence file and always closes the launched Electron process.

## 2026-09-09 execution result

The source-style command passed (five self-authored probe files). The host automation did not start because Electron's official `install.js` could not download the pinned `darwin-arm64` binary in this environment: `TypeError: fetch failed`, exit `1`. The failed binary is not treated as a test failure or as successful Electron evidence. Do not reuse the unrelated Electron 37 binary found in another workspace; it is the wrong locked runtime.

The final bounded diagnostic command was:

```sh
timeout 45s node experiments/runtime/electron-probe/node_modules/electron/install.js
```

It ended before its timeout with the above fetch failure and left no `path.txt`, Electron executable, or `result.json`. macOS host/security/window/automation checks therefore remain **unverified** until this exact lock can download and launch.
