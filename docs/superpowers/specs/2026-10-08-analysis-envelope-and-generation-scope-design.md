# Analysis Envelope and Generation Scope Design

## Problem

The project canvas currently exposes two related regressions:

1. A provider response that is structurally correct but uses common field variants (`role` instead of `roles`, or `releasedAssets` instead of `releasedAssetIds`) fails strict parsing. The complete JSON response is then stored as the user-facing analysis text.
2. Project-level design generation is rejected with "Open a document first" even though the project canvas intentionally supports generation without an opened document. The document requirement was added to fix workbench task filtering but was applied to both generation surfaces.

## Chosen Design

### Structured response normalization

Normalize supported provider variants at the analysis-envelope boundary before schema validation:

- Accept either `roles: VisualContextRole[]` or `role: VisualContextRole` for an item, and normalize to `roles`.
- Accept either `releasedAssetIds` or `releasedAssets`, and normalize to `releasedAssetIds`.
- Keep the validated internal `VisualContextPlan` unchanged.
- Continue rejecting unknown roles, invalid asset identifiers, duplicate assets, invalid confidence values, and envelopes without a non-empty brief.
- Persist and display only the parsed `brief`. Internal JSON must not appear in the analysis panel after successful normalization.

This keeps compatibility localized to the provider boundary instead of teaching UI components about provider response formats.

### Project and document generation scopes

Preserve the two existing scopes explicitly:

- Project canvas generation is project-scoped. It may submit conversation and design-generation tasks without a `documentId` and produces project design candidates.
- Workbench generation is document-scoped. It must submit both conversation and design-generation tasks with the active document's `documentId`, so task polling and candidates stay attached to that document.
- The shared Studio submission helper must not manufacture a document requirement for project-scoped calls.
- The "Open a document first" guard is removed from project-level generation. A missing document remains an error only in entry points that inherently edit a document.

Existing documentless projects therefore continue to work on the project canvas without migration or synthetic documents.

## Alternatives Considered

1. Relax all parsing and extract only `brief`. Rejected because it would discard visual-context roles needed for correct image selection.
2. Repair every documentless project by creating a default document. Rejected because documentless project canvases are intentional and project candidates are not document revisions.
3. Add JSON cleanup in the analysis UI. Rejected because malformed provider data should be normalized before it enters task state, not hidden at render time.

## Error Handling

Responses outside the explicitly supported variants continue to use the conservative visual-context fallback. Plain-text provider responses remain valid user-facing analysis. Project-level generation failures continue to use the existing task failure and notification paths.

## Tests

- Parser regression tests cover singular `role` and `releasedAssets`, and verify the normalized envelope.
- Task-service regression test verifies that the saved result is the brief rather than raw JSON for the provider variant shown in the report.
- Studio regression test verifies that project-canvas generation submits without a `documentId` and does not display "Open a document first".
- Existing Workbench tests continue to verify that document-scoped submissions include the active `documentId`.
