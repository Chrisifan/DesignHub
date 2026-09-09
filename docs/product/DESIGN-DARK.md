---
name: Obsidian Precision Studio
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353943'
  surface-container-lowest: '#0a0e17'
  surface-container-low: '#181b25'
  surface-container: '#1c1f29'
  surface-container-high: '#262a34'
  surface-container-highest: '#31353f'
  on-surface: '#dfe2ef'
  on-surface-variant: '#bcc9cd'
  inverse-surface: '#dfe2ef'
  inverse-on-surface: '#2c303a'
  outline: '#869397'
  outline-variant: '#3d494c'
  surface-tint: '#4cd7f6'
  primary: '#4cd7f6'
  on-primary: '#003640'
  primary-container: '#06b6d4'
  on-primary-container: '#00424f'
  inverse-primary: '#00687a'
  secondary: '#c0c1ff'
  on-secondary: '#1000a9'
  secondary-container: '#3131c0'
  on-secondary-container: '#b0b2ff'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#1bbd85'
  on-tertiary-container: '#00452e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#acedff'
  primary-fixed-dim: '#4cd7f6'
  on-primary-fixed: '#001f26'
  on-primary-fixed-variant: '#004e5c'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0f131c'
  on-background: '#dfe2ef'
  surface-variant: '#31353f'
typography:
  display-title:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-panel:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.01em
  body-default:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: -0.005em
  body-bold:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: -0.005em
  caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 15px
    letterSpacing: 0.01em
  meta-mono:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: -0.01em
  metric-mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: -0.02em
  code-inspector:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  panel-header-h: 2.25rem
  toolbar-h: 2.75rem
  sidebar-w: 17.5rem
  inspector-w: 20rem
---

> 实现说明：本文 frontmatter 的 `colors` 是暗色主题语义色的实现依据；正文中的近似十六进制值用于解释视觉方向。跨主题字体、尺寸、间距、透明材质、组件和验收规则统一以 [UI 基础规范](UI-FOUNDATIONS.md) 为准。

## Brand & Style
The brand targets technical product designers, AI creative technologists, and digital artists orchestrating generative pipelines on local hardware. The product projects uncompromising utility, mechanical exactitude, and high-performance calm. The emotional signature is that of an advanced instrumentation deck—focused, quiet, and hyper-responsive, eliminating noise so creative iterations remain central.

The aesthetic fuses **Tech Minimalism** with **Instrumental Glassmorphism**:
- **Deep Obsidian Surfaces:** Absolute dark substrate tones (#080B11, #0D121F) that eliminate eye fatigue during long production sessions.
- **Precision Optical Borders:** 1px hairline edges utilizing translucent alpha blending (`rgba(255, 255, 255, 0.08)`) instead of heavy dropshadows.
- **Tactile Electronic Accents:** Restrained, targeted hits of luminous cyan, electric indigo, and telemetry emerald strictly reserved for interactive focus, generation pipelines, and computational states.
- **Instrumental Density:** Compact layout scaling reminiscent of specialized workstation software (Figma, Raycast, hardware synthesis units), prioritizing high information clarity over decorative fluff.

## Colors
The color architecture relies on high-purity chromatic accents applied over an anti-glare, dark slate/obsidian foundation.

### Surface System
- **Canvas Base:** `#06080E` (Deepest void backdrop for rendering viewports)
- **App Shell / Window Base:** `#090D16` (Main window chrome and desktop frame)
- **Layer 1 Surface (Dock & Sidebars):** `#0E1424` (Structured primary navigation and persistent tools)
- **Layer 2 Surface (Floating Panels & Modals):** `#141C2E` (Floating inspector cards, context menus, and tool trays)
- **Elevated Interactive Surface:** `#1E293B` (Inputs, active buttons, segmented controls)
- **Hairline Micro-Border (Subtle):** `rgba(255, 255, 255, 0.07)`
- **Hairline Micro-Border (Strong):** `rgba(255, 255, 255, 0.14)`

### Functional Accents
- **Primary (Electric Cyan - `#06B6D4`):** Active tool selections, crosshairs, vector node anchors, canvas transform indicators, and primary visual actions.
- **Secondary (Luminous Violet - `#6366F1`):** Generative prompt triggers, neural execution nodes, inference pipelines, and AI processing feedback.
- **Tertiary (Telemetry Emerald - `#10B981`):** Local model readiness, checkpoint syncs, low VRAM warnings, and inference completion state.
- **Warning / Alert (`#F59E0B` & `#EF4444`):** VRAM exhaustion, compilation failure, and dropped frame rate indicators.

### Text & Contrast Hierarchy
- **Text Primary:** `#F8FAFC` (High contrast headers, current values, active tags)
- **Text Secondary:** `#94A3B8` (Labels, tooltips, inactive node properties)
- **Text Muted / Mono Meta:** `#64748B` (VRAM counters, time stamps, frame indices, hotkeys)

## Typography
Typography is treated with mathematical rigidity. The primary body uses **Inter** for optical neutrality across variable density interfaces, while headings use **Geist** to inject subtle engineered sharpness into panel frames. All structural coordinates, generation seeds, parameter values, layer indices, and execution metrics are set in **JetBrains Mono** to guarantee tabular tabular alignment and monospaced visual balance.

- Use uppercase tracking (`letterSpacing: 0.05em`) strictly on small 10px-11px section labels (e.g., `PARAMETERS`, `NODE GRAPH`, `RENDER PASS`).
- Avoid font weights above 600; visual emphasis is generated through luminance contrast (`#F8FAFC` vs `#64748B`) rather than bloated weight.

## Layout & Spacing
The layout relies on a docked, 3-tier workstation model built around an infinite hardware-accelerated canvas viewport:

1. **Top Application Bar (40px):** Traffic lights, workspace layout tabs, model engine indicator (TensorRT/CoreML), and session runtime.
2. **Left Node & Asset Shelf (280px):** Model presets, checkpoint pickers, revision tree, and prompt layers.
3. **Infinite Central Canvas:** The main viewport, surrounded by minimal margin boundaries and overlaid by floating glass pods.
4. **Right Inspector Shelf (320px):** Multi-modal conditioning parameters (LoRA weights, guidance scale, steps, aspect ratio, seed locking).
5. **Floating Bottom Control Pod:** A centered floating action HUD (44px height) housing active tool, selection mode, inference trigger, and local generation queue progress.

### Spacing Rhythm
- Baseline unit: **4px**. Components, gap spacing, and padding adhere strictly to multiples of 4 (4px, 8px, 12px, 16px, 24px).
- Internal panel margins: `12px` padding on all modular containers.
- Micro-component gaps: `4px` or `6px` between related tool icons and segmented pill items.

## Elevation & Depth
Depth is rendered through physical illumination physics and optical edge separation rather than heavy, muddy drop shadows.

- **Level 0 (Infinite Canvas):** Void surface `#06080E`. Grid lines mapped at `rgba(255, 255, 255, 0.03)` with 16px and 64px divisions.
- **Level 1 (Docked Shells):** Solid `#090D16` with a right/left dividing micro-border: `1px solid rgba(255, 255, 255, 0.06)`.
- **Level 2 (Floating Glass Inspector & Modals):** Semi-transparent `#141C2ECC` with `backdrop-filter: blur(20px) saturate(180%)`. Border: `1px solid rgba(255, 255, 255, 0.10)`. Outer shadow: `0 8px 32px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.20)`.
- **Level 3 (Tooltips & Popovers):** Solid `#1E293B`, `1px solid rgba(255, 255, 255, 0.16)`. Shadow: `0 12px 36px rgba(0, 0, 0, 0.6)`.
- **Active Node Glow:** Interactive UI anchors and selected generation nodes apply a constrained edge aura: `box-shadow: 0 0 0 1px #06B6D4, 0 0 16px rgba(6, 182, 212, 0.25)`.

## Shapes
The shape system prioritizes modern mechanical precision over bubbly playfulness:
- **Base Corner Radius (`rounded-sm`):** `4px` for segmented control tabs, numeric input fields, small chips, and node sockets.
- **Standard Card/Panel Radius (`rounded-md`):** `6px` to `8px` for inspector trays, floating HUD toolbars, and contextual menus.
- **Floating Overlays & Window Containers (`rounded-lg`):** `10px` for main model switchers, batch export dialogs, and workspace overlays.
- **Full Radius (`rounded-full`):** Strictly restricted to node connector anchors, pipeline status pulse rings, and toggle switches.

## Components

### Buttons
- **Primary AI Action (Inference / Generate):** Gradient tint using Secondary/Primary (`linear-gradient(135deg, #6366F1, #06B6D4)`), text `#090D16` or `#FFFFFF`, font weight 600, inner hairline highlight `inset 0 1px 0 rgba(255, 255, 255, 0.3)`, subtle glow on hover.
- **Secondary / Standard:** `#1E293B` background, 1px border `rgba(255, 255, 255, 0.08)`, text `#F8FAFC`. On hover: `#334155`, border `rgba(255, 255, 255, 0.16)`.
- **Ghost / Icon Tool:** Transparent background, text `#94A3B8`. Hover: background `rgba(255, 255, 255, 0.05)`, text `#F8FAFC`. Active/Selected: background `rgba(6, 182, 212, 0.12)`, text `#06B6D4`, border `1px solid rgba(6, 182, 212, 0.35)`.

### Inputs & Sliders
- **Numerical Scrubbers & Inputs:** Surface `#0D121F`, micro-border `rgba(255, 255, 255, 0.08)`, text `#F8FAFC`, monospaced numerals. On focus: border `rgba(6, 182, 212, 0.7)` with `0 0 0 1px rgba(6, 182, 212, 0.3)`.
- **Precision Parameter Sliders:** Track height `3px`, surface `rgba(255, 255, 255, 0.08)`. Filled track `#06B6D4`. Thumb: `12px × 12px` rounded square with sharp bevel, `#F8FAFC`, inner dot `#090D16`.

### Segmented Controls
- Enclosing pill container with `#0D121F` base and `1px solid rgba(255, 255, 255, 0.06)` border.
- Inner active segment elevated via `#1E293B`, border `rgba(255, 255, 255, 0.12)`, text `#F8FAFC`. Inactive tabs use muted slate `#64748B`.

### AI Task State Badges & Revision Chips
- **Idle / Checkpoint Cached:** Background `rgba(255, 255, 255, 0.04)`, border `rgba(255, 255, 255, 0.08)`, text `#94A3B8`.
- **Inference Running:** Background `rgba(99, 102, 241, 0.12)`, border `rgba(99, 102, 241, 0.35)`, text `#818CF8`, with a pulsing 6px neon dot.
- **VRAM / Ready State:** Background `rgba(16, 185, 129, 0.1)`, border `rgba(16, 185, 129, 0.3)`, text `#34D399`. Monospaced telemetry (`e.g., "RTX 4090: 7.2 / 24 GB"`).

### Floating Glass Inspector Panels
- Structure: Header (32px) containing title (uppercase 10px `Geist`), collapse toggle, and status icon.
- Body: Integrated drag handle, glassmorphic backdrop (`rgba(20, 28, 46, 0.85)`), hairline separating dividers (`rgba(255, 255, 255, 0.05)`).
- Layer tree items: 26px height row, selectable with subtle cyan edge indicator on the left border (2px width).
