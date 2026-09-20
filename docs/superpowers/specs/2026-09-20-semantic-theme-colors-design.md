# Semantic Theme Colors Design

## Goal

Separate application state colors from brand and decorative accents so success, warning, error, and information states remain semantically consistent and readable in both dark and light themes.

## Root Cause

The theme has no `--success` token. Success UI currently uses `--tertiary`, which happens to be green in the dark theme but is indigo in the light theme. Other semantic gaps compound the problem: warning and primary badges have no tone styles, failed states often use warning, and the warm warning token is reused as a decorative analysis-category color.

## Token Model

Keep the existing brand hierarchy unchanged:

- `--primary`: primary brand actions, focus, and selected state.
- `--secondary`: AI and secondary brand accent.
- `--tertiary`: optional decorative brand accent only.

Add complete semantic families in both explicit themes and the system-light fallback:

- `--success`, `--on-success`, `--success-container`, `--on-success-container`
- `--warning`, `--on-warning`, `--warning-container`, `--on-warning-container`
- `--error`, `--on-error`, `--error-container`, `--on-error-container`
- `--info`, `--on-info`, `--info-container`, `--on-info-container`

Add `--accent-warm` for non-semantic warm decoration such as the texture-analysis category.

The light semantic foregrounds must be dark enough for small text on the light application surfaces. The dark semantic foregrounds should be bright enough on dark surfaces, while their `on-*` values remain readable on solid semantic fills.

## Usage Mapping

- Success badges, completed workflow steps, published confirmations, finalized revisions, and connected states use `--success` and its container.
- Failed tasks and failed exports use the error tone. Cancellation and unknown/recoverable states remain warning.
- Generic informational notices use `--info`; AI-specific surfaces continue using `--secondary`.
- Project status dots are state-specific: active is success, unsaved is warning, archived is neutral.
- Published designer status is success, draft remains a secondary/in-progress accent, and archived remains neutral.
- Active selection labels use `--primary`, not success.
- Texture-analysis decoration uses `--accent-warm`, not warning.
- Purely decorative tertiary artwork marks remain on `--tertiary`.

## Components

- Type `Badge` tones instead of accepting arbitrary strings, and provide styles for primary, success, warning, error, and AI tones.
- Add an explicit project-status tone class to `ProjectDetailPage`.
- Correct task, slot, and export badge-tone selection in `LibraryPages`.
- Update semantic CSS usages in shared studio, library, persona, project-detail, and workbench styles.

## Verification

- A theme contract test must verify that dark, explicit-light, and system-light blocks define independent semantic variables.
- The contract must prove that light success is not aliased to primary or tertiary and that light semantic foregrounds use the approved accessible values.
- CSS contract checks must verify success badges and completed states consume `--success`, informational notices consume `--info`, and decorative texture analysis consumes `--accent-warm`.
- Component tests must verify project-status and failed-task tone mappings.
- Unit, integration, type, lint, and build checks must remain green.
