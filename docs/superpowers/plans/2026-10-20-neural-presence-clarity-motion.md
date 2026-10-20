# Neural Presence Clarity Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase compact Neural Presence contrast and add the approved grouped execution-pulse animation to `working` mode without changing task state or layout behavior.

**Architecture:** Keep `drawPresence` as the sole canvas renderer. Add a deterministic pure helper for working pulse geometry/progress, use it only in the `working` branch, and strengthen shared primitive opacity/line profiles for compact readability. Preserve the existing thinking connection path and public `NeuralPresence` API.

**Tech Stack:** React 19, TypeScript, Canvas 2D, Vitest, React Testing Library.

---

## File Map

- Modify `src/app/previews/AgentConstellationPreview.tsx`: expose deterministic working-pulse data and use it in the canvas renderer; adjust compact-compatible contrast values.
- Modify `src/app/previews/AgentConstellationPreview.test.tsx`: test pulse generation bounds, mode exclusivity, and existing renderer contract.
- Do not modify `ProjectCanvas.tsx`, `project-canvas.css`, task policy, or task tests; their behavior is explicitly out of scope for this pass.

### Task 1: Define the Working Pulse Contract

**Files:**
- Modify: `src/app/previews/AgentConstellationPreview.test.tsx`
- Modify: `src/app/previews/AgentConstellationPreview.tsx`

- [ ] **Step 1: Add failing tests for deterministic working pulses.**

Add the import for `getWorkingPulses`, then add this test beside the existing `getThinkingConnections` coverage:

```tsx
it('builds bounded grouped execution pulses only for working mode', () => {
  const first = getWorkingPulses(900);
  const later = getWorkingPulses(1_600);

  expect(first.length).toBeGreaterThanOrEqual(3);
  expect(later.map((pulse) => pulse.id)).not.toEqual(first.map((pulse) => pulse.id));
  first.forEach((pulse) => {
    expect(pulse.id).toMatch(/^working-/u);
    expect(pulse.route).toHaveLength(3);
    expect(pulse.progress).toBeGreaterThanOrEqual(0);
    expect(pulse.progress).toBeLessThanOrEqual(1);
    expect(pulse.opacity).toBeGreaterThan(0);
    expect(pulse.opacity).toBeLessThanOrEqual(1);
    expect(pulse.tone).toBeGreaterThanOrEqual(0);
    expect(pulse.tone).toBeLessThanOrEqual(4);
  });
  expect(getWorkingPulses(900, 'thinking')).toEqual([]);
  expect(getWorkingPulses(900, 'idle')).toEqual([]);
});
```

The helper signature should be typed as:

```ts
export type WorkingPulse = {
  id: string;
  route: [number, number, number];
  progress: number;
  opacity: number;
  tone: NeuralTone;
};

export const getWorkingPulses = (
  elapsedMs: number,
  mode: PresenceMode = 'working',
): WorkingPulse[] => [];
```

- [ ] **Step 2: Run the focused test and verify the intended failure.**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/previews/AgentConstellationPreview.test.tsx
```

Expected: FAIL because `getWorkingPulses` is not exported yet, while the existing tests still compile and run up to that missing import.

- [ ] **Step 3: Implement the minimal deterministic pulse helper.**

Add the exported `WorkingPulse` type after `ThinkingConnection`. Build a short repeating set of staggered pulses using deterministic slot phases; only return records when `mode === 'working'`. Keep all values normalized and route indexes within the existing `energySeeds` and membrane arrays:

```ts
export const getWorkingPulses = (
  elapsedMs: number,
  mode: PresenceMode = 'working',
): WorkingPulse[] => {
  if (mode !== 'working') return [];
  const cycle = 1_440;
  const slots = [0, 180, 360, 540, 720, 900];
  return slots.flatMap((offset, slot) => {
    const progress = ((elapsedMs - offset) % cycle + cycle) % cycle / cycle;
    const life = progress < .78 ? progress / .78 : (1 - progress) / .22;
    if (life <= 0 || life >= 1) return [];
    const envelope = Math.sin(Math.PI * Math.max(0, Math.min(1, life)));
    return [{
      id: `working-${slot}-${Math.floor((elapsedMs - offset) / cycle)}`,
      route: [slot % 12, (slot * 3 + 5) % 28, (slot * 5 + 11) % 44] as [number, number, number],
      progress: Math.min(1, life),
      opacity: .3 + envelope * .7,
      tone: slot % 3 === 0 ? 4 : slot % 2 === 0 ? 2 : 0,
    }];
  });
};
```

- [ ] **Step 4: Run the helper test and verify it passes.**

Run the same focused Vitest command. Expected: PASS for the new pulse test and all existing renderer tests.

- [ ] **Step 5: Commit the pure pulse contract.**

Review `git diff -- src/app/previews/AgentConstellationPreview.tsx src/app/previews/AgentConstellationPreview.test.tsx`, then commit only these files:

```bash
git add src/app/previews/AgentConstellationPreview.tsx src/app/previews/AgentConstellationPreview.test.tsx
git commit -m "feat: define neural presence working pulses"
```

### Task 2: Render Pulses and Increase Compact Contrast

**Files:**
- Modify: `src/app/previews/AgentConstellationPreview.tsx`
- Modify: `src/app/previews/AgentConstellationPreview.test.tsx`

- [ ] **Step 1: Add a renderer-facing mode contract test.**

Extend the existing compact terminal test with a working render assertion, confirming the public mode remains unchanged:

```tsx
it('renders working compact presence without adding outcome labels', () => {
  render(<NeuralPresence mode="working" compact />);

  expect(screen.getByTestId('neural-presence')).toHaveAttribute('data-mode', 'working');
  expect(screen.getByRole('img', { name: '设计运算中的神经簇智体' })).toBeVisible();
  expect(screen.queryByText(/成功|失败/u)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and verify the expected baseline.**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/previews/AgentConstellationPreview.test.tsx
```

Expected: PASS before renderer edits; this test locks the existing API and makes the remaining implementation a visual-only change.

- [ ] **Step 3: Add shared contrast profiles in `drawPresence`.**

Near the existing `isThinking` and `isWorking` flags, add compact-safe values derived from mode. Use them consistently for the existing core, membranes, links, and node dots; do not alter `PresenceMode` or the CSS wrapper:

```ts
const contrast = {
  coreFill: isThinking ? .2 : isWorking ? .2 : mode === 'sensing' ? .16 : .1,
  coreStroke: isThinking ? .88 : isWorking ? .9 : mode === 'sensing' ? .76 : .58,
  membraneStroke: isWorking ? .16 : isThinking ? .14 : .12,
  link: isWorking ? .115 : .095,
  node: isWorking ? .46 : .38,
};
```

Apply `contrast.coreFill` to the non-terminal core fill, `contrast.coreStroke` to the core boundary stroke, `contrast.membraneStroke` to non-terminal membrane strokes, `contrast.link` to membrane chord/anchor strokes, and `contrast.node` to membrane node dots. Raise the non-terminal core shadow for working to `.72` and keep thinking at `.72`; idle remains restrained.

- [ ] **Step 4: Draw grouped outward pulses only for working.**

After the membrane loop and before the existing thinking-connection block, add a working branch that maps pulse route indexes to the core/first/outer membrane points. Draw a soft route glow, a tapered line segment, and a warm moving endpoint. Use the helper's normalized `progress` and keep route arrays deterministic:

```ts
if (isWorking) {
  getWorkingPulses(elapsedMs).forEach((pulse) => {
    const route = [
      energySeeds[pulse.route[0] % energySeeds.length],
      membranes[0][pulse.route[1] % membranes[0].length],
      membranes[2][pulse.route[2] % membranes[2].length],
    ];
    const pointAt = (progress: number): { x: number; y: number } => {
      const scaled = Math.min(progress, .999999) * (route.length - 1);
      const segment = Math.min(Math.floor(scaled), route.length - 2);
      const local = scaled - segment;
      return {
        x: route[segment].px + (route[segment + 1].px - route[segment].px) * local,
        y: route[segment].py + (route[segment + 1].py - route[segment].py) * local,
      };
    };
    const head = pointAt(pulse.progress);
    const tail = pointAt(Math.max(0, pulse.progress - .18));
    context.save();
    context.shadowColor = rgba(palette[pulse.tone], .9 * pulse.opacity);
    context.shadowBlur = 12 + pulse.opacity * 8;
    context.beginPath();
    context.moveTo(tail.x, tail.y);
    context.lineTo(head.x, head.y);
    context.lineWidth = 1.1 + pulse.opacity;
    context.strokeStyle = rgba(palette[pulse.tone], .35 + pulse.opacity * .5);
    context.stroke();
    context.beginPath();
    context.arc(head.x, head.y, 1.5 + pulse.opacity * 1.4, 0, Math.PI * 2);
    context.fillStyle = rgba(palette[pulse.tone], .7 + pulse.opacity * .25);
    context.fill();
    context.restore();
  });
}
```

This branch must remain separate from `if (isThinking)`, so working never produces thinking's irregular connection records.

- [ ] **Step 5: Run focused renderer tests.**

Run:

```bash
pnpm exec vitest run --config vitest.config.ts src/app/previews/AgentConstellationPreview.test.tsx
```

Expected: PASS, including existing motion, terminal, compact, and preview tests.

- [ ] **Step 6: Run typecheck/build checks relevant to the renderer.**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: PASS with no new TypeScript diagnostics.

- [ ] **Step 7: Commit the renderer change.**

Inspect the staged diff and commit only renderer files:

```bash
git add src/app/previews/AgentConstellationPreview.tsx src/app/previews/AgentConstellationPreview.test.tsx
git commit -m "feat: clarify neural presence working motion"
```

### Task 3: Verify the Integrated Canvas Surface

**Files:**
- Test: `src/app/previews/AgentConstellationPreview.test.tsx`
- Test: `src/app/studio/ProjectCanvas.test.tsx`

- [ ] **Step 1: Run the focused regression suite.**

```bash
pnpm exec vitest run --config vitest.config.ts \
  src/app/previews/AgentConstellationPreview.test.tsx \
  src/app/studio/neural-presence-state.test.ts \
  src/app/studio/ProjectCanvas.test.tsx \
  src/app/studio/AnalysisPanel.test.tsx
```

Expected: PASS; task mode mapping, panel behavior, terminal feedback, and history behavior remain unchanged.

- [ ] **Step 2: Check the working tree for unrelated churn.**

```bash
git status --short
git diff --check
```

Expected: only the approved renderer commits and pre-existing user changes are present; no generated build output or whitespace errors are introduced.

- [ ] **Step 3: Review the final visual contract.**

Open the existing neural presence preview or the running canvas at the same viewport in idle, thinking, and working modes. Confirm the compact entity has a clearly visible core and membrane structure, working pulses travel outward in groups, thinking connections remain irregular, and the entity remains fixed at the lower-right canvas anchor. Confirm no status label or task interaction changes.

## Self-Review

- Spec coverage: compact contrast, working execution pulse, thinking exclusivity, accessibility, reduced motion, stable API, and tests are covered by Tasks 1-3.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation step is used.
- Type consistency: `WorkingPulse`, `getWorkingPulses`, `PresenceMode`, and renderer call sites use one signature throughout.
