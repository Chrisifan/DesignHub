# Canvas Image Tool IPC Design

## Problem

Canvas image-tool submissions currently include a renderer-created `Blob` in the Electron IPC payload. Electron IPC does not preserve the `Blob` prototype methods required by the main-process validator, so the handler rejects the request and returns `null` before creating a task. The renderer then reports the rejection as a model connection failure even though no provider request was attempted.

Existing unit tests call the handler directly with a same-process `Blob`, so they do not exercise the failing serialization boundary.

## Scope

Fix canvas image-tool submission for all tools that operate on an existing managed project image. Do not change batch image tools, provider connection status persistence, task execution semantics, or generated-result application.

## Design

The renderer submits the existing `sourceAssetId` instead of reading the asset and wrapping its bytes in a `Blob`. The IPC bridge input requires a non-empty managed source asset ID and contains only structured-clone-safe data.

The agent task service accepts an image-edit submission whose image may be omitted when a source asset ID is present. Before creating or executing the task, it resolves the source through its existing `loadSourceImage` dependency. The resolved internal input always contains a real main-process `Blob`, so provider adapters and local transforms keep their current contract.

Masks continue to use `maskAssetId` and the existing main-process loader. Renderer-created mask bytes are already persisted before submission and therefore do not cross this IPC boundary as a `Blob`.

## Data Flow

1. The canvas identifies the selected managed design and submits its `sourceAssetId` with the tool parameters.
2. The IPC validator accepts only a trusted, writable active workspace, valid project/tool fields, and a non-empty source asset ID.
3. The task service loads the source image from the current project library and reconstructs a main-process `Blob`.
4. If the asset is unavailable, submission throws a source-asset error and no provider request is made.
5. Otherwise task creation and image-tool execution continue through the existing runtime.

## Error Handling

An IPC rejection must not be described as a model connection failure. The renderer reports that the image task could not be submitted. Provider execution failures remain task failures and do not update the persistent connection status.

## Tests

- Add an IPC handler regression test proving a structured-clone-safe payload with `sourceAssetId` is accepted without a renderer `Blob`.
- Add a task-service test proving the managed source image is loaded before execution and that a missing asset rejects submission.
- Update the Studio submission test to assert that the bridge payload contains `sourceAssetId` and does not contain `image`.
- Run focused tests first, then typecheck, lint, the full unit suite, build, and `git diff --check`.

## Non-Goals

- Sending arbitrary, unmanaged image bytes through the agent IPC bridge.
- Changing provider selection or connection-test behavior.
- Refactoring unrelated image-tool or task UI.
