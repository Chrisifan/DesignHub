# Development Guardrails

These constraints govern implementation of the product decisions recorded in `CONTEXT.md` and `docs/adr/`.

## Dependency Discovery

Before implementing a capability, research mature, maintained open-source frameworks and third-party libraries through GitHub or authoritative web documentation. Prefer a proven dependency when it correctly owns the problem, is compatible with the product's local-first and desktop constraints, and has acceptable maintenance, licensing, and security characteristics. Record the selected dependency and the reason for rejecting materially plausible alternatives in the relevant module plan or ADR when the decision is long-lived.

## Module Delivery Loop

Develop and verify work by module. Before implementation, write a module-scoped test plan and acceptance checklist that maps directly to the approved functional plan. Implement the smallest complete module, run its tests, and verify every checklist item before considering it complete.

If later work modifies an already verified module or one of its observable contracts, record the impact and rerun that module's relevant tests and checklist before relying on the previous verification result.

## Scope Discipline

Implement only approved functionality and the minimum supporting infrastructure required to deliver it safely. Do not add speculative abstractions, workflows, integrations, or configuration surfaces beyond the functional plan. Raise any material scope expansion for approval before implementation.

## Code Quality

Maintain deliberate module boundaries, cohesive file organization, clear ownership, and focused tests. Prefer existing project patterns over new abstractions; keep public contracts explicit and minimize duplication without introducing indirection that obscures the feature.

## Function Style

Use arrow-function syntax for all functions written in the application codebase, including callbacks, exported functions, hooks, and event handlers. Do not introduce `function` declarations or function expressions.

Do not silently exempt self-authored native code from this requirement. Resolve runtime compatibility before implementation; see [ADR 0024](adr/0024-electron-react-desktop-runtime.md).

## Planning and Verification Records

Use the [full module plan](superpowers/plans/2026-09-08-designhub-v1.md) and [module verification register](verification/MODULE-REGISTER.md). Create each module's test cases and checklist before implementing it. Record later changes to verified modules with their impact, required regression cases, execution results, and evidence; a previously passing module is not assumed to remain verified after a relevant change.
