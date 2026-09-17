# Dark Warning Token Design

## Goal

Restore the visible fill and value colour for portfolio texture metrics in dark mode by defining the warning colour token they already consume.

## Root Cause

The portfolio texture metrics use `var(--warning)` for their percentage text and progress fill. The light theme defines this token, but the default dark theme does not. In dark mode the browser therefore discards those colour declarations, leaving the numeric value inherited and the progress fill transparent even though its percentage width is correct.

## Design

Add `--warning: #f6bd60` to the shared dark-theme token block covering both `:root` and `:root[data-theme='dark']`.

This warm amber:

- remains clearly visible on the existing `#0a0e17` and `#0f131c` dark surfaces;
- is distinct from the cyan primary, lavender secondary, green tertiary, and red error colours;
- provides a restrained material-analysis accent rather than an error signal;
- preserves the existing light-theme warning token `#f59e0b`.

No component or percentage calculation changes are required. Existing texture metric selectors continue to consume `var(--warning)`.

## Testing

Add a regression assertion that the dark-theme token source defines `--warning: #f6bd60`. Extend the focused browser coverage to confirm that a texture metric fill has a non-transparent computed background in dark mode and that its rendered width matches the supplied percentage within normal pixel rounding.

Run the focused unit and browser tests, typecheck, lint, production build, and `git diff --check` before completion.
