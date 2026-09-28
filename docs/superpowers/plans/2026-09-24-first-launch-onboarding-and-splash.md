# First-Launch Onboarding And Splash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-launch branded splash screen and a two-step first-launch flow that persists the user profile, local avatar, project-library location, and optional model-configuration completion state.

**Architecture:** Keep the existing project-library lifecycle and provider IPC contracts. Add an application-level `profile.json` store and trusted IPC bridge, then let `App` coordinate splash, profile onboarding, model onboarding, and Studio entry. Extract only the provider UI/data wiring needed to embed the existing `ProviderSettings` in onboarding; Studio reads the same profile instead of writing the legacy renderer-only operator name.

**Tech Stack:** Electron 44, React 19, TypeScript 5.9, Vitest, Testing Library, `sharp`, existing Electron Forge/Vite build.

**Spec:** `docs/superpowers/specs/2026-09-24-first-launch-onboarding-and-splash-design.md`

## Global Constraints

- Preserve the current single project-library model; do not restore workspace switching, recent-workspace reopening, or migration behavior.
- Store application profile data in `userData/profile.json` with atomic replacement and `formatVersion: 1`.
- Splash content uses existing `public/designhub-logo-light.png` / `public/designhub-logo-dark.png`, is centered, and has a minimum 650ms display time.
- Avatar input accepts PNG, JPEG, WebP, and GIF first frame; input is at most 10MB and persisted output is at most 512KB.
- The model step can be skipped; save and skip both mark `onboarding.modelStepCompleted` as true.
- Follow TDD for every behavior change: write one focused failing test, run it red, implement the smallest change, run it green, then refactor.
- Work directly on the current `main` branch; do not create a worktree or delegate implementation to another agent.

---

### Task 1: Add the Application Profile Domain And Atomic Store

**Files:**
- Create: `src/features/profile/model.ts`
- Create: `src/desktop/storage/profile-store.ts`
- Create: `src/desktop/storage/profile-store.test.ts`

**Interfaces:**
- `AppProfile = { formatVersion: 1; displayName: string; avatarDataUrl: string | null; onboarding: { profileCompleted: boolean; modelStepCompleted: boolean } }`
- `ProfilePatch = Partial<Pick<AppProfile, 'displayName' | 'avatarDataUrl'>> & { onboarding?: Partial<AppProfile['onboarding']> }`
- `createProfileStore(userDataDirectory, operations?)` returns `loadProfile(): Promise<AppProfile | null>` and `saveProfile(patch: ProfilePatch): Promise<AppProfile>`.
- Invalid or missing files are distinguished: missing returns `null`; invalid content throws `INVALID_PROFILE` without replacing the file.

- [x] **Step 1: Write the failing tests**

```ts
it('returns null when profile.json is missing', async () => {
  const store = createProfileStore(tempDirectory);
  await expect(store.loadProfile()).resolves.toBeNull();
});

it('merges a patch and reloads the saved profile', async () => {
  const store = createProfileStore(tempDirectory);
  await expect(store.saveProfile({
    displayName: 'Sifan',
    avatarDataUrl: 'data:image/webp;base64,AA==',
    onboarding: { profileCompleted: true },
  })).resolves.toMatchObject({
    formatVersion: 1,
    displayName: 'Sifan',
    onboarding: { profileCompleted: true, modelStepCompleted: false },
  });
  await expect(store.loadProfile()).resolves.toMatchObject({ displayName: 'Sifan' });
});

it('rejects malformed JSON without overwriting the existing file', async () => {
  await writeFile(join(tempDirectory, 'profile.json'), '{bad', 'utf8');
  const store = createProfileStore(tempDirectory);
  await expect(store.loadProfile()).rejects.toThrow('INVALID_PROFILE');
});
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `pnpm vitest run --config vitest.config.ts src/desktop/storage/profile-store.test.ts`

Expected: FAIL because the profile model/store modules do not exist.

- [x] **Step 3: Implement the profile model and store**

Use the same `fs/promises` temporary-file-plus-rename pattern as `project-library-settings-store.ts`. Normalize loaded values to the exact `formatVersion: 1` shape, reject arrays, empty display names, unsupported avatar values, and missing boolean onboarding fields, and initialize a missing profile with empty display name/avatar and both completion flags false when `saveProfile` is first called.

- [x] **Step 4: Run the focused test to verify it passes**

Run: `pnpm vitest run --config vitest.config.ts src/desktop/storage/profile-store.test.ts`

Expected: PASS with all profile-store assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/model.ts src/desktop/storage/profile-store.ts src/desktop/storage/profile-store.test.ts
git commit -m "feat: add application profile store"
```

### Task 2: Add Avatar Normalization And Trusted Profile IPC

**Files:**
- Create: `src/desktop/profile-avatar.ts`
- Create: `src/desktop/ipc/profile.ts`
- Create: `src/desktop/ipc/profile.test.ts`
- Modify: `src/platform/contracts.ts`
- Modify: `src/platform/runtime.ts`
- Modify: `src/desktop/preload.ts`
- Modify: `src/desktop/main.ts`

**Interfaces:**
- `ProfileAvatarInput = { mimeType: string; bytes: Uint8Array }`
- `normalizeProfileAvatar(input: ProfileAvatarInput): Promise<string>` returns a `data:image/webp;base64,...` string no larger than 512KB, or throws `INVALID_PROFILE_AVATAR`.
- IPC channels: `profile:get` and `profile:save`.
- Desktop API: `loadProfile(): Promise<AppProfile | null>` and `saveProfile(input: { displayName: string; avatar: ProfileAvatarInput | null; onboarding?: Partial<AppProfile['onboarding']> }): Promise<AppProfile | null>`.

- [x] **Step 1: Write failing avatar and IPC tests**

```ts
it('rejects an unsupported MIME type before image processing', async () => {
  await expect(normalizeProfileAvatar({ mimeType: 'text/plain', bytes: new Uint8Array([1]) }))
    .rejects.toThrow('INVALID_PROFILE_AVATAR');
});

it('rejects an untrusted sender for profile save', async () => {
  const handler = createProfileSaveHandler(fakeWindow, 'app://trusted', store, normalizeProfileAvatar);
  await expect(handler({ sender: { getURL: () => 'https://evil.test', mainFrame: { url: 'https://evil.test' } } } as never, input))
    .resolves.toBeNull();
});
```

- [x] **Step 2: Run the focused tests to verify they fail**

Run: `pnpm vitest run --config vitest.config.ts src/desktop/ipc/profile.test.ts`

Expected: FAIL because avatar normalization, channels, and handlers do not exist.

- [x] **Step 3: Implement image normalization and profile handlers**

Check the 10MB input limit before calling `sharp`, accept only `image/png`, `image/jpeg`, `image/webp`, and `image/gif`, use `sharp(bytes, { animated: false }).rotate().resize({ width: 512, height: 512, fit: 'cover' }).webp({ quality: 82 })`, and reject output above 512KB. The IPC save handler trims the display name, requires a non-empty name when `profileCompleted` is requested, normalizes the avatar when supplied, and merges the resulting patch through the profile store. Reuse `isTrustedWorkspaceRequest` for sender validation.

- [x] **Step 4: Wire the bridge and main process**

Add the optional methods to `DesktopApi`, implement unavailable runtime fallbacks, expose them from preload, instantiate `createProfileStore(app.getPath('userData'))` in `app.whenReady`, and register both `ipcMain.handle` channels beside the existing project-library handlers.

- [x] **Step 5: Run the focused tests to verify they pass**

Run: `pnpm vitest run --config vitest.config.ts src/desktop/ipc/profile.test.ts src/desktop/storage/profile-store.test.ts`

Expected: PASS, including trusted/untrusted IPC cases and size/type validation.

- [ ] **Step 6: Commit**

```bash
git add src/desktop/profile-avatar.ts src/desktop/ipc/profile.ts src/desktop/ipc/profile.test.ts src/platform/contracts.ts src/platform/runtime.ts src/desktop/preload.ts src/desktop/main.ts
git commit -m "feat: expose persisted profile through desktop IPC"
```

### Task 3: Build the Reusable Profile Onboarding Step

**Files:**
- Create: `src/app/onboarding/ProfileStep.tsx`
- Create: `src/app/onboarding/ProfileStep.test.tsx`
- Create: `src/app/onboarding/onboarding.css`
- Modify: `src/app/locales/zh-CN.json`
- Modify: `src/app/locales/en.json`

**Interfaces:**
- `ProfileStepProps = { locale: Locale; initialProfile: AppProfile | null; onChooseProjectLibrary: () => Promise<ProjectLibraryDescriptor | null>; onSubmit: (input: { displayName: string; avatar: ProfileAvatarInput; library: ProjectLibraryDescriptor }) => Promise<void>; busy?: boolean; error?: string }`.
- The component exposes accessible controls named for nickname, avatar upload, and storage folder, and calls `onSubmit` only when all three values are present.

- [x] **Step 1: Write failing component tests**

```tsx
it('keeps continue disabled until nickname, avatar, and folder are present', async () => {
  render(<ProfileStep {...props} />);
  expect(screen.getByRole('button', { name: '继续' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: '昵称' }), { target: { value: 'Sifan' } });
  fireEvent.change(screen.getByLabelText('上传头像'), { target: { files: [new File(['avatar'], 'avatar.png', { type: 'image/png' })] } });
  fireEvent.click(screen.getByRole('button', { name: '选择存储文件夹' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '继续' })).toBeEnabled());
});
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `pnpm vitest run --config vitest.config.ts src/app/onboarding/ProfileStep.test.tsx`

Expected: FAIL because the component and onboarding styles do not exist.

- [x] **Step 3: Implement the step**

Use a hidden `input[type=file]` with `accept="image/png,image/jpeg,image/webp,image/gif"`; read the selected file as bytes for IPC and use an object URL only for preview, revoking the previous URL on replacement/unmount. The storage button delegates directory selection to `onChooseProjectLibrary`, preserves the selected descriptor, and renders the selected path. Show inline validation/error text without clearing valid fields. Keep the layout fixed enough that avatar preview, folder path, and validation messages do not change the overall wizard width.

- [x] **Step 4: Add localized copy and styles**

Add labels for step title, nickname, avatar, upload, storage folder, choose folder, continue, invalid avatar, and directory errors in both locale files. Style the avatar preview, upload button, folder field, and fixed-height step content using existing tokens and the project’s reduced-motion media query.

- [x] **Step 5: Run the focused test to verify it passes**

Run: `pnpm vitest run --config vitest.config.ts src/app/onboarding/ProfileStep.test.tsx`

Expected: PASS for required-field gating, upload preview, folder selection, cancellation, and error preservation.

- [ ] **Step 6: Commit**

```bash
git add src/app/onboarding/ProfileStep.tsx src/app/onboarding/ProfileStep.test.tsx src/app/onboarding/onboarding.css src/app/locales/zh-CN.json src/app/locales/en.json
git commit -m "feat: add required profile onboarding step"
```

### Task 4: Extract Provider Onboarding Content And Add Model Step

**Files:**
- Create: `src/app/onboarding/ModelStep.tsx`
- Create: `src/app/onboarding/ModelStep.test.tsx`
- Modify: `src/app/studio/LibraryPages.tsx`
- Modify: `src/features/providers/ProviderSettings.tsx`
- Modify: `src/app/locales/zh-CN.json`
- Modify: `src/app/locales/en.json`

**Interfaces:**
- `ModelStepProps = { locale: Locale; onComplete: () => Promise<void>; onSkip: () => Promise<void> }`.
- `ProviderSettings` remains the source of truth for provider forms and receives the same `connections`, credential callbacks, config callbacks, and test callbacks currently wired by `ConnectionsPage`.
- `ConnectionsPage` continues to open the existing modal directly; it shares a provider runtime hook/data adapter with `ModelStep` rather than duplicating IPC calls.

- [x] **Step 1: Write failing model-step tests**

```tsx
it('allows the model step to be skipped without touching provider credentials', async () => {
  const onSkip = vi.fn(async () => undefined);
  render(<ModelStep locale="zh-CN" onComplete={vi.fn(async () => undefined)} onSkip={onSkip} />);
  fireEvent.click(screen.getByRole('button', { name: '跳过，稍后设置' }));
  await waitFor(() => expect(onSkip).toHaveBeenCalledOnce());
});
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `pnpm vitest run --config vitest.config.ts src/app/onboarding/ModelStep.test.tsx`

Expected: FAIL because the model step and shared provider wiring do not exist.

- [x] **Step 3: Extract the shared provider runtime wiring**

Move the `availableConnections` list, credential/config loading, provider status calculation, save callback, and connection test callbacks from `ConnectionsPage` into a focused hook or component-local adapter exported from a provider module. Keep `ConnectionsPage`’s modal/profile switcher behavior unchanged and pass `ProviderSettings` the same props.

- [x] **Step 4: Implement the model step**

Render the shared provider configuration in a fixed-height onboarding panel with a primary `完成并进入首页` action and a secondary `跳过，稍后设置` action. Completion and skip call their callbacks exactly once; errors stay within the panel and do not close the wizard. Do not require a configured credential to finish because the entire step is optional.

- [x] **Step 5: Run provider and model tests**

Run: `pnpm vitest run --config vitest.config.ts src/app/onboarding/ModelStep.test.tsx src/features/providers/ProviderSettings.test.tsx src/app/studio/LibraryPages.test.tsx`

Expected: PASS with existing provider behavior preserved and skip/save callbacks covered.

- [ ] **Step 6: Commit**

```bash
git add src/app/onboarding/ModelStep.tsx src/app/onboarding/ModelStep.test.tsx src/app/studio/LibraryPages.tsx src/features/providers/ProviderSettings.tsx src/app/locales/zh-CN.json src/app/locales/en.json
git commit -m "feat: reuse provider settings in model onboarding"
```

### Task 5: Replace App Entry With Splash And Onboarding State Machine

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/styles/window.css`
- Modify: `src/app/locales/zh-CN.json`
- Modify: `src/app/locales/en.json`

**Interfaces:**
- Internal `AppPhase = 'splash' | 'profile' | 'model' | 'library-error' | 'studio'`.
- App uses `getDesktopApi().loadProfile()` and `getDesktopApi().getProjectLibraryStatus()` in parallel, starts a 650ms timer, and reveals the destination only after both are ready.
- Profile completion saves the profile and selected project library, then transitions to model; model save or skip updates `modelStepCompleted` and transitions to existing project-library entry.

- [x] **Step 1: Write failing App tests**

```tsx
it('shows the branded splash before first-launch onboarding', async () => {
  vi.useFakeTimers();
  window.designhub = { loadProfile: async () => null, getProjectLibraryStatus: async () => ({ state: 'unselected' }) } as never;
  render(<App />);
  expect(screen.getByRole('img', { name: 'Design Hub' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: '设置你的资料' })).toBeNull();
  await act(async () => { vi.advanceTimersByTime(650); });
  expect(await screen.findByRole('heading', { name: '设置你的资料' })).toBeVisible();
  vi.useRealTimers();
});

it('skipping model setup enters the project library flow', async () => {
  window.designhub = { loadProfile: async () => completedProfile, getProjectLibraryStatus: async () => readyLibrary } as never;
  render(<App />);
  await screen.findByRole('heading', { name: '配置模型连接' });
  fireEvent.click(screen.getByRole('button', { name: '跳过，稍后设置' }));
  await waitFor(() => expect(screen.getByRole('heading', { name: '项目库' })).toBeVisible());
});
```

- [x] **Step 2: Run the focused App tests to verify they fail**

Run: `pnpm vitest run --config vitest.config.ts src/app/App.test.tsx`

Expected: FAIL because App still renders the old welcome/project-library entry and has no splash/profile/model phases.

- [x] **Step 3: Implement splash and load coordination**

Replace the old `entered` boolean with an explicit phase and a single cancellable startup effect. Render only the splash while loading; use a cleanup timer and cancellation flag. Preserve locale/theme controls only after splash if the current shell design requires them, and keep project-library error rendering after the splash rather than showing a blank screen.

- [x] **Step 4: Wire profile and model transitions**

On profile submit, call `saveProfile` with the avatar bytes and `profileCompleted: true`, then set the selected project-library status and phase `model`. On model save/skip, call `saveProfile({ onboarding: { modelStepCompleted: true } })`, then resolve the existing project-library status into Studio or the location-recovery state. Do not write `designhub.operator.name` from App.

- [x] **Step 5: Add splash and wizard styling/copy**

Add `.startup-splash` centered layout, logo sizing, slogan typography, fade-out class, fixed onboarding panel dimensions, and reduced-motion overrides. Add copy for the splash slogan and both step headings/actions in both locale files. Use the existing light/dark logo assets with `picture` or theme selectors.

- [x] **Step 6: Run the App tests to verify they pass**

Run: `pnpm vitest run --config vitest.config.ts src/app/App.test.tsx`

Expected: PASS for splash timing, first-launch steps, skip behavior, project-library errors, locale/theme switching, and existing no-example guarantees after updating stale old-workspace assertions to the current project-library contract.

- [ ] **Step 7: Commit**

```bash
git add src/app/App.tsx src/app/App.test.tsx src/app/styles/window.css src/app/locales/zh-CN.json src/app/locales/en.json
git commit -m "feat: add startup splash and onboarding state machine"
```

### Task 6: Feed Persisted Profile Into Studio And Remove Legacy Writes

**Files:**
- Modify: `src/app/studio/Studio.tsx`
- Modify: `src/app/studio/StudioUserMenu.tsx`
- Modify: `src/app/studio/StudioUserMenu.test.tsx`
- Modify: `src/app/Studio.test.tsx`
- Modify: `src/app/styles/studio.css`

**Interfaces:**
- `StudioProps` gains `profile?: Pick<AppProfile, 'displayName' | 'avatarDataUrl'> | null`.
- `StudioUserMenuProps` gains `avatarDataUrl?: string | null`; when present, render the image with an accessible alt label, otherwise render the existing initial fallback.
- Settings may still allow changing the display name through the profile API, but it must update the same profile record and never write `designhub.operator.name`.

- [x] **Step 1: Write failing profile-display tests**

```tsx
it('renders the persisted avatar instead of the initial fallback', () => {
  render(<StudioUserMenu {...props} operatorName="Sifan" avatarDataUrl="data:image/webp;base64,AA==" />);
  expect(screen.getByRole('img', { name: '用户头像' })).toHaveAttribute('src', 'data:image/webp;base64,AA==');
  expect(screen.queryByText('S')).toBeNull();
});
```

- [x] **Step 2: Run the focused tests to verify they fail**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/StudioUserMenu.test.tsx src/app/Studio.test.tsx`

Expected: FAIL because the menu only accepts and renders an operator-name initial.

- [x] **Step 3: Implement profile propagation**

Pass the loaded profile from `App` into `Studio`, thread it to `StudioUserMenu` and any settings form, and update the operator-name change callback to call `saveProfile` with the trimmed display name. Keep the current 80-character limit and initial fallback for missing avatar data.

- [x] **Step 4: Run focused tests to verify they pass**

Run: `pnpm vitest run --config vitest.config.ts src/app/studio/StudioUserMenu.test.tsx src/app/Studio.test.tsx`

Expected: PASS with image and fallback avatar cases, name editing, and existing Studio navigation behavior.

- [ ] **Step 5: Commit**

```bash
git add src/app/studio/Studio.tsx src/app/studio/StudioUserMenu.tsx src/app/studio/StudioUserMenu.test.tsx src/app/Studio.test.tsx src/app/styles/studio.css
git commit -m "feat: display persisted profile in studio"
```

### Task 7: Full Verification And Windows Packaging Check

**Files:**
- Modify only files needed to resolve verified failures; no unrelated refactors.

- [x] **Step 1: Run focused unit suites**

Run: `pnpm test:unit -- src/app src/desktop/storage/profile-store.test.ts src/desktop/ipc/profile.test.ts src/features/providers/ProviderSettings.test.tsx`

Expected: all onboarding, profile, provider, and existing app suites pass. Record any unrelated legacy workspace failures separately instead of masking them.

- [x] **Step 2: Run typecheck and lint**

Run: `pnpm typecheck && pnpm lint`

Expected: both commands exit 0 with no TypeScript errors or lint warnings.

- [x] **Step 3: Run production build**

Run: `pnpm build`

Expected: renderer, main, and preload Vite builds exit 0 and include the existing logo assets.

- [ ] **Step 4: Run packaging dry check**

Run: `pnpm exec electron-forge package --platform win32 --arch x64`

Expected: a Windows package directory is generated without missing preload/asset errors. Do not claim the package runs on Windows from macOS; report packaging output path and any platform-specific limitation.

- [ ] **Step 5: Run final diff checks and commit**

Run: `git diff --check && git status --short --branch`

Expected: no whitespace errors; only intended onboarding/splash/profile changes are present.

```bash
git add src docs
git commit -m "feat: complete first-launch onboarding and startup splash"
```

## 2026-09-25 closure note

Profile, avatar, onboarding, provider-step, App, Studio, E2E, native source smoke, unit, integration, lint, typecheck and build steps are checked against fresh local evidence. The Windows Forge dry check was attempted on macOS and interrupted during finalization, so Step 4 remains unchecked. Step 5 remains unchecked because this run preserves the uncommitted working tree and does not create a commit.
