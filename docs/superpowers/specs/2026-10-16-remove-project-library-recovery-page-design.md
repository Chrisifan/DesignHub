# Remove the standalone project-library recovery page

Date: 2026-10-16. Status: approved design pending implementation.

## Problem

The startup state machine still exposes a standalone "Choose project library" page when a completed profile is paired with a project library that is unselected or cannot be opened. That page belongs to the superseded workspace/project-library recovery flow. It cannot select an individual project, discards the concrete open failure, and permits the application to represent a state that normal onboarding should never persist.

Profile completion and project-library activation are currently stored and validated independently. The renderer flow saves the library before completing the profile, but the profile IPC does not enforce that relationship. Browser E2E setup also deliberately creates a completed profile with an unselected library and enters Studio by clicking the obsolete page.

## Behavior

- Remove the standalone `library` application phase and its "Choose project library" page.
- A new installation with no completed profile continues to enter the profile onboarding step. The user selects the application storage directory there before the profile can be completed.
- A completed profile with a ready project library enters Studio as before.
- A completed profile whose configured project library is missing, unavailable, invalid, or absent returns to the profile onboarding step instead of rendering a separate recovery page.
- Recovery preserves the existing display name, avatar, and model-step completion state. The user must only reselect a valid application storage directory; an existing avatar remains sufficient and need not be uploaded again.
- After recovery succeeds, users whose model step was already completed enter Studio directly. New users continue to the model step.
- Project-library open failures do not modify or initialize the previously configured directory.

## Invariant

The main process must reject a transition to `profileCompleted: true` unless a project-library handle is active. This makes the renderer flow and persisted state share the same rule instead of relying on component ordering.

The invariant applies only when changing `profileCompleted` from false to true. Existing completed profiles may still be loaded when their external directory later disappears; the renderer handles that as onboarding recovery without rewriting the missing directory.

## Components

- `App.tsx` removes the `library` phase and routes every non-ready library state to profile onboarding. Profile submission chooses Studio or the model step from the preserved model completion flag.
- `ProfileStep.tsx` accepts an existing avatar as satisfying the avatar requirement and omits a new avatar payload when the existing avatar is reused.
- The profile save handler receives an active-library predicate and rejects profile completion when no project library is active.
- Browser E2E setup starts with a consistent ready project library and no longer clicks the removed selector.

## Error Handling

Directory selection cancellation leaves the profile form unchanged. Invalid or non-empty non-library directories continue to show the existing selection error inside profile onboarding. A failed recovery does not clear the existing profile, model completion flag, or prior project-library setting.

## Verification

- App tests prove completed-profile plus non-ready-library states enter profile onboarding and never render the standalone selector page.
- ProfileStep tests prove an existing avatar can be reused after selecting a directory.
- Profile IPC tests prove profile completion fails without an active project library and succeeds with one.
- E2E setup no longer depends on the contradictory completed-profile/unselected-library state.
- Focused App, onboarding, profile IPC, E2E, typecheck, and diff checks pass.
