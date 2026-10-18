# Immutable design revisions

> **Superseded for V1 by [ADR 0029](0029-project-canvas-v1-baseline.md).** Retained as historical context; V1 persists immutable `ProjectDesign` images, not revision history.

Every meaningful generation or edit will create an immutable design revision, and alternatives will be represented as branches from a shared revision. This makes agent actions reversible without overwrite prompts and gives exports and designer contributions an unambiguous source state.
