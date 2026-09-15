# Installation and Upgrade Notes

DesignHub is distributed as an Electron package produced by Electron Forge. The current repository provides build/package scripts but no signed release artifact.

## First launch

1. Install the platform package from a trusted local path.
2. Launch the app and create or open a workspace directory.
3. Confirm the workspace is writable before creating projects.
4. Configure provider credentials only through the desktop connection settings; credentials are never imported from a project or package.

## Upgrade and uninstall

Before an upgrade, keep a verified workspace backup. Upgrades must preserve workspace data and migrate only documented format versions. Uninstall must not delete user-selected workspace directories or backups.

The manual installer gate is intentionally explicit and never runs in the default test suite. On a real macOS or Windows host, record the observed result in a local JSON marker (do not commit credentials or user paths):

```json
{"installed":true,"upgraded":true,"uninstalled":true,"workspaceRetained":true}
```

Then run:

```bash
DESIGNHUB_INSTALL_SMOKE=1 \
DESIGNHUB_INSTALL_UPGRADE_MARKER=/absolute/path/install-evidence.json \
pnpm test:install-upgrade
```

The command returns `blocked` until both the opt-in flag and marker are supplied, and returns `failed` if any of the four observations is false.

## Release prerequisites

Signed macOS/Windows packages, native keychain verification, installer upgrade tests, and platform-specific permissions are still required before public distribution. Debug-only Playwright settings must not be carried into production packages.
