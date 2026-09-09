---
name: Alabaster Precision Studio
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#464554'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#494bd6'
  primary: '#4648d4'
  on-primary: '#ffffff'
  primary-container: '#6063ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#c0c1ff'
  secondary: '#4b41e1'
  on-secondary: '#ffffff'
  secondary-container: '#645efb'
  on-secondary-container: '#fffbff'
  tertiary: '#4651b9'
  on-tertiary: '#ffffff'
  tertiary-container: '#606ad4'
  on-tertiary-container: '#fffbff'
  error: '#ef4444'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#3323cc'
  tertiary-fixed: '#e0e0ff'
  tertiary-fixed-dim: '#bdc2ff'
  on-tertiary-fixed: '#000767'
  on-tertiary-fixed-variant: '#2f3aa3'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
  canvas-bg: '#f1f5f9'
  surface-base: '#ffffff'
  surface-subdued: '#f8fafc'
  accent-tint: '#eef2ff'
  border-subtle: '#e2e8f0'
  border-strong: '#cbd5e1'
  text-primary: '#0f172a'
  text-secondary: '#475569'
  text-muted: '#94a3b8'
  warning: '#f59e0b'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.03em
  display-sm:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Geist
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.015em
  body-lg:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-md:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  code-sm:
    fontFamily: Geist
    fontSize: 11px
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
  space-sm: 0.375rem
  space-md: 0.5rem
  space-lg: 0.75rem
  space-xl: 1rem
  space-2xl: 1.5rem
  panel-dock-width: 17.5rem
  toolbar-height: 2.5rem
  header-height: 3rem
---

> 实现说明：本文 frontmatter 的 `colors` 是明亮主题语义色的实现依据；正文中的近似十六进制值用于解释视觉方向。明亮主题复用 DesignHub 暗色稿的信息架构，不参考同一 Figma 文件中的非 DesignHub 浅色页面；跨主题规则统一以 [UI 基础规范](UI-FOUNDATIONS.md) 为准。

## Brand & Style

This design system delivers an architectonic, light-mode workstation environment engineered for precision design tools, complex canvas workflows, and dense multi-panel utilities. It balances luminous, calibrated light surfaces with razor-sharp typography and an electric violet/indigo accent engine.

The aesthetic blends **Precision Minimalism** with **Technical Constructivism**. By trading gratuitous ornamentation for structural 1px borders, micro-grid rhythm, and disciplined hierarchy, it projects surgical clarity and optical control reminiscent of professional drafting benches and industrial hardware prototyping suites.

## Colors

The palette is engineered around surgical light slate surfaces energized by high-contrast Electric Violet and Indigo accents.

### Surface Architecture
- **Surface Canvas (`canvas-bg`, `#f1f5f9`)**: Foundation for infinite canvas viewports, drawing boards, and work areas.
- **Surface Panel Base (`surface-base`, `#ffffff`)**: Standard elevation for docked utility sidebars, tool ribbons, inspectors, and menus.
- **Surface Panel Subdued (`surface-subdued`, `#f8fafc`)**: Nested containers, inner property panels, table headers, and inactive states.
- **Border Subtle (`border-subtle`, `#e2e8f0`)**: Micro-dividers and structural grid borders maintaining strict perimeter discipline.
- **Border Strong (`border-strong`, `#cbd5e1`)**: Hover boundaries, inactive field borders, and critical structural dividers.

### Indigo / Electric Violet Accents
- **Primary Accent (`#6366f1` / Indigo 500)**: Primary interactive triggers, active canvas marquis selections, and focus anchors.
- **Primary Hover (`#4f46e5` / Indigo 600)**: Pressed and hovered states for primary actionable controls.
- **Accent Tint (`#eef2ff` / Indigo 50)**: Subtle background wash for selected layer rows, tool toggle fills, and active property blocks.
- **Active Border (`#818cf8` / Indigo 400)**: Focus outlines, active selection bounding strokes, and dynamic snapping guides.

### Monochromatic Text & Contrast
- **Text Primary (`text-primary`, `#0f172a`)**: Deep slate-900 offering crisp, optical clarity for coordinates, labels, and parameters.
- **Text Secondary (`text-secondary`, `#475569`)**: Supporting metadata, keybindings, and dimensional units.
- **Text Muted (`text-muted`, `#94a3b8`)**: Inactive values, breadcrumbs, and disabled indicators.

## Typography

Typography is set exclusively in **Geist** to guarantee mathematical precision, crisp baselines, and uncompromising legibility within high-density workstations.

- **Tabular Figures**: Numerical metrics (coordinates, geometry, rotational values, and indices) enforce OpenType tabular figures (`font-variant-numeric: tabular-nums`) to prevent horizontal jitter during interactive scrubbing.
- **Hierarchy Structure**: Display styles are reserved for project headers and empty-state orientations. The core interface operates between `body-sm` (12px) and `label-sm` (11px).
- **Uppercase Labels**: Tooltips, section category headers, and property grouping titles utilize `label-sm` in uppercase with deliberate tracking (`+0.04em`) for compact structural division.

## Layout & Spacing

The layout is structured around an immutable 4px baseline grid tailored for high-efficiency studio desktop environments, with adaptive drawer collapse for smaller screens.

### Workstation Shell
- **Header Shell**: Fixed 48px (`header-height`) full-width band holding document controls, project meta, and global actions.
- **Utility Rail / Toolbar**: Fixed 40px (`toolbar-height`) ribbon anchored to the top or floating centrally for canvas transformation tools.
- **Docked Panels**: Standardized at 280px (`panel-dock-width`) columns bounding the left (Layer Tree) and right (Inspector & Style Matrix) perimeters. Collapses to an icon rail on viewports under 1024px.
- **Viewport Canvas**: Fluid workspace expanding across available horizontal and vertical space.

### Spacing Density
- High-density spacing: Control padding stays tightly bound between 4px (`space-xs`) and 8px (`space-md`).
- Multi-input rows and micro-properties utilize zero-gap vertical stacking joined by 1px slate borders to maximize vertical throughput.

## Elevation & Depth

Visual hierarchy is articulated through **Tonal Layering** and **Fine 1px Slate Borders**, avoiding heavy skeuomorphic blurs in favor of crisp structural boundaries.

- **Level 0 (Infinite Canvas Ground)**: Base `#f1f5f9` with an optional 16px CSS grid composed of 1px dot markers (`#cbd5e1`).
- **Level 1 (Docked Surfaces & Panels)**: Grounded `#ffffff` surfaces bounded by a continuous `1px solid #e2e8f0`. Completely flat without drop shadows.
- **Level 2 (Popovers, Flyouts, & Context Menus)**: Elevated `#ffffff` containers with `1px solid #cbd5e1` and an architectural shadow: `0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 1px 3px 0 rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modal Dialogs & Command Palettes)**: Centered planar surfaces backed by a translucent backdrop blur (`rgba(241, 245, 249, 0.8)` with `backdrop-filter: blur(6px)`) and a structured outline shadow: `0 12px 32px -4px rgba(15, 23, 42, 0.12), 0 0 0 1px #cbd5e1`.

## Shapes

The design system enforces a controlled structural aesthetic with a roundedness level of `1` (Soft), standardizing on 4px corners for sharp, technical clarity.

- **4px (`rounded`)**: Inputs, buttons, segmented controls, toolbar toggles, and inspector line items.
- **6px (`rounded-md`)**: Floating flyouts, context menus, and elevated cards.
- **Fully Rounded (`rounded-full`)**: Presence indicators, multi-user avatar dots, and pill-shaped status nodes.

## Components

### Buttons & Trigger Actions
- **Primary Button**: Filled `#6366f1` with `#ffffff` text and `1px solid #6366f1`. Hover triggers `#4f46e5` with matching border. Active state applies `transform: scale(0.99)`.
- **Secondary Button**: Solid `#ffffff` surface, `#0f172a` text, and `1px solid #e2e8f0`. Hover transitions to `#f8fafc` surface and `#cbd5e1` border.
- **Icon / Tool Button**: Transparent base with `#475569` icon. Selected/active state switches to `#eef2ff` fill, `#6366f1` icon, and a `1px solid #818cf8` border.

### Input Fields & Property Steppers
- **Text & Metric Inputs**: Background `#ffffff`, border `1px solid #e2e8f0`, height 28px, text `#0f172a` using `body-sm` tabular figures. Focus state triggers `1px solid #818cf8` with a tight focus ring (`box-shadow: 0 0 0 1px #818cf8`).
- **Scrubbable Drag Labels**: Hovering over numerical property labels (X, Y, W, H, R) displays an `ew-resize` cursor and shifts label color from `#475569` to `#6366f1`.

### Status Badges & Chips
- **Geometry**: Height 20px, 4px border radius, 6px horizontal padding.
- **Active / Accent**: Background `#eef2ff`, border `1px solid #c7d2fe`, text `#6366f1`.
- **Neutral**: Background `#f8fafc`, border `1px solid #e2e8f0`, text `#475569`.
- **Warning**: Background `#fffbeb`, border `1px solid #fef3c7`, text `#b45309`.

### Selection & Canvas Bounding
- **Selection Marquis & Outlines**: `1px solid #818cf8` stroke with an optional `rgba(99, 102, 241, 0.08)` interior fill.
- **Transform Handles**: 6px × 6px square handles in `#ffffff` with a `1.5px solid #6366f1` border.
- **Snapping Guides**: 1px solid `#818cf8` alignment lines paired with dynamic delta badges (`#6366f1` fill, `#ffffff` text).

### Layer Tree & Lists
- **Item Row**: 28px height, flex layout, 4px left indentation per hierarchy level.
- **Hover State**: Background `#f8fafc`.
- **Selected State**: Background `#eef2ff`, border-left `2px solid #6366f1`, text `#6366f1` with font-weight `500`.

### Checkboxes & Radio Knobs
- **Checkboxes**: 14px × 14px square, 3px border radius. Inactive: `#ffffff` fill with `1px solid #cbd5e1`. Checked: `#6366f1` fill with a crisp `#ffffff` check icon.
