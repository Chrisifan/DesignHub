# Remove Project-Library Recovery Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the standalone project-library chooser page and enforce that a profile can become complete only after a project library is active.

**Architecture:** Route every non-ready startup library state through the existing profile onboarding component, preserving an existing avatar and model completion state during recovery. Enforce the profile/library relationship in the trusted main-process profile handler, then make browser fixtures start from a consistent ready state.

**Tech Stack:** React 19, TypeScript, Electron IPC, Vitest, Testing Library, Playwright.

---

### Task 1: Reuse an existing avatar during storage recovery

**Files:**
- Modify: `src/app/onboarding/ProfileStep.test.tsx`
- Modify: `src/app/onboarding/ProfileStep.tsx`

- [ ] **Step 1: Write the failing recovery test**

Add a test that renders `ProfileStep` with an existing profile containing `avatarDataUrl`, selects a library, verifies Continue becomes enabled without another upload, and expects `onSubmit` to receive `{ displayName, library }` without an `avatar` property.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec vitest run src/app/onboarding/ProfileStep.test.tsx`

Expected: FAIL because Continue remains disabled when the in-memory `avatar` value is null.

- [ ] **Step 3: Make avatar submission optional when an existing avatar is present**

Change the submit contract to:

```ts
onSubmit: (input: { displayName: string; avatar?: ProfileAvatarInput; library: ProjectLibraryDescriptor }) => Promise<void>;
```

Treat `avatar || initialProfile?.avatarDataUrl` as satisfying the avatar requirement, and include `avatar` in the submitted object only when the user selected a new file.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm exec vitest run src/app/onboarding/ProfileStep.test.tsx`

Expected: all ProfileStep tests pass.

- [ ] **Step 5: Commit the onboarding behavior**

```bash
git add src/app/onboarding/ProfileStep.tsx src/app/onboarding/ProfileStep.test.tsx
git commit -m "fix: reuse profile avatar during library recovery"
```

### Task 2: Remove the standalone library application phase

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Write failing startup and recovery tests**

Add one test where a completed profile and `needs-location` status must show `设置你的资料` and must not render a `选择项目库` button. Add a second test that selects a replacement directory, submits the preserved profile, and enters Studio directly when `modelStepCompleted` was already true.

- [ ] **Step 2: Run the focused App tests and verify RED**

Run: `pnpm exec vitest run src/app/App.test.tsx`

Expected: FAIL because the current state machine renders the standalone welcome page and because recovery cannot reuse the avatar.

- [ ] **Step 3: Remove the `library` phase and recovery page**

Use this phase union:

```ts
type AppPhase = 'splash' | 'profile' | 'model' | 'studio';
```

Resolve startup as follows:

```ts
const nextPhase: AppPhase = !loadedProfile?.onboarding.profileCompleted || status?.state !== 'ready'
  ? 'profile'
  : !loadedProfile.onboarding.modelStepCompleted
    ? 'model'
    : 'studio';
```

Make `submitProfile` accept an optional avatar, preserve it when omitted, and enter Studio directly when the saved profile already has `modelStepCompleted: true`. Make model completion fall back to `profile` rather than a removed phase if the library unexpectedly stops being ready. Delete the final standalone welcome/chooser branch.

- [ ] **Step 4: Run focused App and onboarding tests**

Run: `pnpm exec vitest run src/app/App.test.tsx src/app/onboarding/ProfileStep.test.tsx`

Expected: all tests pass.

- [ ] **Step 5: Commit the renderer state-machine change**

```bash
git add src/app/App.tsx src/app/App.test.tsx
git commit -m "fix: remove standalone project library recovery"
```

### Task 3: Enforce profile completion in the main process

**Files:**
- Modify: `src/desktop/ipc/profile.test.ts`
- Modify: `src/desktop/ipc/profile.ts`
- Modify: `src/desktop/ipc/register-profile.test.ts`
- Modify: `src/desktop/ipc/register-profile.ts`
- Modify: `src/desktop/main.ts`

- [ ] **Step 1: Write failing IPC invariant tests**

Add tests proving a false-to-true `profileCompleted` transition returns null and does not save when `hasActiveProjectLibrary` is false, while the same input saves when it is true. Keep an already-completed profile writable for unrelated profile changes.

- [ ] **Step 2: Run profile IPC tests and verify RED**

Run: `pnpm exec vitest run src/desktop/ipc/profile.test.ts src/desktop/ipc/register-profile.test.ts`

Expected: FAIL because the handler has no active-library predicate.

- [ ] **Step 3: Add the active-library guard**

Add `hasActiveProjectLibrary: () => boolean` to `createProfileSaveHandler` and `RegisterProfileOptions`. Before saving a requested completion transition, load the current profile and return null when it is not already complete and no library is active. Wire the production predicate as:

```ts
hasActiveProjectLibrary: () => activeProjectLibraryHandle !== null,
```

- [ ] **Step 4: Run IPC tests and typecheck**

Run: `pnpm exec vitest run src/desktop/ipc/profile.test.ts src/desktop/ipc/register-profile.test.ts && pnpm typecheck`

Expected: all tests pass and typecheck exits 0.

- [ ] **Step 5: Commit only the profile invariant hunks**

Stage the four dedicated profile files normally. Stage only the new `hasActiveProjectLibrary` registration hunk from `src/desktop/main.ts`, preserving unrelated credential edits in the working tree.

```bash
git add src/desktop/ipc/profile.ts src/desktop/ipc/profile.test.ts src/desktop/ipc/register-profile.ts src/desktop/ipc/register-profile.test.ts
git commit -m "fix: require active library for profile completion"
```

### Task 4: Remove contradictory browser setup and verify the workflow

**Files:**
- Modify: `tests/e2e/test-workspace.ts`
- Modify: `src/app/App.test.tsx` if a final regression assertion is needed

- [ ] **Step 1: Make the E2E fixture expose a ready library immediately**

Delete the `selectedLibrary` local-storage state and chooser click. Return `{ state: 'ready', library }` directly from `getProjectLibraryStatus`; retain `chooseProjectLibrary` only if another onboarding-specific test uses it.

- [ ] **Step 2: Run browser E2E**

Run: `pnpm test:e2e`

Expected: all browser E2E tests pass without locating `选择项目库`.

- [ ] **Step 3: Run focused and static verification**

Run:

```bash
pnpm exec vitest run src/app/App.test.tsx src/app/onboarding/ProfileStep.test.tsx src/desktop/ipc/profile.test.ts src/desktop/ipc/register-profile.test.ts
pnpm typecheck
pnpm lint
git diff --check
```

Expected: every command exits 0. Existing unrelated working-tree changes remain present and unstaged.

- [ ] **Step 4: Commit the E2E fixture correction**

```bash
git add tests/e2e/test-workspace.ts
git commit -m "test: start browser journeys with a ready library"
```
