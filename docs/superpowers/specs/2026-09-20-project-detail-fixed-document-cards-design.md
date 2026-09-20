# Project Detail Fixed Document Cards Design

## Goal

Prevent project-detail document cards from stretching across the full document-list width when only a few designs exist.

## Layout

- Keep the existing horizontal document-card composition: preview on the left, document information on the right.
- Use a fixed desktop card width of `360px`.
- Lay cards out from left to right and wrap onto additional rows when space runs out.
- Keep the grid left-aligned so an incomplete row does not spread or stretch.
- Preserve the existing `16px` gap between cards.
- At narrow viewport widths, allow each card to shrink to the available container width, with the existing mobile card breakpoints unchanged.

## Scope

- Change only the project-detail document grid sizing and its layout contract test.
- Do not change project data, document opening behavior, previews, statuses, or the surrounding project-detail information hierarchy.

## Verification

- The integration layout contract must require a fixed `360px` grid column and left alignment.
- Project-detail component tests must continue to pass.
- Type checking, linting, and production build must remain green.
