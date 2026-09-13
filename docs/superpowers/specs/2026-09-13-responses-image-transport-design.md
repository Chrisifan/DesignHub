# Responses Image Transport Design

## Goal

Enable DesignHub image generation and editing through the OpenAI Responses API image-generation tool, using the existing provider API key and a user-configured base URL. This makes models such as `gpt-5.6-terra` usable when the configured provider exposes them, without changing the current conversation or vision transport.

## Scope

This change applies only to the existing `openai-compatible` provider connection.

- Conversation and vision analysis stay on `POST {baseUrl}/chat/completions` because they already use the configured base URL.
- Image generation and image editing gain an explicit transport selection:
  - `images`: the existing `POST /images/generations` and `POST /images/edits` behavior.
  - `responses`: `POST {baseUrl}/responses` with the hosted `image_generation` tool.
- The default for existing and newly normalized configurations is `images` to avoid changing a working connection after upgrade.
- Video generation, OAuth proxy integrations, additional provider connections, and an OpenAI model allowlist are out of scope.

## Configuration

`ProviderConfig` gains an `imageTransport` field with the closed values `images` and `responses`. Provider configuration remains free of secrets; the API key continues to be stored only by the credential boundary.

The existing base URL normalization remains the sole URL policy: HTTPS is required except for a loopback HTTP service, credentials/query/fragment components are rejected, and trailing slashes are removed. The Responses request derives its endpoint by appending `/responses` to the normalized base URL. It must not hard-code `https://api.openai.com`.

The settings UI exposes an image transport selector adjacent to the image model settings. Users configure a Responses-capable image model in the existing image-generation and image-editing model fields. No model identifier is special-cased in the renderer or main process.

## Request Design

The provider adapter remains the single owner of network calls and returns the existing `ImageResponse` shape. Its public image methods branch on `imageTransport`; the task service, IPC validation, asset persistence, cancellation, retries, and task records keep their current contracts.

For the Responses transport, image generation sends:

```json
{
  "model": "<configured or requested image model>",
  "input": [{
    "role": "user",
    "content": [{ "type": "input_text", "text": "<prompt>" }]
  }],
  "tools": [{ "type": "image_generation", "size": "<optional size>" }],
  "tool_choice": { "type": "image_generation" }
}
```

Image editing uses the same endpoint and tool. The source image is encoded as an `input_image` data URL before the text prompt. When a mask is present, it is sent as a second `input_image` and accompanied by a clear text instruction that it is an edit-region guide. Existing `tool`, tool-parameter, and region metadata are converted into an explicit text instruction; they are not sent as unrecognized provider parameters. This preserves user intent while avoiding a false claim that the hosted image tool has a deterministic server-side equivalent for every canvas tool.

The first implementation accepts `count: 1` for the Responses transport. Requests for more than one image fail before network I/O with a typed `RESPONSES_IMAGE_COUNT_UNSUPPORTED` error. The existing `images` transport continues to support its current count behavior. A streamed multi-image workflow is deferred until a provider contract and product behavior for partial successful results are specified.

The adapter parses only recognized Responses image output items (`image_generation_call` with a non-empty base64 `result`) into `GeneratedImage` entries. An otherwise successful response with no recognized image is an `invalid_response` error, not an empty successful task.

## Error Handling And Security

Responses requests use the existing bearer API key and current credential redaction rules. HTTP failures, rate limits, malformed JSON, malformed image output, and aborts continue to map to the existing provider error contract. A cancellation signal is passed to every Responses request.

The main process remains the only process that resolves the API key and constructs the adapter. The renderer continues to submit only request metadata through the existing IPC contracts. Tests must prove that neither request payloads nor surfaced error messages contain the key.

## Compatibility

Persisted provider configuration without `imageTransport` normalizes to `images`; saving the configuration writes the explicit field. Invalid or unknown transport values fail configuration validation. The original adapter behavior and endpoint tests stay in place as the regression suite for the `images` transport.

## Verification

Unit coverage will exercise configuration migration and validation, the settings selector, custom base-URL construction, Responses payload construction for generation and edit, base64 result parsing, typed empty-result and count errors, credential redaction, cancellation, and task-level asset persistence. Existing conversation and vision tests must continue to prove that their requests use the configured base URL and Chat Completions endpoint.
