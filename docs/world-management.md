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

The checked-in API has 26 tests, the dashboard has 22 Node tests, and the bridge has 8 validation tests under Maven; Windows may skip symlink cases where symlink creation is unavailable. GitHub Actions also passes an isolated Paper/Multiverse workflow covering create, import/register, load/unload, archive/restore, guards, malformed restore metadata rejection, and restore rollback after a forced Multiverse configuration-save failure. The disposable runner is cleaned up after each run. No successful world lifecycle mutation has been exercised on the live server.

### Next implementation order

1. Verify actual Tailscale Serve login/session behavior and browser error/cancellation states; the CI browser uses a synthetic identity header.
2. Follow the setup guide from a clean clone and exercise backup restoration.
3. Keep operational changes on the live server behind a verified backup, idle-server check, and rollback plan.
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
