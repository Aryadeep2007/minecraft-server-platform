# Changelog

Notable project changes are recorded here. This changelog describes repository work and does not imply that local changes have been committed, released, or deployed.

The changes below are included in the public `main` checkpoint dated 11 November 2026. This is a development checkpoint, not a versioned software release.

## [Unreleased]

### Added

- Search and loaded/unloaded filters for the dashboard world overview.
- Per-world online player counts, loaded/unloaded totals, a world-scoped refresh action, and a shortcut to the existing gamerule editor.
- World-management design guide with explicit implementation status and safeguards for future lifecycle operations.
- Contribution and security policies, plus issue and pull-request templates.
- GitHub Actions workflows for API syntax and unit tests, all dashboard test files, and Paper bridge verification.
- Sanitized FastAPI source recovered from CT100, pinned dependencies, environment overrides, and a setup/security guide.
- Confirmed world load/unload/create actions in the bridge, API, and dashboard, with validation and API tests.
- Validated ZIP import and reversible world archive/restore workflows; permanent deletion remains gated.
- Added API unit tests for world lifecycle validation and secure ZIP extraction; CI runs them alongside dashboard tests and the bridge build.
- Aligned bridge/API world-name validation and reject existing-world registration when `level.dat` is a symlink.
- Added bridge-side JUnit tests for safe names, exact action confirmation, real world-folder structure, and symlink rejection; Maven `clean verify` runs them.
- Added API middleware tests for allowlisted identity, fail-closed allowlist handling, and same-origin write enforcement.
- Added dashboard tests for world-action cancellation/confirmation and error recovery, creation settings, ZIP size limits/import confirmation headers, registration, state-specific controls, archive filtering, and restore actions.
- Deployed the recovered API, redesigned dashboard, and rebuilt bridge to CT100 after verifying a fresh SSD backup, no online players, and rollback copies. Read-only health and world-list smoke checks passed.
- Deployed bridge archive/restore rollback hardening after a new CT100 SSD backup passed `zstd -t`; no online players were present, and bridge health/list endpoints returned HTTP 200 after Paper startup completed.
- Tightened bridge archive/import/restore path checks to require a non-symlink world directory and regular `level.dat`; deployed after a fresh SSD backup and verified bridge/API/dashboard read-only endpoints after restart.
- Deployed the repository-matching dashboard HTML and CSS to the active service after verifying zero players, service health, backup integrity, and rollback copies; live served-file hashes match the repository. The 22-test dashboard suite passes. Interactive browser login and production write actions remain unverified.
- Verified the deployed dashboard and world-list page render in headless Edge over the private connection; no browser write action was submitted.

### Changed

- Reworked README and hardware, Proxmox, Minecraft, and API/bridge documentation to distinguish checked-in code from dated deployment observations.
- Added an isolated Proxmox CT backup/restore walkthrough and troubleshooting guide with execution locations and expected checks.
- Added an integrated getting-started guide with ordered development/deployment steps, expected results, private proxy requirements, and an explicit clean-room verification boundary.
- Added ignore rules for local-only project memory, infrastructure notes, generated build output, and common secret/config files.

### Security and privacy

- Use no-follow filesystem checks when creating worlds so even a dangling symlink at the destination is treated as an existing path.
- Replaced private deployment and player identifiers in current public documentation with generic descriptions/placeholders. The approved history rewrite also removed the identified private IPv4 patterns from reachable `main` history.

### Not included yet

- A clean-clone integrated setup and live world-lifecycle integration tests.
- Permanent world deletion; reversible archive/restore is implemented instead.
- End-to-end tests against FastAPI, Paper, or a deployed environment.
