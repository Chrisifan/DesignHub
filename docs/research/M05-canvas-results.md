# M05 Canvas Dependency Research

Date: 2026-09-12

## Sources checked

| Candidate | Public source | Observed status | License | Compatibility / decision |
| --- | --- | --- | --- | --- |
| Konva | `https://github.com/konvajs/konva`, npm registry | Active repository; npm `10.5.0` | MIT (npm registry) | Adopt for renderer drawing primitives and event handling. Its serialized objects are not the document format. |
| react-konva | `https://github.com/konvajs/react-konva`, npm registry | Active repository; npm `19.2.7` | MIT | Adopt. Its peer ranges declare React/React DOM `^19.2.0` and Konva `^10.0.0`, matching this app's React `19.2.8`. |
| Fabric.js | `https://github.com/fabricjs/fabric.js`, npm registry | Active repository; npm `7.4.0` | MIT | Not adopted for V1: both candidates cover the planned primitive scene without needing Fabric's object serialization model. |

## Decision

Use `konva@10.5.0` and `react-konva@19.2.7` for the M05 renderer. The persistent scene remains the finite DesignHub schema in `src/features/canvas/scene.ts`; Konva nodes, selection transformers, and view state are renderer-local only.

## Still unverified

- Electron macOS and Windows large-image latency/memory R01/R02.
- Real Chinese IME behavior, system font enumeration, PDF/GIF/PSD previews, and platform GPU differences.
- Konva's Node peer packages are not added because DesignHub only renders it inside the browser-like Electron renderer.

These gaps block platform claims but not pure-schema, renderer-unit, or browser-harness work.
