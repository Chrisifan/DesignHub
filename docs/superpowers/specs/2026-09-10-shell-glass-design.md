# Shell Glass Design

Date: 2026-09-10. Status: approved by the user in the request to begin the next UI round.

## Goal

Bring the persistent application shell closer to the approved DesignHub direction: a precise top frame and left navigation with restrained glass material, while keeping the canvas and reading surfaces stable and high contrast.

## Scope

- Retain the 40px native-safe window bar and the 44px global toolbar.
- Keep the existing responsive geometry: a 280px navigation shelf at 1280px and above, and the existing 64px compact rail below 1280px.
- Give the window bar, global toolbar, and left navigation a shared high-opacity tint, a fine translucent edge, and a bounded CSS backdrop blur. The dark variant uses a cyan-neutral navy tint; the light variant uses a cool white tint.
- Keep the project canvas, forms, long-form content, and document panels opaque enough for contrast and color work.
- Preserve the current `prefers-reduced-transparency` fallback as solid surfaces. Do not enable Electron's transparent-window mode or change native window options.

## Design Decisions

The glass effect is a navigation material, not a page-wide decoration. A quiet two-axis technical grid sits only behind the shell; the main content body paints an opaque surface above it. This gives the semi-transparent surfaces something to refract without adding decorative gradient blobs. Hairline borders separate the shell from its content; no broad drop shadow is added to docked panels.

The browser must render the internal material. Electron provides an additional platform layer through macOS vibrancy or Windows Mica, but that is not a substitute for the CSS material and will be verified separately in a native run.

## Acceptance

- At a 1280px viewport the rendered navigation shelf is 280px wide; the window and global toolbars are 40px and 44px high.
- In Chrome, the three shell surfaces report a non-`none` `backdrop-filter` containing `blur`, and an alpha/tinted background rather than an opaque fill.
- At 1024px the compact navigation rail remains functional and the page has no horizontal overflow.
- Both themes retain legible text, borders, active states, and the reduced-transparency solid fallback.
- No project state, navigation, storage, provider, export, or Electron window-option behavior changes.
