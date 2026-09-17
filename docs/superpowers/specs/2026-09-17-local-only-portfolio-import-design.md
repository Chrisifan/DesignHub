# Local-only Portfolio Import Design

## Goal

Make the AI designer creation drawer more compact and simplify portfolio import to local files only. The drawer must remain the same width throughout the workflow, uploaded files must be selected automatically, and long filenames must never widen or overflow the interface.

## Scope

This change covers the portfolio-based designer creation workflow across the renderer, desktop bridge, IPC validation, source inspector, and their tests.

Remote portfolio sources are removed end to end. The following capabilities will no longer exist:

- Entering a portfolio URL in the designer drawer.
- Inspecting a remote image URL.
- Inspecting a remote web page and extracting its images.
- Sending `remote-image` or `remote-page` inspection requests through the desktop API.
- Downloading remote portfolio assets in the source inspector.

Local image selection and local ZIP inspection remain supported. Portfolio analysis, artwork generation, publishing, and editing an already-created designer remain unchanged except for layout adaptations required by the narrower drawer.

## Drawer Layout

The portfolio creation drawer uses one width rule in every phase:

- Desktop: `min(560px, 92vw)`, which is two thirds of the current 840-pixel width.
- Narrow viewports: the same rule naturally contracts to `92vw`.
- Import, analysis, artwork, and review phases all use this width without resizing during navigation.

Layouts designed for the former 840-pixel drawer must adapt to the 560-pixel content area. The analysis report uses a single-column reading order. File candidates and artwork choices use compact tracks that do not cause horizontal scrolling. Existing mobile behavior is preserved.

## Import Experience

The import step contains only two source actions:

1. Select local images.
2. Select a local ZIP archive.

The URL text area and the actions for inspecting a page or remote image are removed. Rights confirmation, error feedback, source preview, selection controls, and the continue action remain.

When a local inspection succeeds, every returned candidate is selected immediately. Users can still clear individual checkboxes before analysis. Replacing an inspection discards the prior unsubmitted inspection through the existing cleanup flow and selects all candidates in the new inspection.

If the native file picker is cancelled and no inspection is returned, the current inspection and its selection are left unchanged. An inspection that succeeds with an empty candidate list shows the existing empty/error feedback and does not enable analysis.

## Filename Presentation

Each candidate keeps its checkbox, thumbnail when available, and original filename. The filename occupies the remaining grid width and uses a single-line ellipsis when it is too long.

The text element has `min-width: 0`, hidden overflow, `text-overflow: ellipsis`, and `white-space: nowrap`. Its `title` contains the full candidate label so the complete filename remains available on pointer hover. The checkbox and thumbnail keep stable dimensions and cannot be pushed out by the filename.

## Component And Contract Changes

`DesignerLibrary` removes the portfolio URL state, URL change callbacks, remote validation branch, and remote source actions. Its inspection handler accepts only the reduced local request union. After a successful local inspection it stores the inspection and sets the selected IDs to every candidate ID.

`PortfolioInspectionRequest` is reduced to:

- `{ kind: 'local-images' }`
- `{ kind: 'local-zip' }`

`PortfolioInspectionCandidate.origin` is reduced to `local-image | zip-image`. The desktop IPC guard accepts only these request kinds. The handler continues to open the appropriate native picker and delegates to local image or ZIP inspection.

The source inspector removes remote-image download, remote-page HTML retrieval, page image discovery, deferred remote candidates, and the public remote inspection methods. Local image decoding, ZIP safeguards, inspection storage, source selection, and inspection disposal remain intact.

The desktop API method names stay unchanged because local inspection still uses `inspectPortfolioSources`. No persisted-data migration is required because inspection records are temporary and remote origins are not part of saved designer profiles.

## Data Flow

1. The user chooses local images or a ZIP archive.
2. The desktop process opens the native picker and inspects the selected files.
3. The renderer receives a temporary inspection containing local candidates.
4. The renderer stores the inspection and selects all candidate IDs.
5. The user may deselect candidates and starts analysis.
6. The existing selection submission, analysis, artwork, and publishing flow continues unchanged.

Cancelling the picker returns no inspection and does not replace the renderer's existing candidate set. Closing or restarting the workflow continues to discard temporary inspections.

## Error Handling

- Unsupported or malformed inspection requests are rejected by the IPC guard.
- Picker cancellation is treated as a no-op, not an error.
- Local image and ZIP parsing errors continue through the existing localized creation error alert.
- An inspection with no candidates cannot advance to analysis.
- Long or unusual filenames are displayed safely as text and cannot alter the drawer width.
- Existing ZIP size, entry-count, and image validation safeguards remain in place.

## Accessibility

- Local source actions remain keyboard-accessible buttons with explicit labels.
- Candidate checkboxes remain native controls associated with their filename label.
- Automatic selection is visible in checkbox state and does not remove the user's ability to opt out.
- The full filename is exposed through the text content and hover title; ellipsis is visual only.
- The narrower layout preserves focus handling, drawer close behavior, scrollability, and footer access.

## Testing

Renderer unit tests will verify:

- The URL field and remote inspection actions are absent.
- Local image and ZIP actions send only their supported request kinds.
- All returned candidates are checked by default.
- A user can deselect an automatically selected candidate before analysis.
- Replacing an inspection selects all candidates in the replacement.
- A cancelled picker does not clear the current inspection.
- Candidate labels carry the full filename in `title` and use the filename truncation class.

Desktop and contract tests will verify:

- The request and candidate-origin unions contain only local variants at compile time.
- IPC validation accepts local image and ZIP requests and rejects unsupported request shapes.
- The inspector still handles local image and ZIP sources, selection, and cleanup.
- Remote download and page-inspection tests and fixtures are removed.

Focused browser tests will verify:

- The drawer width remains stable at 560 pixels on a sufficiently wide viewport across all steps.
- Long filenames do not overflow the candidate row or drawer.
- Uploaded candidates start selected.
- The narrower analysis, artwork, and review layouts have no horizontal overflow or overlapping content.

Completion verification includes the focused unit and browser tests, desktop tests, typecheck, lint, production build, and `git diff --check`.
