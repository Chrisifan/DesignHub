# New Design Designer Dossier

## Goal

Make the selected designer preview on the new-project page use the same complete dossier template as the designer review-and-publish step, and remove the horizontal divider above the page content.

## Design

`NewDesignPage` will render the existing `DesignerDossier` for the selected `PersonaProfile`. This keeps identity, avatar, metrics, Style DNA, negative rules, accessibility semantics, and application Tooltip behavior identical to review-and-publish without duplicating markup or styles.

The dossier will sit in a new-page-specific wrapper that owns column sizing and overflow. On wide screens it remains in the right column and may scroll with the page. Below the existing `1279px` breakpoint it moves below the form as a single column. The selected designer remains controlled by `draft.personaId`, so changing the selector updates the dossier immediately.

If the selected profile cannot be found, the page will omit the dossier rather than fabricate incomplete profile content. The selector continues to expose the available profiles.

## Visual Details

Remove the `border-top` from `.new-design-layout`. Do not add a replacement divider. Preserve the existing page padding and form spacing. The dossier uses its existing review styles unchanged; only the new-page wrapper receives minimum-width and padding rules needed for the two-column layout.

## Testing

Update the `NewDesignPage` unit tests to assert the shared dossier's accessible region, core metrics, Style DNA, and negative rules. Retain the persisted custom-profile image assertion. Add an end-to-end layout assertion that the new-design layout has no top border and does not overflow horizontally.
