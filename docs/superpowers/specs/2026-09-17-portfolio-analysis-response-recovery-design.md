# Portfolio Analysis Response Recovery Design

## Problem

The latest portfolio analysis task completed its provider request but failed locally with `VISION_ANALYSIS_INVALID_RESPONSE`. The task store intentionally retains only a safe error code, so it cannot identify whether the model returned malformed JSON, an incomplete candidate, an invalid visual signal, or multiple candidates.

The expanded visual-signal contract increases the chance of prompt-only JSON drifting from the expected schema. Parsing currently happens after the existing provider retry boundary, so a recoverable formatting failure ends the task immediately.

## Goals

- Recover common, unambiguous model formatting deviations without weakening the stored profile contract.
- Retry one invalid model result with focused schema-repair instructions.
- Preserve safe, actionable failure diagnostics without storing portfolio content or the raw model response.
- Keep historical profiles that do not contain `styleDna.signals` readable.
- Avoid requiring provider-specific structured-output support.

## Non-Goals

- Persisting raw provider responses, prompts, image data, or portfolio descriptions.
- Accepting incomplete profiles or inventing missing semantic analysis.
- Adding provider-specific `response_format` behavior in this change.
- Retrying transport failures beyond the existing policy.

## Approach

### Validation Result

Replace the parser's single undifferentiated throw path with an internal validation result that contains a stable, non-sensitive issue code and field path. Examples include:

- `payload: invalid_json`
- `candidates: expected_single_candidate`
- `styleDna.signals.contrast: invalid_percentage`
- `negativeRules: required`

These diagnostics describe only the schema failure. They must never include rejected values or source content.

### Safe Normalization

Before validation, normalize only deterministic representation differences:

- Trim strings.
- Convert percentage strings such as `"68"` and `"68%"` to the number `68`.
- Reuse the available localized string when only `zh` or `en` is present, matching current localization behavior.
- Preserve omission of the entire `signals` object for backward compatibility.

Do not synthesize missing analysis text, clamp out-of-range values, infer missing signal fields, or select one candidate when multiple candidates were returned.

### Repair Retry

The analysis flow remains:

1. Submit the normal multimodal analysis request.
2. Parse, normalize, and validate the response.
3. If validation fails, submit one additional request containing the original images, the same output contract, and only the safe validation issue. Instruct the model to return a complete replacement JSON object, not commentary or a patch.
4. Parse and validate the second response.
5. Complete the task on success; otherwise fail with a diagnostic error code.

The retry is limited to one attempt. Cancellation remains authoritative before and during the repair request.

### Persisted Diagnostics

Add an optional safe analysis diagnostic to failed task records, represented as a bounded code rather than free-form text. The stored value contains the validation category and field path only. Existing task records remain valid when the field is absent.

The task UI may continue showing the existing localized failure message in this change. The diagnostic primarily supports troubleshooting and future UI improvements.

## Component Changes

- `src/features/agent/analyze-portfolio.ts`
  - Introduce structured validation issues.
  - Add deterministic normalization.
  - Add one schema-repair retry.
  - Throw a safe typed error after the final failure.
- `src/features/tasks/state.ts`
  - Extend task records with an optional bounded analysis diagnostic.
- `src/features/agent/task-service.ts`
  - Extract the safe diagnostic when failing a task.
- `src/desktop/storage/task-store.ts` and `src/desktop/ipc/tasks.ts`
  - Validate and persist the new optional diagnostic.
- Relevant unit and integration tests
  - Cover normalization, retry behavior, cancellation, safe diagnostics, persistence, and backward compatibility.

## Error Handling

- HTTP, rate-limit, cancellation, and provider-protocol failures continue through the existing provider failure path.
- Only successfully returned model text that fails portfolio-result parsing enters the repair path.
- A repair request transport failure reports its provider failure normally.
- A second invalid result reports `VISION_ANALYSIS_INVALID_RESPONSE` plus the safe field-level diagnostic.
- No rejected response text is written to disk or task diagnostics.

## Testing

Tests will be written before implementation and must demonstrate:

- A numeric percentage string is normalized and accepted.
- An invalid first response followed by a valid replacement completes successfully after exactly two provider calls.
- Two invalid responses fail with a safe field-level diagnostic.
- Out-of-range percentages and genuinely missing semantic fields remain rejected.
- Cancellation prevents or aborts the repair request.
- Task persistence accepts the new diagnostic and still accepts historical records without it.
- Diagnostics reject arbitrary or source-derived strings.

The focused tests, full unit suite, typecheck, lint, build, and relevant Playwright coverage must pass before completion.

## Acceptance Criteria

- Common deterministic formatting deviations no longer fail an otherwise complete analysis.
- A recoverable schema failure receives one automatic repair attempt.
- Final failures identify the invalid schema area without exposing portfolio or model-response content.
- Existing successful and historical analysis records continue to load.
- No raw rejected response is persisted.
