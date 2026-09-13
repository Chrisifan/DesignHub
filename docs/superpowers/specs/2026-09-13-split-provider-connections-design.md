# Split Text and Image Provider Connections

## Goal

Allow conversation/vision models and image generation/editing models to use independent OpenAI-compatible endpoints, models, and API keys while preserving existing task, IPC, cancellation, and asset persistence behavior.

## Context

DesignHub currently stores one `baseUrl`, one provider model map, and one Keychain credential for the `openai-compatible` connection. The adapter already supports two image transports (`images` and `responses`), but both text and image operations inherit the same endpoint and credential. Some gateways expose text Responses or Chat Completions without exposing image generation, while a separate image service may require a different endpoint or key.

## Data Model

The canonical persisted provider configuration becomes:

```json
{
  "openai-compatible": {
    "conversation": {
      "baseUrl": "https://text.example/v1",
      "models": {
        "conversation": "chat-model",
        "vision-analysis": "vision-model"
      }
    },
    "image": {
      "baseUrl": "https://image.example/v1",
      "imageTransport": "responses",
      "models": {
        "image-generation": "image-model",
        "image-editing": "image-model"
      }
    }
  }
}
```

`conversation.models` accepts only `conversation` and `vision-analysis`; `image.models` accepts only `image-generation` and `image-editing`. Each profile has the existing normalized HTTPS/local-HTTP URL rules. `image.imageTransport` accepts only `images` or `responses`.

The normalizer accepts the existing flat shape (`baseUrl`, `imageTransport`, and `models`) as a read/migration input. It creates both profiles by copying the old URL and credential scope, splitting models by capability. The canonical save shape is nested and rejects unknown keys, malformed profiles, unsupported transports, invalid URLs, and invalid model names. A missing profile is normalized to an empty profile only where the existing provider configuration is absent; a present malformed profile is rejected.

## Credential Boundary

The credential store remains opaque to the renderer. New accounts are derived from the provider connection id:

- `openai-compatible:conversation`
- `openai-compatible:image`

When resolving a new account, the main process may fall back to the legacy `openai-compatible` account. Startup migration copies a legacy value into both new accounts and removes neither value until both writes succeed. Existing environment-variable fallback remains available when no saved account exists. The renderer receives only boolean status and save/delete operations.

The provider settings UI tracks the active profile and sends the derived account id for credential operations. Saving one profile's key or configuration never overwrites the other profile.

## Adapter and Routing

`createOpenAICompatibleAdapter` keeps its current single-profile contract, including default `imageTransport: 'images'`, so direct callers and existing tests remain valid. The main process constructs one adapter for the selected operation profile:

- Conversation and vision use `conversation.baseUrl`, `conversation.models`, and the conversation credential.
- Image generation and editing use `image.baseUrl`, `image.models`, `image.imageTransport`, and the image credential.

The adapter continues to call `/chat/completions` for chat/vision and `/images/generations`, `/images/edits`, or `/responses` for images, always appending the path to the normalized configured URL. Responses image parsing, data-URL handling, cancellation, count validation, and credential redaction remain unchanged.

Task service interfaces continue to consume `ImageResponse` and the existing conversation adapter methods. No API key or profile secret crosses the preload boundary.

## UI Behavior

The connection page presents two clearly labeled sections:

1. Conversation and vision: base URL, conversation model, vision model, and key.
2. Image generation and editing: base URL, image transport, generation model, editing model, and key.

Each section shows its own configured status. Historical flat configuration loads into both sections. Saving URL/model settings persists the complete nested provider config while preserving the untouched profile. The random image connection test uses only the image section and its image credential.

## Error Handling

- Invalid config is rejected before persistence and produces the existing user-facing save failure state.
- Missing endpoint/key for the selected profile uses the existing provider-required errors.
- Unsupported Responses image counts continue to fail before network I/O with `RESPONSES_IMAGE_COUNT_UNSUPPORTED`.
- Network, HTTP, malformed-response, cancellation, and redaction behavior remains the adapter's existing behavior.
- Legacy credential migration is best-effort and never deletes the legacy account after a partial write.

## Testing Strategy

- Configuration tests cover canonical nested normalization, flat-config migration, profile-specific model restrictions, URL preservation, and invalid input rejection.
- Credential tests cover legacy fallback, dual-account migration, partial-write safety, and opaque status behavior.
- Provider settings tests cover default sections, loading historical flat data, independent edits, and complete nested saves.
- Main-process tests cover selecting the correct profile URL, model map, image transport, and account for each capability.
- Existing adapter tests continue to cover image transports, Responses payloads, parsing, cancellation, and redaction; chat and vision tests assert their configured conversation endpoint.
- Run affected unit tests, `pnpm lint`, `pnpm typecheck`, and `pnpm build`.

## Scope

This change does not add video generation, multi-image Responses concurrency, additional provider types, or renderer-side secret readback. Existing unrelated working-tree changes remain untouched.
