# Portfolio Wizard Upload And Avatar Design

## Goal

Refine the portfolio-based designer creation wizard so it is narrower, uses one file drop/paste uploader, preserves work when navigating backwards, follows the four-step sequence in both directions, and generates one replaceable Avatar instead of three candidates.

## Scope

This change covers the portfolio creation drawer in the renderer and the local portfolio inspection bridge needed for click selection, drag-and-drop, and clipboard paste. It does not change the portfolio analysis prompt, the visual DNA result format, designer persistence, or editing of existing designers.

## Drawer Layout

The portfolio drawer uses one width rule throughout all four steps:

- Desktop: `min(520px, 92vw)`.
- Narrow viewports: the same rule contracts naturally to `92vw`.
- Import, analysis, Avatar, and review use the same width, so moving between steps never resizes the drawer.

The existing compact, dark, work-focused presentation remains. Analysis cards stay in a single column. Upload filenames and the generated Avatar must remain within the content width without horizontal scrolling.

## Unified File Uploader

Replace the separate "Choose images" and "Choose ZIP" buttons with one file-upload region. The region supports three equivalent entry paths:

1. Click the region or its upload command to open one native file picker.
2. Drag supported local files onto the region.
3. Focus the region and paste supported files from the clipboard.

The uploader accepts either:

- one to eight PNG, JPEG, WebP, or GIF image files; or
- one ZIP archive containing one to eight supported images.

A ZIP cannot be combined with loose images, and multiple ZIP archives are rejected. The ZIP's extracted images count toward the same eight-image maximum. An invalid or over-limit batch is rejected as a whole and leaves the current uploaded files and selection unchanged.

The upload region shows concise format and limit text, a familiar upload icon, drag-over feedback, and a clear keyboard focus state. It remains a real accessible button/drop target rather than a decorative card. Pasting or dropping when the region is not the intended target must not unexpectedly replace files elsewhere in the application.

After successful inspection, all returned image candidates are selected by default. The existing candidate list remains below the uploader, with stable checkbox and thumbnail columns and ellipsized filenames. Users may deselect individual images before analysis.

## Upload Contract And Security

The renderer and desktop bridge use one local-file inspection contract. A picker request contains no bytes and asks the main process to open the unified local picker. A drop or paste request contains a bounded list of file records with filename, declared MIME type, and bytes read from the browser `File` object.

The renderer performs immediate UX validation, but the trusted main-process boundary remains authoritative. IPC validation and the portfolio source inspector independently enforce:

- supported filename extension and matching file signature;
- at most eight loose images;
- one ZIP archive with at most eight inspectable images;
- no ZIP/image mixing or multiple ZIPs;
- the existing 8 MiB per-image limit;
- the existing 24 MiB ZIP, 128-entry, archive-path, and decompression safeguards;
- no remote URLs or filesystem paths supplied by the renderer.

Native-picker paths stay inside the main process. Dropped and pasted bytes are temporary inspection data and are discarded when replaced or when the drawer closes. No new portfolio source data is persisted.

## Preserved Wizard State

A successful inspection remains alive for the lifetime of the open creation drawer. Starting or completing analysis no longer clears the inspection or selected source IDs. Therefore, returning from feature analysis to import shows the same filenames, previews, checkboxes, rights confirmation, and selected state.

Uploading a valid replacement batch discards the previous temporary inspection only after the replacement inspection succeeds. Cancelling the native picker or rejecting a drop/paste batch leaves the current inspection unchanged.

Closing the drawer still discards all temporary inspection data and resets the creation session. Reopening the workflow starts clean.

## Step Navigation

Navigation follows the visible four-step sequence:

- Step 1, Import: cancel closes the drawer; successful analysis advances to Step 2.
- Step 2, Feature analysis: back returns to Step 1 with upload and selection state intact; next starts Avatar generation and advances to Step 3.
- Step 3, Character fitting: back returns to Step 2 with the existing analysis report intact; next advances to Step 4 once an Avatar exists.
- Step 4, Review: back returns to Step 3 with the generated Avatar intact.

Each phase gets a specific back callback. The shared "back to import" callback is removed so later phases cannot skip intermediate steps. Existing drawer scroll reset behavior remains keyed to phase changes.

## Single Avatar Generation

Character fitting requests exactly one generated image by sending `count: 1`. During generation, Step 3 displays the existing progress treatment adapted to one Avatar placeholder and text that says one image is being generated.

When generation completes, the sole image is selected automatically. Step 3 presents it as a single centered Avatar preview rather than a candidate grid. The user does not need to make a redundant selection before continuing.

Step 3 provides a "Regenerate" command with a refresh icon. Regeneration:

- remains on Step 3;
- enters the same generation loading state;
- submits another one-image request from the preserved visual DNA;
- replaces the displayed and selected Avatar only after a new image is read successfully.

While regeneration is running, the current Avatar may be hidden by the loading state, but its selection is retained until replacement succeeds. If submission or asset reading fails, the prior Avatar is restored and the error appears on Step 3, allowing another retry. Generated assets already stored by the task service are not deleted by this UI change.

## Error Handling

Uploader errors distinguish unsupported type, mixed ZIP/image selection, multiple ZIP files, image-count overflow, individual size overflow, and invalid archive content where the desktop layer exposes those conditions. Errors are localized and shown beside the uploader without clearing a previously valid batch.

Analysis and Avatar task failures remain recoverable in their current step. A failed analysis does not discard uploaded sources. A failed initial Avatar generation leaves Step 3 with a retry action; a failed regeneration preserves the previous Avatar.

## Accessibility

- The uploader is keyboard focusable and has an explicit accessible name.
- Enter and Space open the native picker.
- Drag state is supplemental and is never the only way to upload.
- Paste support does not intercept ordinary text paste outside the focused uploader.
- Candidate checkboxes retain their filename labels and native checked state.
- Step indicators continue to expose the active step through their existing visual and DOM order.
- The single Avatar uses meaningful surrounding headings; its image alternative identifies it as the generated designer Avatar.
- Regenerate and next actions are ordinary labeled buttons with suitable icons and disabled states while generation is busy.

## Testing

Renderer tests will cover:

- one uploader replaces the two wide source buttons;
- click, drop, and paste send the unified local-file requests;
- invalid mixed or over-limit batches do not replace a valid inspection;
- inspected candidates begin selected;
- analysis completion preserves uploaded candidates and check states when returning to import;
- Step 3 back returns to Step 2 and Step 4 back returns to Step 3;
- Avatar requests use `count: 1`;
- the sole Avatar is selected automatically;
- regeneration replaces the Avatar on success and preserves the old one on failure.

Desktop tests will cover unified picker classification, byte-upload IPC validation, image and ZIP inspection through the shared safeguards, source-count enforcement, and rejection of untrusted or malformed payloads.

Focused browser tests will verify the stable 520-pixel desktop width, responsive narrow width, real drop/paste upload behavior where supported by Playwright, retained state across back navigation, sequential step navigation, one-Avatar presentation, regenerate loading state, and absence of horizontal overflow. Completion verification includes focused tests, the full unit suite, typecheck, lint, production build, screenshot inspection, and `git diff --check`.
