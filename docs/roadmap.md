# Project status and roadmap

**Last updated:** 11 November 2026

**Current checkpoint:** [`3a375f9`](https://github.com/Aryadeep2007/minecraft-server-platform/commit/3a375f9879e1d75fcc2f8c8b9e86a780d75eb9f7) on `main`

**CI:** [GitHub Actions run 42962762103 passed](https://github.com/Aryadeep2007/minecraft-server-platform/actions/runs/42962762103)

This page is the public summary of project progress and planned milestones. It excludes private deployment identifiers, access details, credentials, and player data. The separate [project handover](PROJECT_HANDOVER.md) contains dated technical context; verify dated infrastructure observations before relying on them.

## Current status

The repository contains a Paper management bridge, a FastAPI management API, a static web dashboard, automated component tests, CI, and setup/security/operations documentation. World management includes create, import/register, load/unload, and reversible archive/restore flows. Permanent deletion is intentionally unavailable.

The deployed services have passed read only health and world list checks. Automated tests and CI validate individual components, but do not prove that world mutations work safely against a running Paper server. The current server must not be treated as an integration test environment without a fresh resource review, recoverable backup, and explicit test plan.

## Completed checkpoints

| Checkpoint | Result |
|---|---|
| Platform foundation | Paper bridge, FastAPI API, dashboard, and integration documentation are in the repository. |
| World management | Create, import/register, load/unload, and reversible archive/restore operations are implemented across the bridge, API, and dashboard with validation and safety checks. |
| Component verification | 23 API tests, 22 dashboard tests, and 8 bridge tests passed in the published checkpoint; Windows may skip three symlink cases where symlink creation is unavailable. |
| Deployment safety | The latest recorded deployment used a verified backup and rollback copy, followed by read only health checks. No production world lifecycle mutation is recorded. These observations are dated; check live status before operational work. |
| Public repository foundation | Setup, security, backup/restore, troubleshooting, contributor guidance, changelog, and CI are published. The identified private IPv4 patterns were removed from reachable `main` history in an owner approved rewrite. |
| Publication checkpoint | Commit `3a375f9` is on `main`; its GitHub Actions CI run passed. |

## Next milestones

### 1. Verify world lifecycle in isolation

- Build a test harness around temporary world folders and a controlled Paper/Multiverse test server or suitable test doubles.
- Cover successful create, import/register, load/unload, archive, and restore flows.
- Cover failures and rollback behavior, including filesystem and Multiverse state consistency.
- Never use production worlds as fixtures. Define resource limits, cleanup, and a backup/rollback plan before using any real test server.

**Complete when:** lifecycle state transitions and failure recovery are demonstrated without touching production worlds.

### 2. Verify the authenticated browser workflow

- Exercise login/session behavior and the dashboard against a safe test environment.
- Check that rejected, canceled, and failed operations display clear outcomes.
- Verify at least one write action only against disposable test data after the isolated environment is ready.

**Complete when:** browser behavior, access control, and a disposable test mutation are verified end to end.

### 3. Prove clean installation and recovery

- Follow the setup guide from a clean clone on isolated hardware with adequate resources.
- Perform a backup restore exercise and record actual commands, expected outputs, and gaps.
- Update setup and recovery documentation from that run.

**Complete when:** a new installation and restore can be reproduced from the public instructions without relying on private notes.

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

## Out of scope until separately planned

- Permanent world deletion.
- Production world mutation as a substitute for isolated integration testing.
- Adding monitoring, Discord services, or other workloads before checking host resources.
- ISP, router, DNS, or tunnel changes without a requirements review and rollback plan.

## How to keep this roadmap current

After each meaningful checkpoint, update the status, evidence, and next milestone. Record commit links for repository changes and distinguish local tests, CI results, read only production observations, and isolated integration results. Do not publish secrets, private network details, player identities, or internal only inventory.
