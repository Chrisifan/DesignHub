# Visual Context Plan Design

## Goal

Make continuous design conversations and image generation use the same interpreted image roles. A user can refer to an original image, a generated draft, a content source, or a visual reference without manually assigning roles, and the generation request retains every image needed to execute the understood intent.

## Problem

The current conversation path rebuilds historical multimodal messages, while design generation independently chooses a flat image list using this precedence:

1. Current task `contextAssetIds`
2. Initial `designContext.attachmentAssetIds`
3. Current canvas image asset IDs

Once a generated draft enters `contextAssetIds`, the original attachments are excluded from generation even though the conversation model still sees them in history. This creates a broken contract: conversation understanding can promise to preserve original details that the image model cannot inspect.

The observed September 29 thread demonstrated the failure mode. The final conversation understood two initial JPEG references plus a generated PNG, but the following design-generation task sent only the generated PNG as an image input.

## Product Behavior

Image roles are inferred automatically. There is no mandatory role-selection control in the attachment UI.

A visual context item may have more than one role:

- `edit-target`: the image to modify or continue iterating.
- `visual-anchor`: an original source whose people, products, text, logos, or other identity-bearing details must remain available for comparison and preservation.
- `content-source`: an image that supplies a person, product, object, or other content to place into the edit target.
- `visual-reference`: an image used only to guide composition, color, material, texture, or mood.

The role strings above are persisted API values. User-facing copy may be localized, but it must preserve these distinctions.

Generated variants can become `edit-target` items. They do not remove prior `visual-anchor` items unless the user explicitly instructs the system to stop using the original, such as “only use this draft” or “do not reference the original image.”

## Persisted Model

Each conversation and design-generation `TaskRecord` may contain:

```ts
type VisualContextRole =
  | 'edit-target'
  | 'visual-anchor'
  | 'content-source'
  | 'visual-reference';

type VisualContextItem = {
  assetId: string;
  roles: VisualContextRole[];
  confidence: number;
};

type VisualContextPlan = {
  version: 1;
  items: VisualContextItem[];
  clarificationRequired: boolean;
};
```

Constraints:

- `assetId` values are unique within a plan.
- `roles` is non-empty and contains no duplicates.
- `confidence` is finite and between `0` and `1`, inclusive.
- At most one active item has `edit-target` unless the user explicitly requests a multi-image composition. Version 1 treats an ambiguous multi-target request as requiring clarification.
- Every persisted asset must belong to the current project and be readable before generation starts.
- `visualContextPlan` is optional on existing task records for backward compatibility.

The plan records role decisions, not image bytes, prompts, hidden reasoning, or provider credentials.

## Conversation Analysis

The conversation request labels every image with its stable asset ID, origin, and prior roles immediately before the image content. The model can therefore associate “图一”, “原图”, “这张图”, and similar references with a stable project asset instead of relying on an unlabeled attachment position.

The conversation model returns one structured response containing:

```json
{
  "brief": "User-visible design understanding or clarification question",
  "visualContext": {
    "items": [
      {
        "assetId": "asset-example",
        "roles": ["edit-target", "visual-anchor"],
        "confidence": 0.97
      }
    ],
    "clarificationRequired": false
  },
  "releasedAssetIds": []
}
```

This is one conversation-model request, not a second classification request. The service accumulates the response, validates the structured envelope, publishes only `brief` as user-visible progress and result text, and stores the validated plan on the task.

The request includes the previous plan. The model updates it incrementally from the new message and newly introduced assets rather than reclassifying the entire thread without continuity.

Deterministic safeguards apply after parsing:

- Every current asset must appear in the returned plan.
- Existing anchors remain anchors unless the new user instruction explicitly releases them and the response lists their IDs in `releasedAssetIds`.
- A user-selected generated design is eligible to become the new edit target.
- Duplicate role and asset entries are normalized.
- References outside the current project are rejected.

`releasedAssetIds` is validated against the current project and previous plan, then discarded after the merge. It is evidence for an explicit transition, not part of the persisted visual context plan.

The model supplies semantic classification; deterministic safeguards preserve continuity and project isolation.

## Low-Confidence And Invalid Analysis

Low confidence does not silently remove an image.

- If an edit target is clear, relevant low-confidence items remain in the plan and generation may continue.
- If no edit target can be determined, `clarificationRequired` is set to `true`; `brief` asks one concrete clarification question, and design generation is unavailable for that task.
- If the provider returns malformed structured output, the user-visible text is preserved when recoverable and the service constructs a conservative plan from the previous plan, initial attachments, current canvas, selected generated assets, and current attachments.
- The conservative plan retains existing anchors and references. It does not invent a new edit target when more than one plausible target exists.

Malformed role analysis must not cause original images to disappear.

## Generation Request

Design generation copies the complete validated plan from its parent conversation task. All candidate slots use that same immutable plan.

The request is assembled in this order:

1. `edit-target`
2. `visual-anchor`
3. `content-source`
4. `visual-reference`

An item with multiple roles is uploaded once and listed with all roles. A textual manifest maps image order to asset ID and roles. This manifest is included in the generation prompt so providers that accept an ordered set of input images receive the same semantics.

When the provider supports image editing, the edit target becomes the primary edit image and the remaining items are reference images. When only image generation is available, all items are reference images in the defined order and the manifest identifies the edit target.

Generation must not fall back to a different flat asset list once a valid plan exists. The legacy precedence logic remains only for tasks without a plan.

Retries reuse the persisted plan exactly. They do not rerun conversation analysis or change roles.

## Continuous Conversation Transitions

### Initial request

For “modify image one using the layout of image two”:

- Image one: `edit-target`, `visual-anchor`
- Image two: `visual-reference`

### Content transfer

For “replace the person in image two with the person from image one”:

- Image two: `edit-target`, `visual-anchor`
- Image one: `content-source`

### Generated-draft iteration

After generating draft C from original A and reference B, “make this draft darker but preserve the original sleeves” produces:

- C: `edit-target`
- A: `visual-anchor`
- B: `visual-reference`

### Explicit reset

“Only use this draft and stop referencing the original” may remove A and B from the active plan, leaving the selected draft as `edit-target`. The task history continues to retain the older plan for traceability.

## Legacy Compatibility

Existing `tasks.json` records remain valid and are not rewritten in bulk.

When a legacy conversation or generation task has no `visualContextPlan`, the service derives a conservative transient plan:

- A selected or current generated asset becomes `edit-target` when unambiguous.
- Initial conversation attachments become `visual-anchor` and `visual-reference` because their exact semantic distinction is unavailable.
- Current canvas images become `edit-target` and `visual-anchor` when no selected generated asset exists.
- Ambiguous multiple possible targets require clarification for a new generation request.

Once a continued conversation completes successfully, its inferred plan is persisted normally.

Task-store validation accepts both legacy records without the field and version 1 plans with strict keys and value validation.

## User Interface

No persistent role editor or additional required setup is introduced.

The existing analysis panel displays the parsed `brief`. When `clarificationRequired` is true, the brief contains the clarification question and the generate action remains disabled. The user answers through the existing conversation composer.

Attachments and generated designs continue to use their current interaction patterns. Role information remains internal in version 1; a future diagnostic or advanced inspector may expose it without changing the persisted contract.

## Error Handling

- Missing project asset: fail before provider submission with `CONTEXT_ASSET_MISSING`.
- Invalid persisted plan: reject the task file as `INVALID_TASK_STATE` under the existing storage contract.
- Invalid provider envelope: use the conservative recovery described above.
- Clarification required: conversation completes with a question, but generation submission is rejected with `VISUAL_CONTEXT_CLARIFICATION_REQUIRED`.
- No provider image capability: preserve the existing `IMAGE_CAPABILITY_UNAVAILABLE` behavior.
- Provider request failure: preserve the exact plan on the failed task and all retries.

Provider error records must not contain image bytes, prompts, or hidden analysis output.

## Scope

Included:

- Versioned visual context types and validation.
- Structured conversation response parsing and conservative recovery.
- Persisted role plans on conversation and generation tasks.
- Role-aware generation request assembly.
- Clarification gating in project canvas generation actions.
- Legacy task compatibility.
- Domain glossary and ADR updates.

Excluded:

- Manual role editing UI.
- Cross-project image access.
- Automatic image deletion or retention policy changes.
- Provider-specific computer vision preprocessing.
- Region-level pixel protection; that remains the separate “保护区域” concept.

## Testing And Acceptance

The implementation is accepted when automated tests prove:

1. A first-turn original and visual reference remain available when a later generated draft becomes the edit target.
2. The conversation model receives stable labels that associate each image with its asset ID.
3. Content-transfer requests can distinguish `content-source` from `edit-target`.
4. An explicit reset can remove old anchors from the new active plan without changing historical task records.
5. Malformed structured output retains original images through conservative recovery.
6. An ambiguous edit target produces a clarification question and blocks generation.
7. Missing assets fail before any image-provider request.
8. All one or three generation slots receive the same ordered plan.
9. Retrying a failed slot reuses the original persisted plan.
10. Legacy task records load unchanged and derive a safe transient plan.
11. New task records round-trip through the task store with strict validation.
12. Existing conversation, generation, retry, persistence, IPC, type-check, and lint suites remain green.

## Rollout

This is a local persisted-format extension. No network migration or workspace-wide rewrite is required. New tasks write `visualContextPlan.version = 1`; old tasks remain readable. A future incompatible role model must introduce a new plan version and preserve read compatibility with version 1.
