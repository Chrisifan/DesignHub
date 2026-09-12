# M06 provider adapter research

Research date: 2026-09-12

## Sources

- OpenAI Chat Completions API: https://platform.openai.com/docs/api-reference/chat/create
- OpenAI vision guide (image URL and data URL content parts): https://platform.openai.com/docs/guides/vision
- OpenAI image generation API: https://platform.openai.com/docs/api-reference/images/create
- OpenAI image edits API: https://platform.openai.com/docs/api-reference/images/createEdit
- OpenAI Node source, `v7.15.0`: https://github.com/openai/openai-node/tree/v7.15.0/src/resources
- npm metadata for `openai`: `npm view openai version --json` returned `7.15.0` on the research date.

## Decisions

- Use the documented OpenAI-compatible HTTP paths (`/chat/completions`, `/images/generations`, and `/images/edits`) with native `fetch`; no commercial SDK is required by this adapter.
- Chat streaming uses `stream: true` and parses Server-Sent Events. A `data: [DONE]` record ends the stream. Malformed JSON records are surfaced as an adapter error rather than silently dropped.
- The adapter accepts an injected fetch implementation and `AbortSignal`, so tests and the Electron main process own networking and cancellation. Renderer-facing request types contain no API key. The key is only applied to the main-side request header and is never included in thrown errors or response objects.
- HTTP failures preserve status, retry-after, and provider error code/message where available. Rate limits are reported as `rate_limited`; no fabricated retry duration or cost is produced. Usage/cost is `null` when the provider does not return usage or pricing data.
- Cancellation is local `AbortController` cancellation. The adapter does not claim that the remote provider cancelled a request.
