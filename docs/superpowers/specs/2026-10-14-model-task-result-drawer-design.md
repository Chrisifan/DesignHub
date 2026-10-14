# Model Task Result Drawer Design

## Goal

Localize model-task type labels and move result details out of table rows into a dedicated result drawer.

## Task Type Labels

Map the known persisted capability values through the active application locale:

- `conversation`: 对话 / Conversation
- `design-generation`: 设计生成 / Design generation
- `image-generation`: 图片生成 / Image generation
- `image-editing`: 图片编辑 / Image editing
- `local-transform`: 本地转换 / Local transform
- `vision-analysis`: 作品集分析 / Portfolio analysis

Unknown values remain visible as their stored value so new capabilities do not become blank.

## Result Column

The result column remains a single table cell and never renders expandable row content.

- Design-generation tasks show a button such as `候选 1/3` / `Candidates 1/3`.
- Other tasks with image result assets show a button such as `2 张图片` / `2 images`.
- Tasks without inspectable image results show an em dash.
- Cost remains available in the result control tooltip when present.
- Clicking a result control opens the result drawer without navigating away from the task list.

## Result Drawer

Use the existing `Drawer` component and render one result card per generation slot or image asset.

- Completed candidates load their real managed asset bytes through `readAsset` using the active `libraryId`, the task project ID, and the candidate asset ID.
- Candidate direction and localized state remain visible when a preview cannot be loaded.
- Queued and running slots show a stable placeholder.
- Failed and cancelled slots show a restrained failure state and keep the existing explicit retry action when the whole generation batch is settled.
- Retrying updates the task list through the existing callback and keeps the drawer bound to the refreshed task record.
- Closing the drawer returns focus through the existing Drawer behavior.

The drawer never confirms a candidate or creates a revision; it is a read-only result inspection surface except for the existing explicit slot retry.

## Error And Compatibility Behavior

- Missing `libraryId`, non-project task sources, missing asset IDs, or failed asset reads show a preview-unavailable placeholder instead of failing the task page.
- Legacy single-candidate results and ordinary `assetIds` remain inspectable.
- Existing filtering, sorting, stopping, task retry, polling, and sticky-header behavior remain unchanged.

## Verification

- Component tests cover all known localized capability labels and unknown fallback.
- Component tests prove that no inline candidate details remain and that clicking the result summary opens the drawer.
- Drawer tests cover completed previews, loading failures, slot states, closing, and slot retry.
- Run focused tests, unit tests, type checking, lint, build, and `git diff --check`.
- Inspect the Electron model-task page for one-line rows, drawer layout, preview loading, and keyboard behavior.
