# M02 storage dependency record

Date: 2026-09-09. Scope: local workspace format, single-writer lock and later backup candidates.

| Capability | Candidate / evidence | Decision |
| --- | --- | --- |
| SQLite | `better-sqlite3` `13.0.3`, MIT, Node `>=22`; GitHub repository is active and not archived. The package ships platform-specific Node-API prebuilds, including darwin-arm64 and Windows x64/arm64. Local Node 22.19 loaded SQLite 3.53.4 successfully. | Adopt for M02 storage and OS-backed writer-lock tests. A macOS arm64 Electron source and packaged storage smoke loaded the module and created a real project; Windows remains a separate gate. |
| Schema parsing | Zod `4.5.4` was already version-researched in M01, but installation did not finish in this environment. | Do not add a stalled dependency. Task 1 uses a narrow explicit JSON field validator; reconsider Zod when broader persisted schemas arrive. |
| Workspace locking | `proper-lockfile` `4.1.2` is MIT and maintained, but its lock-directory/staleness design does not meet the plan's requirement for a real OS lock that is released by process death. `fs-ext` is native and old. | Use a dedicated SQLite database with an exclusive transaction held by the owning process. SQLite supplies the OS file lock; a child-process crash test must prove release. |
| Backup archive | `fflate` `0.8.3`, MIT, active and not archived; typed Node/browser exports. | Keep as a Task 4 candidate. Do not install before the backup format and streaming tests exist. |
| Native packaging | Forge already brings `@electron/rebuild` `3.7.2`; `4.2.0` was checked as the current direct tool. `better-sqlite3` 13 uses Node-API rather than a V8 ABI binding. Forge `plugin-auto-unpack-natives` `7.11.2` is registered to keep `.node` files outside ASAR. | The local Electron mirror produced a macOS arm64 app: main/package metadata and `better-sqlite3` JS were in `app.asar`, while native prebuilds were in `app.asar.unpacked`; the packaged storage smoke passed. The final validation-only source amendments were not repackaged after the approval policy rejected that rerun, and no Windows package is verified. |

Registry metadata and GitHub repository APIs were queried on 2026-09-09. Popularity or an available prebuild is not a product verification result.

## Task 1 format boundary

- A new workspace is a newly-created child directory under a user-selected parent. An existing child directory is never reused or overwritten.
- `designhub.workspace.json` is the minimal compatible manifest: kind, stable workspace ID, display name, positive integer format version and creation timestamp.
- `.designhub/writer-lock.sqlite` is implementation metadata. `projects/`, `shared-assets/` and `trash/` are visible domain containers.
- Paths locate a workspace; the manifest ID identifies it. Moving the whole directory must retain the same ID.
- A format newer than the application-supported version is parsed only through the known manifest and opened read-only. No unknown database is created or migrated.
