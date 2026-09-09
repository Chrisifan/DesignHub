# Versioned project format with safe upgrades

Workspaces and projects will declare their format versions. The application creates a local backup before a traceable forward migration and opens projects from a newer application version in read-only compatibility mode instead of attempting an unsafe downgrade.
