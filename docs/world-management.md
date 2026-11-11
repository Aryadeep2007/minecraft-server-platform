# World management

This guide records the implemented lifecycle actions and the remaining planned work.

## Current implementation

The checked-in Paper bridge and dashboard support these world functions:

- List loaded Paper worlds with environment and online player count.
- List Multiverse metadata (name, alias, environment, loaded status) when Multiverse-Core is available.
- Read and update supported boolean/integer gamerules for a loaded world.
- Search/filter worlds in the dashboard and jump from a world row to its gamerule editor.
- Load an existing Multiverse-registered unloaded world.
- Unload an empty non-primary world; the bridge refuses worlds with players and the primary server world.
- Create a new world with a validated name, environment, world type, game mode, difficulty, and structure-generation setting.
- Import a ZIP world archive after traversal, link, duplicate-path, entry-count, expanded-size, and free-space validation.
- Archive/restore worlds by moving their directories to/from a same-filesystem recovery folder. Archived world data stays on the server and remains registered in Multiverse.

The FastAPI source, bridge, and dashboard were deployed to CT100 on 10 November 2026. Read-only smoke checks returned HTTP 200 for API health, bridge health, Paper world listing, Multiverse listing, and the dashboard. The API configuration remains environment-specific and is kept outside the repository.

World lifecycle requests require the authenticated API, exact typed-name confirmation, and the bridge bearer token. Names are restricted to safe single path-segment characters. No arbitrary command or path is accepted. Permanent deletion is not available; the archive is reversible but does not protect against full CT/disk failure.

## Verification status and remaining work

The checked-in API has 23 passing unit tests for identity/origin access control, request validation, archive path safety, registration links, and import behavior (one Windows symlink test may skip). The dashboard has 22 passing Node tests, and the bridge has 8 validation tests under Maven, including world-folder symlink checks (two may skip on Windows). The earlier 17-test Python suite passed on CT100's Linux runtime, including its symlink-registration test. No successful world lifecycle mutation has been exercised on the live server; create/import/load/unload/archive/restore need isolated integration coverage before routine use.

### Next implementation order

1. Add bridge integration tests against a disposable Paper/Multiverse test instance, including failure and rollback behavior.
2. Add dashboard/API contract tests for lifecycle actions and accessible progress/error states.
3. Document a repeatable deployment and rollback procedure for a clean installation.
4. Keep permanent deletion unavailable until off-host restore verification and retention behavior are demonstrated.

Implemented operation contracts:

| Operation | Proposed request | Safeguards |
|---|---|---|
| Load | `POST /worlds/load` with `name` and exact `confirmed_name` | Require an existing registered, unloaded world. |
| Unload | `POST /worlds/unload` with `name` and exact `confirmed_name` | Refuse worlds with players and the primary world; save before unload. |
| Create | `POST /worlds/create` with name, environment, world type, mode, difficulty, and structure flag | Validate all values and exact confirmation; reject duplicate folders. |
| Import | `POST /worlds/import` with ZIP request body and name/confirmation/environment headers | Reject unsafe paths, links, duplicate entries, ZIP bombs, oversized files, invalid world structure, and insufficient disk space; never overwrite. |
| Archive/restore | `POST /worlds/archive` or `/worlds/restore` with exact confirmation | Protect primary/occupied worlds; move files only within the configured world root; retain an in-place recovery copy. |

These routes are present in the deployed API, bridge, and dashboard. Read-only endpoints were smoke-tested after deployment; the mutating routes have not been exercised against live worlds.

### 4. Permanent deletion remains gated

Do not add permanent deletion until an off-host restore point can be verified automatically and the retention/restore story is tested. Archive/restore is reversible on the same filesystem, so it does not protect against host or storage failure.

## Security and operations

- Authenticate and authorize every state-changing operation at the management API.
- Keep the bridge loopback-only and use narrow bridge methods.
- Validate names against server/Multiverse state; never interpolate names into shell commands.
- Make timeouts, server-thread scheduling, error mapping, and post-operation state checks explicit.
- Preserve Minecraft data. Production deployment requires a verified recent backup, an idle-server check, a rollback copy, and post-deployment health checks.

## Acceptance criteria for future lifecycle work

- The API source is tracked and its contract is documented.
- Each operation has server-side validation and authorization.
- The bridge uses supported Paper/Multiverse APIs and never accepts arbitrary shell commands or unrestricted paths.
- The UI presents current state, progress, success, and actionable failure messages.
- Destructive safeguards have tests, and deployment/restore steps are reviewed before live use.
