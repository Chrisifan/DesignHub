# Split Provider Connections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate conversation/vision and image generation/editing into independent endpoint, model, and API-key profiles while preserving legacy configurations and existing task APIs.

**Architecture:** Store one provider connection with nested `conversation` and `image` profiles. Normalize legacy flat configs into the nested shape, use profile-specific Keychain account ids, and have the main process compose two single-profile adapters into the existing adapter interface. The renderer edits and tests each profile independently.

**Tech Stack:** TypeScript, React, Electron IPC/preload, Vitest, existing Keychain wrapper, existing OpenAI-compatible adapter.

---

### Task 1: Add canonical nested provider configuration and migration

**Files:**
- Modify: `src/features/providers/config.ts`
- Test: `src/features/providers/config.test.ts`
- Modify: `src/desktop/security/provider-config.ts`
- Test: `src/desktop/security/provider-config.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Add tests for:
- canonical nested config with conversation-only and image-only model keys;
- flat historical config becoming two profiles with models split by capability;
- preservation of a path-bearing URL such as `https://gateway.example/openai/v1`;
- rejection of unknown nested keys, invalid profile URLs, invalid image transport, and a model in the wrong profile.

Expected canonical result:

```ts
{
  conversation: { baseUrl: 'https://text.example/v1', models: { conversation: 'chat', 'vision-analysis': 'vision' } },
  image: { baseUrl: 'https://image.example/v1', imageTransport: 'responses', models: { 'image-generation': 'image', 'image-editing': 'edit' } },
}
```

Run `pnpm vitest run src/features/providers/config.test.ts src/desktop/security/provider-config.test.ts`; the new assertions must fail against the flat-only implementation.

- [ ] **Step 2: Implement profile types and normalizers**

In `config.ts`, define `ProviderConversationConfig`, `ProviderImageConfig`, and nested `ProviderConfig`. Add profile-specific allowed model keys and reuse the existing URL/model validation. Make `normalizeProviderConfig` accept either:
- canonical `{ conversation, image }`, returning a normalized nested config; or
- legacy `{ baseUrl, imageTransport?, models? }`, returning both profiles with the legacy URL and split models.

Add `providerCredentialAccount(connectionId, profile)` returning `${connectionId}:${profile}` and export profile types for UI/main-process callers.

In `provider-config.ts`, continue writing normalized configs atomically and ensure loading passes every file through `normalizeProviderConfigs`, so old files are transparently migrated on read. Saving a normalized config writes only the nested shape.

- [ ] **Step 3: Run normalization tests**

Run the focused Vitest command from Step 1. Expected: all config and provider-file migration tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/providers/config.ts src/features/providers/config.test.ts src/desktop/security/provider-config.ts src/desktop/security/provider-config.test.ts
git commit -m "feat: add split provider connection profiles"
```

### Task 2: Split credential account handling and legacy migration

**Files:**
- Modify: `src/features/providers/config.ts`
- Modify: `src/desktop/security/keyring-credentials.ts`
- Test: `src/desktop/security/keyring-credentials.test.ts`
- Modify: `src/desktop/main.ts`
- Test: `src/desktop/main.test.ts` (create if the existing main module has no isolated resolver tests)

- [ ] **Step 1: Write failing credential migration tests**

Add tests asserting:
- `providerCredentialAccount('openai-compatible', 'conversation')` and `...('image')` return the two new accounts;
- a legacy credential is copied to both new accounts when both writes succeed;
- a failed second write does not remove the legacy value;
- reading a new account falls back to the legacy account only when the new account is empty.

Run `pnpm vitest run src/desktop/security/keyring-credentials.test.ts`; confirm failures identify missing dual-account behavior.

- [ ] **Step 2: Implement credential helpers**

Keep `SystemCredentialStore` opaque and generic. Add a migration helper that reads the legacy account, writes both derived accounts, and removes neither legacy data nor an existing account on partial failure. Add a main-process helper that resolves a profile credential by checking its derived account first, then the legacy account, then the existing environment variable.

Keep existing generic credential IPC channels unchanged; the renderer passes the derived account id as the opaque connection id.

- [ ] **Step 3: Run credential tests**

Run `pnpm vitest run src/desktop/security/keyring-credentials.test.ts src/desktop/ipc/credentials.test.ts`; expected: PASS and no secret values in returned status payloads.

- [ ] **Step 4: Commit**

```bash
git add src/features/providers/config.ts src/desktop/security/keyring-credentials.ts src/desktop/security/keyring-credentials.test.ts src/desktop/main.ts
git commit -m "feat: migrate provider credentials to profile accounts"
```

### Task 3: Route capabilities through profile-specific adapters

**Files:**
- Modify: `src/desktop/main.ts`
- Modify: `src/features/providers/adapter.ts` only if a shared type export is needed
- Test: `src/desktop/main.test.ts` or a new `src/desktop/provider-adapter-resolver.test.ts`

- [ ] **Step 1: Write failing resolver tests**

Extract a pure resolver factory from `main.ts` and test it with injected config, credential lookup, and adapter factory. Assert:
- chat and vision calls reach the conversation URL with conversation models and key;
- image generation/edit calls reach the image URL with image models, image transport, and key;
- the resolver composes both adapters behind one object, so task-service still receives `chat`, `streamChat`, `analyzeVision`, `generateImage`, and `editImage`;
- missing saved config falls back to environment URL/key and legacy `images` transport.

Run the focused test and verify failure before implementation.

- [ ] **Step 2: Implement the composed resolver**

Add a pure `createProviderAdapterResolver` helper. Given a connection id, canonical config, credential getter, environment fallback, and adapter factory:
1. Load the provider config.
2. Resolve conversation and image URLs independently.
3. Resolve the profile account key with new-account then legacy-account fallback.
4. Construct one single-profile adapter for each profile.
5. Return a composed adapter whose methods are bound to the matching profile adapter.

Update `getAgentTaskService` to use this resolver. Leave `createOpenAICompatibleAdapter`'s public single-profile options and image transport default unchanged.

- [ ] **Step 3: Run adapter and resolver tests**

Run `pnpm vitest run src/features/providers/adapter.test.ts src/desktop/provider-adapter-resolver.test.ts`; expected: existing adapter tests and new routing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/desktop/main.ts src/desktop/provider-adapter-resolver.test.ts
git commit -m "feat: route provider capabilities by profile"
```

### Task 4: Update renderer contracts and provider settings UI

**Files:**
- Modify: `src/features/providers/ProviderSettings.tsx`
- Modify: `src/features/providers/ProviderSettings.test.tsx`
- Modify: `src/features/providers/connection.ts` if profile account helpers need a UI type
- Modify: `src/platform/contracts.ts`
- Modify: `src/platform/credentials.ts`
- Modify: `src/app/studio/LibraryPages.tsx`
- Modify: `src/app/studio/Studio.tsx` where credential status is checked

- [ ] **Step 1: Write failing UI tests**

Add tests asserting:
- a legacy flat config renders values in both profile sections;
- the page shows independent conversation/vision and image fields;
- changing and saving the conversation section preserves the image section;
- changing and saving the image section persists its endpoint, transport, and models while preserving conversation fields;
- each section saves/checks/deletes its own derived credential account;
- image test generation uses the image profile model and account status.

Run `pnpm vitest run src/features/providers/ProviderSettings.test.tsx`; confirm failures.

- [ ] **Step 2: Implement nested drafts and profile-scoped credentials**

Replace the single `ProviderConfigDraft` with nested conversation/image drafts. Render two labeled sections using the existing `Field`, `Select`, `Button`, and `Badge` components. Add a profile selector or section-local actions so key state, status, and save operations are scoped to `conversation` or `image`.

Build a complete nested `ProviderConfig` on every config save, preserving the untouched draft. Pass `providerCredentialAccount(connectionId, profile)` to credential callbacks. Keep the random image test button in the image section and pass only image model/endpoint state through the existing test IPC input.

Update platform callback types and `LibraryPages.tsx` wiring to accept the opaque derived account id. Update any initial connected-state check in `Studio.tsx` to check both profile accounts (with legacy fallback handled in the host).

- [ ] **Step 3: Run UI and integration tests**

Run `pnpm vitest run src/features/providers/ProviderSettings.test.tsx src/app/studio/LibraryPages.test.tsx src/app/studio/Workbench.test.tsx`; expected: PASS with no regression in provider config save payloads.

- [ ] **Step 4: Commit**

```bash
git add src/features/providers/ProviderSettings.tsx src/features/providers/ProviderSettings.test.tsx src/platform/contracts.ts src/platform/credentials.ts src/app/studio/LibraryPages.tsx src/app/studio/Studio.tsx
git commit -m "feat: split provider settings by capability"
```

### Task 5: Update all config consumers and compatibility tests

**Files:**
- Modify: `src/app/studio/Studio.tsx`
- Modify: `src/app/studio/LibraryPages.tsx`
- Modify: `src/features/agent/task-service.test.ts` only where config assumptions are embedded
- Modify: `src/desktop/ipc/providers.test.ts`
- Modify: `src/platform/runtime.ts`
- Test: `src/features/providers/config.test.ts`

- [ ] **Step 1: Search for flat config access**

Run:

```bash
rg -n "\\.baseUrl|\\.imageTransport|\\.models|openai-compatible" src --glob '*.ts' --glob '*.tsx'
```

Classify every provider config access as migration code, conversation profile, image profile, or test fixture.

- [ ] **Step 2: Replace flat reads and fixtures**

Update remaining app, IPC, runtime, and test fixtures to use nested profiles. Keep compatibility fixtures only in tests that explicitly verify migration. Ensure no task payload or renderer contract exposes API keys.

- [ ] **Step 3: Run the full unit suite**

Run `pnpm test:unit`; expected: all existing and new tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/studio/Studio.tsx src/app/studio/LibraryPages.tsx src/features/agent/task-service.test.ts src/desktop/ipc/providers.test.ts src/platform/runtime.ts src/features/providers/config.test.ts
git commit -m "test: update consumers for split provider config"
```

### Task 6: Verify quality gates and document user-facing behavior

**Files:**
- Modify: `docs/superpowers/specs/2026-09-13-split-provider-connections-design.md` only if implementation discovers a confirmed contract correction
- Test: all affected test files

- [ ] **Step 1: Run focused provider tests**

```bash
pnpm vitest run src/features/providers src/desktop/security/provider-config.test.ts src/desktop/security/keyring-credentials.test.ts src/desktop/provider-adapter-resolver.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run repository checks**

```bash
pnpm test:unit
pnpm lint
pnpm typecheck
pnpm build
```

Expected: each command exits with status 0.

- [ ] **Step 3: Inspect the final diff**

Run `git diff --check` and `git status --short`. Confirm only intended implementation files are changed in addition to the user's pre-existing worktree changes; do not stage or revert unrelated files.

- [ ] **Step 4: Commit verification-only corrections**

If any implementation-only correction is needed, add a focused test first, then fix it and rerun the relevant checks. Do not alter the existing design commit or unrelated user changes.

