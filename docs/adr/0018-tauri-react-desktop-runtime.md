# Tauri and React desktop runtime (superseded)

> Status: superseded by [ADR 0024](0024-electron-react-desktop-runtime.md) on 2026-09-09.

TypeScript and React are the proposed interface stack, with Tauri proposed as the macOS and Windows runtime. This gives the design surface a mature web UI ecosystem while retaining direct local-file access and native secure credential storage with a smaller desktop shell.

## Adoption gate

Before implementation depends on Tauri, record GitHub and official-documentation research for Tauri, Electron, and the required supporting libraries. The record must cover maintenance activity, license compatibility, macOS/Windows support, security model, and the capabilities required by this product.

Run a small, disposable cross-platform spike on macOS and Windows that proves all of the following:

- A high-resolution raster document can pan, zoom, select, and render without the UI becoming unresponsive.
- A project-scoped SQLite metadata store can be created, moved with its project directory, reopened, and safely migrated.
- Provider credentials can be written to and read from each platform's native secure storage without entering project files.
- Background image processing reports progress and failure without blocking the canvas or corrupting a design revision.
- Automated UI testing can cover the project, canvas, and export flows on both platforms.
- The supported packaging and update path is practical for signed macOS and Windows releases.

If a required condition fails or Electron provides materially lower delivery risk for the validated capabilities, select Electron instead and supersede this ADR with the evidence and decision.

## Coding-constraint compatibility

The user requires arrow functions for all self-authored functions. Rust does not provide JavaScript/TypeScript arrow-function syntax. A Tauri solution requiring self-authored Rust functions therefore does not satisfy the current constraint; do not assume an exception. Evaluate whether maintained existing integrations suffice without new Rust functions, otherwise evaluate Electron under the same adoption gate. Any relaxation of the coding rule requires a separate explicit user decision.

## Evidence update — 2026-09-09

Historical evidence: Tauri 2.11.5 built and ran on an M1 Pro Mac with Command Line Tools. A disposable, unmodified upstream host completed native IPC and ten synthetic 6000×4000 image-processing cycles in a Web Worker. This supported Tauri technical feasibility but did not validate production canvas input latency, memory recovery, Windows, credentials, project transactions, native workflow automation, or distribution.

Current official documentation recommends WebdriverIO's embedded driver for macOS as well as Windows/Linux; the limitation of the external `tauri-driver` alone is not a reason to reject Tauri. The SQL plugin's pooled calls do not establish a pinned cross-call transaction, and Stronghold is not an OS credential store. The project needs a validated backend ownership model for atomic commits and credential-bearing requests.

The user selected Electron instead. No Tauri implementation is to be started from this ADR; the unmodified probe remains disposable historical evidence. Electron's adoption scope and remaining gates are recorded in [ADR 0024](0024-electron-react-desktop-runtime.md) and [M01 Electron report](../research/M01-electron-runtime-results.md).

The [runtime report](../research/M01-runtime-results.md) records sources, exact build versions, failed attempts, measurements and remaining prerequisites. The [Dependency Gates](../research/DEPENDENCY-GATES.md) remain the adoption criteria; neither this update nor the successful single-platform probe marks the implementation plan complete.
