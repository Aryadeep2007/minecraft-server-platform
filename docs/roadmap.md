# Project status and roadmap

**Last updated:** 11 November 2026

**Published branch:** [`main`](https://github.com/Aryadeep2007/minecraft-server-platform/tree/main)

**Latest verified code checkpoint:** [`b9d56f7`](https://github.com/Aryadeep2007/minecraft-server-platform/commit/b9d56f7); [isolated browser/Paper run 42989050341 passed](https://github.com/Aryadeep2007/minecraft-server-platform/actions/runs/42989050341); [CI run 42989050369 passed](https://github.com/Aryadeep2007/minecraft-server-platform/actions/runs/42989050369)

This page is the public summary of project progress and planned milestones. It excludes private deployment identifiers, access details, credentials, and player data. The separate [project handover](PROJECT_HANDOVER.md) contains dated technical context; verify dated infrastructure observations before relying on them.

## Current status

The repository contains a Paper management bridge, a FastAPI management API, a static web dashboard, automated component tests, CI, and setup/security/operations documentation. World management includes create, import/register, load/unload, and reversible archive/restore flows. Permanent deletion is intentionally unavailable.

The dashboard's three served assets match the repository. The 22 dashboard unit tests pass. A private Chrome session loaded live API, Paper, world, and player status without a write. Chromium CI also completed an authenticated dashboard create/list/unload/archive flow against disposable Paper; its allowlisted identity was synthetic, so Tailscale login renewal/expiry remains untested. No world lifecycle write has been submitted to the production server. The latest SSD backup was restored to a temporary stopped, disconnected CT, inspected read-only, and the temporary CT removed; the source backup and running CT100 were preserved. A full clean installation and off-host backup recovery remain unverified.

## Completed checkpoints

| Checkpoint | Result |
|---|---|
| Platform foundation | Paper bridge, FastAPI API, dashboard, and integration documentation are in the repository. |
| World management | Create, import/register, load/unload, and reversible archive/restore operations are implemented across the bridge, API, and dashboard with validation and safety checks. |
| Component verification | 26 API tests, 22 dashboard tests, and 8 bridge tests passed in the published checkpoint; Windows may skip three symlink cases where symlink creation is unavailable. |
| Deployment safety | The latest recorded deployment used a verified backup and rollback copy, followed by read only health checks. No production world lifecycle mutation is recorded. These observations are dated; check live status before operational work. |
| Public repository foundation | Setup, security, backup/restore, troubleshooting, contributor guidance, changelog, and CI are published. The identified private IPv4 patterns were removed from reachable `main` history in an owner approved rewrite. |
| Publication checkpoint | Project status and milestone roadmap are published on `main`; GitHub Actions CI passed for code checkpoint `b9d56f7`. |
| Dashboard deployment | Deployed HTML/CSS now match the repository; JavaScript already matched. Live served-file hashes and active services were verified. Rollback copies are available. |
| Isolated dashboard write path | ASGI tests send authenticated same-origin create/load/unload/archive/restore requests through FastAPI to a mocked bridge and verify cross-origin rejection. No Paper world is created. API suite now has 26 tests. |

## Next milestones

### 1. Verify world lifecycle in isolation

- [x] Add a GitHub-hosted integration workflow that builds the bridge, verifies official Paper and pinned Multiverse artifacts, and starts a disposable Paper 1.21.11 server with Multiverse 5.5.3.
- [x] Get a successful first integration run: GitHub Actions run `42977978430` passed with Paper 1.21.11 and Multiverse-Core 5.5.3.
- [x] Cover successful create, load/unload, archive, and restore flows on disposable worlds.
- [x] Cover primary-world archive rejection, missing-world load rejection, and confirmation mismatch.
- [x] Import/register a copied disposable world and verify malformed restore metadata is rejected without moving the archive. GitHub Actions run `42979533877` passed.
- [x] Force a Multiverse config save failure during restore; verify the world returns to the archive with metadata intact, then restore it successfully on retry. GitHub Actions run `42980370443` passed.
- [x] Verify filesystem and Multiverse state consistency across covered lifecycle failure paths in the disposable CI server.
- Never use production worlds as fixtures. Define resource limits, cleanup, and a backup/rollback plan before using any real test server.

**Complete:** covered lifecycle state transitions, import/register, malformed metadata rejection, and restore rollback/retry are demonstrated on disposable worlds. This does not validate production mutations.

### 2. Verify the authenticated browser workflow

- [x] Run Chromium against the same-origin dashboard and FastAPI API attached to disposable Paper/Multiverse; create a world, verify the UI and world list, then unload/archive it. GitHub Actions run [`42989050341`](https://github.com/Aryadeep2007/minecraft-server-platform/actions/runs/42989050341) passed.
- [x] Confirm the isolated API rejects requests without an allowlisted identity header. CI uses a synthetic identity on the local runner; it does not test the real proxy login.
- [x] Verify the existing authenticated Chrome session loads the private dashboard and reads live API, Paper, world, and player status; no production write was submitted.
- [ ] Verify Tailscale Serve login renewal/expiry behavior in an interactive browser.
- [ ] Check rejected, canceled, and failed operations in the interactive browser and confirm the dashboard displays clear outcomes.
- ASGI tests still cover API writes through a mocked bridge; the hosted browser smoke now exercises a disposable Paper-backed write end to end.

**Complete when:** browser behavior, access control, and a disposable test mutation are verified end to end.

### 3. Prove clean installation and recovery

- [x] Clone `main` into a fresh Windows temp directory, install the API requirements, and run the API suite (26 tests; one symlink skip) and dashboard suite (22 tests). The clean clone did not have Maven installed; GitHub CI independently built and verified the Java bridge from a clean runner.
- [x] Verify the latest SSD backup archive, restore it to a temporary stopped CT, remove its network interface, inspect its filesystem read-only, then remove the temporary CT. The source archive remained present and CT100 remained running. See the [recorded restore exercise](backup-and-restore.md).
- [ ] Follow the full setup guide from a clean clone on isolated hardware, including service configuration and private proxy setup. A complete clean installation has not been reproduced.
- [x] Record the restore procedure and observed limits in the backup guide.

**Complete when:** a new installation and restore can both be reproduced from the public instructions without relying on private notes. Restore file recovery is verified; clean installation remains outstanding.

### 4. Add off host backup recovery

- Compare storage capacity, bandwidth, encryption, retention, and recovery time for an off host destination.
- Choose a destination and define access controls and a restore procedure before enabling replication.
- Verify an off host copy and test a restore before relying on it.

**Complete when:** a verified backup exists outside the server host and a restore has been exercised.

### 5. Plan Discord integration

- Decide whether the first scope is status/backup notifications, player-facing announcements, or administrator commands.
- Define bot permissions, secret handling, command authorization, rate limits, and behavior when Discord or the server is unavailable.
- Estimate memory and CPU use before adding another service to the host.
- Implement only after the scope and resource plan are reviewed.

**Complete when:** a least privilege integration is tested in a nonproduction environment, documented, and has a disable/rollback procedure.

### 6. Assess ISP and router migration

- Record the current service requirements without publishing private addresses or account details.
- Compare candidate plans for upload bandwidth, latency, public reachability, CGNAT, data caps, reliability, and cost.
- Plan DNS/tunnel changes, maintenance timing, and rollback before changing the live network.

**Complete when:** a tested migration plan preserves private administration and provides a verified rollback path. No ISP or router change is currently scheduled.

### 7. Finish release presentation and ownership decisions

- Choose the repository license/copyright terms before adding a license file.
- Add a privacy reviewed dashboard screenshot or keep the existing placeholder.
- Review the repository description, topics, homepage, and social preview before changing GitHub settings.

**Complete when:** ownership terms and presentation choices are decided and all public claims match verified behavior.

### 8. Maintain the CI toolchain

- Review the GitHub Actions warnings from run `42990560854` about the runner image migration and JavaScript action runtime deprecation.
- Update pinned action versions when compatible releases are available, then confirm all CI jobs pass.

**Complete when:** the workflow uses supported action runtimes and runner images without deprecation warnings.

## Out of scope until separately planned

- Permanent world deletion.
- Production world mutation as a substitute for isolated integration testing.
- Adding monitoring, Discord services, or other workloads before checking host resources.
- ISP, router, DNS, or tunnel changes without a requirements review and rollback plan.

## How to keep this roadmap current

After each meaningful checkpoint, update the status, evidence, and next milestone. Record commit links for repository changes and distinguish local tests, CI results, read only production observations, and isolated integration results. Do not publish secrets, private network details, player identities, or internal only inventory.
