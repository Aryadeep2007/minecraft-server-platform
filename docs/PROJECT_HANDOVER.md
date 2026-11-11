# MASTER PROJECT HANDOVER — SELF-HOSTED MINECRAFT SERVER & MANAGEMENT PLATFORM


## Current public checkpoint — 11 November 2026

The current repository branch is `main`; the project status and milestones are published in the [public project roadmap](roadmap.md). The history rewrite was approved by the owner, the worktree was clean after publication, and GitHub Actions CI passed for the published documentation checkpoint. See the roadmap for the latest checkpoint and CI run.

The repository includes the sanitized management API, Paper bridge, dashboard, documentation, and automated checks. On 11 November the deployed dashboard HTML/CSS were reconciled with the repository; live served-file hashes match, services remain active, and timestamped rollback copies were retained. The 22 mocked dashboard tests pass. Headless Edge loaded the live dashboard and world-list page over the private connection. The new isolated GitHub Actions run `42977978430` passed create/load/unload/archive/restore and safety-guard checks against disposable Paper 1.21.11 + Multiverse 5.5.3; its runner was discarded after cleanup. Import/register and injected rollback-failure coverage, plus an interactive authenticated browser action, remain outstanding. No private hostnames, addresses, credentials, or player identifiers belong in this handover.

The detailed 11 November notes below were written before the publication checkpoint and are historical where they conflict with the current checkpoint. Older dated sections are historical records, not current infrastructure status.

## Codex status update — 11 November 2026

The repository contains the sanitized FastAPI source under `management-api/`, world lifecycle controls in the API, Paper bridge, and dashboard, Python API tests, contributor/security documents, and CI configuration. On 10 November 2026, the API, dashboard, and rebuilt bridge were deployed after a fresh SSD stored CT backup, a zero player check, and rollback copies. A later hotfix briefly exposed an incomplete file deployment; the complete tracked API package was synchronized and the service recovered. Read only health, bridge, world list, Multiverse list, and dashboard requests returned HTTP 200; no world lifecycle mutation was performed against live worlds. These are dated deployment observations, not a current availability guarantee. The private dashboard origin and credentials remain outside the repository. At the time this checkpoint was written, local project changes were uncommitted. The newer checkpoint above supersedes this paragraph where they conflict.

The archive safety review moved filesystem destination checks before the bridge unloads a world, cleans up partial archive metadata, and restores Multiverse autoload state when a restore configuration save fails. It now also requires archive/import/restore folders to be real directories containing a regular `level.dat`. The bridge has eight JUnit validation tests; two symlink cases skip on Windows when symlink creation is unavailable. Maven 3.10.0 was checksum-verified from Apache and `clean verify` passed. On 11 November, a fresh CT100 backup on the SSD passed `zstd -t`, the online-player query returned zero, and the prior bridge JAR was saved for rollback. The new JAR was atomically installed and Paper restarted; its hash matches the local build. Post-restart bridge health/world-list and authenticated API/dashboard checks returned HTTP 200. Minecraft and management API services are active. No world archive, import, load, or unload operation was run against live worlds. Isolated lifecycle integration tests remain outstanding.

The dashboard test suite now checks mocked cancellation/confirmation, create settings, ZIP limits and headers, registration, state-specific row controls, archive filtering, restore actions, and failure recovery (22 Node tests total). The API suite now includes six middleware tests for allowlist identity, fail-closed access, and same-origin writes, bringing its total to 23; these use temporary test allowlists. CI and setup/contributor instructions run the full dashboard test glob and API unittest discovery. A live read-only API/dashboard smoke used the identity already held in CT100's restricted allowlist file without printing it; `/health`, `/bridge/health`, both world-list routes, `/dashboard/`, and `/dashboard/app.js` all returned HTTP 200. At that earlier checkpoint, a real browser login and UI workflow had not been verified.

On 11 November, the saved `proxmox` SSH alias authenticated from the current Windows session and completed a read-only `true` command. No host status or configuration command was run in that check. The browser check opened the private dashboard origin without recording it here: the root returned the API's online status, and `/dashboard/` rendered the Minecraft Control Center. After its initial refresh, the page showed the API connected, Paper online on Minecraft 1.21.11, four worlds, and zero online players. This verifies a live browser render and read-only data flow; no explicit login, form submission, or world/player mutation was tested. No lifecycle operation was performed.

A current-worktree privacy scan found no private IPv4 addresses, MAC addresses, Tailscale hostnames, or private-key markers in non-ignored text files. Its only credential-pattern match is the code that reads the `management-server-secret` property from local server configuration; no secret value is present in the repository.

Static review found that world creation checked its destination with `File.exists()`, which follows links and can miss a dangling symlink. The local bridge now checks with `Files.exists(..., NOFOLLOW_LINKS)`, and the unreleased changelog records the hardening. Maven 3.10.0 was downloaded to a temporary directory from Apache's official distribution and its published SHA-512 checksum verified; `mvn -DskipTests compile` succeeded, compiling both main Java sources. Tests were skipped. This source change has not been deployed.


## Codex review addendum — 30 October 2026

The local repository inspection confirmed the checkpoint listed above, but did not fetch the remote. The tracked checkout contains the static dashboard and Paper bridge; it does not contain the FastAPI backend source described elsewhere in these notes. Treat backend and deployment statements below as owner-provided historical context until the implementation or live system is inspected. An SSH connection attempt reached the historical Proxmox SSH service but authentication failed before any remote command ran. The SSD, CT100, current backups, and current network state have not been inspected. Actual IP/MAC/SSH/tunnel identifiers and personal locality details have been removed from this public-safe copy and retained in the ignored local infrastructure note.


- **Project owner:** Project owner
- **Project type:** Personal engineering, self-hosting, infrastructure and software-development portfolio
- **Primary agent:** OpenAI Codex on Windows
- **Repository:** https://github.com/Aryadeep2007/minecraft-server-platform
- **Local repository:** `D:\mine_project\minecraft-server-platform`
- **Primary branch:** `main`
- **Current checkpoint:** 30 October 2026

---

# 1. YOUR ROLE AND PRIMARY OBJECTIVE

You are taking over an existing, actively developed self-hosted Minecraft Server Platform project.

You must continue from the existing implementation and project history. Do not rebuild everything from scratch, discard existing work, or make assumptions about the infrastructure.

Act as a combined:

- Senior software engineer
- DevOps and infrastructure engineer
- Proxmox administrator
- Linux administrator
- Java/Paper plugin developer
- Python/FastAPI developer
- Frontend developer
- Network and security engineer
- Technical documentation engineer
- Git/GitHub project maintainer

The project owner is a first-year engineering student who is learning through this project. Explain important decisions clearly and do not hide risks.

## Required working methodology

Follow this workflow:

1. Inspect the existing state.
2. Understand the architecture.
3. Prepare a plan.
4. Explain the proposed changes.
5. Obtain approval for risky operations.
6. Implement one logical step at a time.
7. Verify the result.
8. Test functionality.
9. Update documentation.
10. Commit changes.
11. Push only after approval.
12. Create a checkpoint describing exactly what changed.

**Very important user preferences:**

- Work one step at a time.
- Give exact commands and specify where they must run.
- Inspect before changing anything.
- Never perform random tuning.
- Do not repeat already completed work unnecessarily.
- Do not assume that a command succeeded without checking its output.
- Automatically execute safe, read-only operations when possible.
- Ask before destructive, security-sensitive, infrastructure-changing, or remote operations.
- Preserve rollback options.
- Never expose passwords, tokens, private keys or other secrets.
- Keep the project reproducible and professionally documented.

When a task is large, break it into small checkpoints.

---

# 2. PROJECT VISION

The project is a self-hosted Minecraft Server and Management Platform running on personal hardware using Proxmox VE.

The goal is to build a professional, documented infrastructure project that demonstrates:

- Linux system administration
- Proxmox virtualization and container management
- Minecraft Paper server administration
- Java plugin development
- Python backend development
- Web dashboard development
- REST API design
- Authentication and authorization
- Network engineering
- Remote administration
- Backup and recovery
- Monitoring
- Automation
- Git and GitHub workflows
- Technical documentation

The repository should allow another person to understand the architecture and independently build a similar system using their own hardware, network, and configuration.

## Important intellectual-property preference

The project owner does NOT want to grant other people permission to modify, redistribute, or publish derivative versions of the project's code.

The desired public-repository model is:

- Repository publicly viewable.
- Documentation available to everyone.
- People can follow the instructions to build their own independent setup.
- No automatic permission to reuse, modify, or redistribute the project's source code.
- Copyright remains with the project owner.

Do not select MIT, Apache-2.0, GPL, or another permissive/open-source license without explicit approval.

Recommended initial approach:

- All-rights-reserved copyright notice.
- A clear `LICENSE` or `COPYRIGHT` file describing the restrictions.
- A README section explaining permitted viewing and prohibited reuse.
- Contribution policy consistent with the owner's licensing decision.

Do not claim that a public GitHub repository can prevent all copying or forking. If stronger access restrictions become necessary, explain the implications of making the repository private.

---

# 3. GITHUB REPOSITORY

Repository:

`https://github.com/Aryadeep2007/minecraft-server-platform`

Local checkout:

`D:\mine_project\minecraft-server-platform`

Branch:

`main`

## Last verified local Git checkpoint

As of the 30 October 2026 assessment:

- Local branch: `main`
- Working tree: clean
- Local HEAD: `438cb3fba713e54f63bc9a2472d74dd02a7a39d7`
- Local `origin/main` tracking ref: same commit
- Commit message: `test: add player moderation payload tests`

Important: The previous assessment did not fetch GitHub. Therefore, the actual current remote branch state has not been verified. Fetch and inspect before making changes.

## Existing repository contents

The local checkout contains:

- `README.md`
- Four documentation files
- `paper-management-bridge/` Maven Java project
- `web-dashboard/` static HTML, CSS and JavaScript
- `web-dashboard/tests/player-moderation.test.cjs`

The project has no root-level `package.json`.

The previous assessment identified missing or untracked project components:

- FastAPI backend source code
- Python dependency/project configuration
- CI workflow
- Root `.gitignore`
- License/copyright policy
- Contribution policy
- Security policy
- Changelog
- GitHub issue templates
- GitHub pull-request template

Do not immediately create all these files. First inspect the repository and determine what is still missing.

## Previous GitHub assessment

The repository was confirmed publicly accessible, with default branch `main`.

The previous inspection found:

- README has literal escape characters and appears incomplete.
- Some README claims do not match the actual implementation.
- Architecture and access documentation are inconsistent.
- Backend implementation is not present in the tracked checkout.
- Some documentation may contain private infrastructure identifiers and personal/player information.
- No full Git-history secret/privacy audit has been completed.

## Proposed repository description

A self-hosted Minecraft server management project with a Paper bridge and web dashboard.

Suggested GitHub topics:

- `minecraft`
- `paper`
- `proxmox`
- `lxc`
- `server-management`
- `java`
- `web-dashboard`

These are suggestions, not completed GitHub changes.

## Repository redesign objectives

Make the repository look like a professional engineering portfolio.

Inspect and improve:

1. README structure and presentation.
2. Project overview.
3. Architecture diagrams.
4. Hardware requirements.
5. Installation documentation.
6. Proxmox setup instructions.
7. LXC setup instructions.
8. Minecraft server setup.
9. Plugin installation and configuration.
10. Management API documentation.
11. Dashboard documentation.
12. Network and remote-access documentation.
13. Backup and recovery documentation.
14. Troubleshooting.
15. Security documentation.
16. Screenshots and demonstrations.
17. Changelog and release management.

Documentation must describe the actual implementation, not planned features as if they already exist.

Use placeholders for private network information in public documentation.

---

# 4. PHYSICAL SERVER HARDWARE

The Minecraft server runs on an older desktop PC.

Historical hardware information:

| Component | Specification |
|---|---|
| CPU | Intel Core i3-9100F |
| CPU cores | 4 cores / 4 threads |
| CPU frequency | 3.60 GHz |
| Motherboard | Gigabyte H310M S2 2.0 |
| RAM | 4 GB DDR4-2400, one stick |
| GPU | NVIDIA GT 710 2 GB |
| Existing HDD | Toshiba HDWD110, 1 TB SATA |
| PSU | iBall ZPS-281 |
| Additional drive | Newly installed 256 GB 2.5-inch SATA SSD |

Motherboard details previously identified:

- Two DDR4 RAM slots.
- One free RAM slot at the time of inspection.
- One free PCIe slot.
- Three free SATA ports.
- No NVMe slot.

The machine was previously running Windows 10 Pro before Proxmox installation.

**Important hardware constraint:** The server has only 4 GB of RAM. Do not increase container memory allocations or Minecraft heap sizes without evaluating actual memory pressure.

---

# 5. NEW 256 GB SATA SSD — CURRENT PRIORITY

A new 256 GB 2.5-inch SATA SSD has physically been installed in the Proxmox server.

As of 30 October 2026:

- The Proxmox server is powered on.
- The SSD has not been configured.
- The owner does not yet know whether the SSD is detected or healthy.
- The SSD model and serial number are unknown.
- Its final purpose has not been selected.

## First task: READ-ONLY SSD inspection

Connect to Proxmox and inspect:

- `lsblk`
- `/dev/disk/by-id/`
- Disk model, capacity and serial number.
- SATA device detection.
- Kernel storage messages.
- Existing partitions.
- Filesystem signatures.
- Mountpoints.
- SMART health, if available.
- LVM physical volumes.
- Volume groups.
- Logical volumes.
- Proxmox storage configuration.
- Current storage usage.
- Backup availability.
- CT100 status.

Identify the new SSD by model, capacity and stable device identity.

Do not assume `/dev/sda`, `/dev/sdb`, or another device name identifies the new SSD.

Distinguish the existing 1 TB Toshiba HDD from the new SSD.

## Strict SSD safety policy

Until the owner explicitly approves a specific operation:

- Do not format the SSD.
- Do not initialize it.
- Do not partition it.
- Do not wipe it.
- Do not overwrite it.
- Do not create filesystems.
- Do not mount it.
- Do not edit `/etc/fstab`.
- Do not change LVM.
- Do not edit Proxmox `storage.cfg`.
- Do not migrate the operating system.
- Do not migrate containers.
- Do not change boot configuration.
- Do not allocate existing storage to it.

After discovery, explain the possible SSD roles and recommend an appropriate one based on the actual hardware and workload.

Possible roles to evaluate:

- Dedicated Proxmox VM/LXC storage.
- Minecraft-related workload storage.
- Other appropriate storage use.

Do not decide before examining the actual disk and current storage layout.

## SSD implementation workflow

After inspection:

1. Present the disk identity and SMART results.
2. Present the existing storage layout.
3. Explain the recommended SSD role.
4. Explain the benefits and disadvantages.
5. Explain the exact changes required.
6. Explain backup and rollback.
7. Obtain explicit approval.
8. Configure only the approved target.
9. Verify the resulting storage.
10. Test that Proxmox and CT100 still work.
11. Document the new layout.
12. Create a Git checkpoint if repository documentation changes.

Keep the SSD work separate from the repository redesign.

---

# 6. PROXMOX VE HOST

Historical Proxmox configuration:

| Property | Value |
|---|---|
| Hostname | `pve` |
| Proxmox VE version | 9.2.x |
| More specific historical version | 9.2.11 |
| OS | Debian 13 Trixie |
| Kernel | `7.0.14-15-pve` |
| Architecture | x86_64 |
| Management IP | `YOUR_IP_ADDRESS` |
| Gateway | `YOUR_IP_ADDRESS` |
| Network bridge | `vmbr0` |
| Physical NIC name | `nic0` |
| Web interface | `https://YOUR_IP_ADDRESS:8006` |
| SSH user | `root` |
| Historical SSH command | `ssh YOUR_LINUX_ADMIN_USER@YOUR_HOST` |

The version and network information are historical and must be checked before making changes.

## Proxmox storage

Previously reported:

- Root filesystem approximately 96 GB.
- Swap approximately 4 GB.
- Data storage approximately 797.7 GB.
- Existing 1 TB Toshiba SATA HDD.
- Proxmox storage names: `local` and `local-lvm`.

Verify the current configuration before relying on these figures.

## Proxmox firewall

Historically:

- Proxmox firewall enabled.
- Management subnet: `YOUR_IP_ADDRESS`.
- TCP port 22 allowed.
- TCP port 8006 allowed.

Do not weaken firewall rules during routine work.

## Proxmox SSH access

Historical command:

`ssh YOUR_LINUX_ADMIN_USER@YOUR_HOST`

The owner has the SSH authentication credentials.

Never request or write passwords into GitHub documentation, source files, logs, or Codex prompts.

If SSH is unavailable, diagnose connectivity and authentication safely.

Do not enable root SSH or weaken authentication without explicit approval.

---

# 7. LXC CONTAINER — CT100

The main Minecraft server runs inside an LXC container.

Historical configuration:

| Property | Value |
|---|---|
| Container ID | `100` |
| Hostname | `minecraft` |
| OS | Debian 13 Trixie |
| CPU allocation | 2 cores |
| Memory allocation | 2 GB |
| Root disk | 40 GB |
| Storage | `local-lvm` |
| IP address | `YOUR_IP_ADDRESS` |
| Gateway | `YOUR_IP_ADDRESS` |
| Main user | `minecraft` |
| Minecraft directory | `/opt/minecraft` |
| Start at boot | Enabled |
| Startup order | 1 |
| Startup delay | 30 seconds |

Historical CT100 MAC address:

`YOUR_DEVICE_MAC_ADDRESS`

This is the last known MAC address. Verify the live container configuration before using it for DHCP reservations or network changes.

## LXC SSH access

Historical SSH command:

`ssh YOUR_LINUX_ADMIN_USER@YOUR_HOST`

The container also has the Linux user:

`minecraft`

Do not assume root SSH is currently enabled or that the container is reachable at the historical address.

The owner has the authentication credentials.

Never store authentication secrets in the repository.

## Container management

From the Proxmox host, use Proxmox's normal LXC management tools, such as:

- `pct status 100`
- `pct config 100`
- `pct enter 100`
- `pct exec 100 -- <command>`

Use these for appropriate administration after checking the target and operation.

Do not modify the container configuration or disk allocation without approval.

---

# 8. MINECRAFT SERVER

The Minecraft server runs Paper.

Historical configuration:

| Property | Value |
|---|---|
| Server software | Paper |
| Version | 1.21.11 |
| Build | 132 |
| Java | OpenJDK 21 |
| Service | `minecraft.service` |
| Server directory | `/opt/minecraft` |
| Heap minimum | 1 GB |
| Heap maximum | 1 GB |

Historical Java arguments:

`-Xms1G -Xmx1G`

The server runs as the `minecraft` Linux user.

## Server access

Historical LAN Java address:

`YOUR_IP_ADDRESS:25565`

Historical LAN Bedrock address:

`YOUR_IP_ADDRESS:19132`

These addresses may change after the ISP/router migration.

## Minecraft configuration

Historical settings:

- `online-mode=false`
- Whitelist enabled.
- Whitelist enforcement enabled.

The offline-mode configuration is used for the Java and Bedrock integration with Floodgate.

Treat this as a security-sensitive configuration. Never expose the Minecraft server directly to the internet without understanding the authentication and proxy implications.

Do not change authentication settings without approval and a clear migration plan.

---

# 9. INSTALLED MINECRAFT PLUGINS

Historically installed plugins:

| Plugin | Purpose |
|---|---|
| CoreProtect 23.2 | Block logging and rollback |
| EssentialsX 2.22.0 | Server administration and utilities |
| Geyser 2.11.3-SNAPSHOT | Bedrock-to-Java connectivity |
| Floodgate 2.2.5-SNAPSHOT | Bedrock player authentication integration |
| ViaVersion 5.11.0 | Client protocol compatibility |
| Multiverse-Core 5.5.3 | Multiple-world management |
| PaperManagementBridge 0.1.0-SNAPSHOT | Custom management API bridge |

A previous update notice indicated ViaVersion 5.12.1 was available. Check current versions before upgrading.

Do not update plugins blindly. Check compatibility and preserve rollback options.

---

# 10. GEYSER AND FLOODGATE

The server supports Java and Bedrock players.

Historical Geyser configuration:

- Bedrock UDP port: `19132`
- Broadcast port: `18029`
- `use-haproxy-protocol: false`

Enabling HAProxy protocol previously broke LAN Bedrock connectivity. Keep it disabled unless a future proxy design specifically requires it and has been tested.

Historical local Bedrock access:

`YOUR_IP_ADDRESS:19132`

Historical local Java access:

`YOUR_IP_ADDRESS:25565`

The owner wants both Java and Bedrock connectivity to continue working after the ISP migration.

---

# 11. REMOTE CONNECTIVITY AND TUNNELS

The project historically uses Tailscale and Playit.

## Tailscale

Historical Minecraft server Tailscale IP:

`YOUR_IP_ADDRESS`

Historical Java connection:

`YOUR_IP_ADDRESS:25565`

Historical dashboard hostname:

`https://YOUR_TAILSCALE_HOSTNAME/`

Tailscale is also used for remote administration and access to management services.

Do not assume these values remain current. Check the live Tailscale status and device identity.

Do not expose Tailscale authentication keys.

## Playit

Historical Bedrock tunnel:

`YOUR_PLAYIT_HOSTNAME:18029`

Historical forwarding target:

`127.0.0.1:19132`

Proxy Protocol:

`None`

This tunnel was used to expose Bedrock access without configuring direct router port forwarding.

Verify its current status and configuration.

## Security preference

Prefer:

- Tailscale for remote SSH.
- Tailscale for management dashboard access.
- Tailscale for Java access where appropriate.
- Playit for Bedrock access where appropriate.

Avoid unnecessary public port forwarding.

Never expose the Proxmox management interface directly to the public internet.

---

# 12. PAPER MANAGEMENT BRIDGE

Custom Java Paper plugin:

`PaperManagementBridge`

Historical JAR:

`paper-management-bridge-0.1.0-SNAPSHOT.jar`

Historical deployed path:

`/opt/minecraft/plugins/PaperManagementBridge.jar`

The bridge exposes management functionality to the Python backend.

Historical design:

- HTTP server binds to loopback.
- Uses a bearer token.
- Token is read from a configured file path.
- Provides health information.
- Provides world and Multiverse information.
- Supports gamerule reads and writes.
- Supports per-world gamerule operations.

The bridge must not be exposed directly to the public internet.

Do not put its bearer token into source code, documentation, Git history, screenshots, or Codex output.

## Gamerule management

Previously implemented and verified:

- Global gamerule interface.
- Per-world gamerule interface.
- `keepInventory` successfully changed to true and false.
- `randomTickSpeed` verified at 3.
- A previous bug involving `/worlds/gamerules?world=creative` returning 503 was fixed and tested.

The current implementation must be inspected before further modifications.

---

# 13. PYTHON MANAGEMENT API

Historical API:

- Framework: FastAPI.
- Service: `minecraft-management.service`.
- Bind address: `127.0.0.1`.
- Port: `8000`.
- Remote access through Tailscale Serve.
- Historical dashboard URL: `https://YOUR_TAILSCALE_HOSTNAME/`.

Authentication:

- Uses the `Tailscale-User-Login` request header.
- Has an allowlist.
- Requires authenticated Tailscale identity.
- `/health` previously returned HTTP 200.
- A request without identity previously returned HTTP 403.

## Important repository problem

The previous Codex audit found that the FastAPI backend source was not present in the tracked local repository.

The documentation describes backend routes and behavior, but the actual implementation was missing from the checkout.

This is a major reproducibility issue.

Investigate:

1. Whether backend code exists on the Proxmox server.
2. Whether it exists in another local directory.
3. Whether it exists in another Git branch or remote commit.
4. Whether it was accidentally omitted from Git.
5. Whether it contains secrets that must be removed before committing.

Do not invent a replacement backend before investigating the deployed implementation.

If the backend is missing from Git, recover and document the actual implementation safely.

Never commit secrets.

---

# 14. WEB MANAGEMENT DASHBOARD

Historical deployment directory:

`/opt/minecraft-management/web-dashboard`

Ownership:

`root:root`

Main files:

- `index.html`
- `styles.css`
- `app.js`

The dashboard is a static frontend.

It communicates with the FastAPI management API.

## Existing dashboard functionality

Previously implemented or present in the code:

- Server status information.
- Player management.
- Whitelist management.
- Operator management.
- Player moderation.
- World listing and information.
- Global gamerule management.
- Per-world gamerule management.

Inspect the actual current code before claiming any feature is operational.

## Player management implementation

Previous implementation added:

- Sidebar navigation for Players.
- A new section with ID `player-management`.
- `player-management-message`.
- `refresh-players-button`.
- `online-players-list`.
- `online-players-tag`.
- Whitelist-related UI.
- Operator-related UI.

The old metric card with ID `players` remained in the HTML.

Historical deployment backups included:

- `web-dashboard.rollback-pre-gamerule-ui-20261010-004430`
- `web-dashboard.rollback-player-management-20261010-013031`

These are historical rollback directory names. Check whether they still exist before relying on them.

## Dashboard tests

Existing tests:

`web-dashboard/tests/*.test.cjs`

These test moderation payloads and mocked world-management form/action handlers. They do not exercise a real browser, authenticated session, or live API.

It is not a complete backend integration test.

Previous verification included:

- `node --check ..\web-dashboard\app.js`
- `git diff --check`

Both passed during the earlier player-management development.

---

# 15. WORLD MANAGEMENT — NEXT DASHBOARD GOAL

The project owner previously identified the next dashboard goal as:

**Worlds and other stuff.**

Current known implementation:

- World listing and information through the Paper bridge.
- Multiverse-related world information.
- Per-world gamerule reads and writes.

The previous audit did not find complete flows for:

- Creating worlds.
- Importing worlds.
- Loading worlds.
- Unloading worlds.
- Deleting worlds.

Do not display non-existent functionality as completed.

## Future world-management goals

Evaluate and plan:

- World overview.
- Loaded/unloaded status.
- World environment.
- Player count per world.
- World information.
- Per-world gamerules.
- World creation.
- World import.
- World loading and unloading.
- Safe world deletion, if implemented at all.
- Multiverse integration.

Destructive world operations require strong safeguards and explicit approval.

For example, deleting a world must require confirmation and a backup strategy.

Develop these features incrementally, using the existing bridge/backend architecture.

---

# 16. BACKUPS AND RECOVERY

Historical backup configuration:

- Proxmox `vzdump`.
- Container: CT100.
- Compression: Zstandard (`zstd`).
- Scheduled time: 02:00.
- Retention:
  - 3 daily.
  - 7 weekly.
  - 4 monthly.

A known-good backup was reported from:

`2026-09-15`

Historical size:

Approximately 820 MB.

Verify the actual backup storage, latest backup date, and available space before any storage migration.

Do not assume a backup is valid merely because a backup file exists.

Long-term goals:

- Document backup locations.
- Document retention policy.
- Test restoration.
- Document disaster recovery.
- Consider separate backup storage.
- Ensure Minecraft data can be restored independently of the management dashboard.

Never change backup storage without checking the existing backup chain and recovery implications.

---

# 17. NETWORK AND ISP MIGRATION — VERY IMPORTANT

The project owner is planning to change internet service provider.

The ISP under consideration is:

**Jio AirFiber**

The earlier research also compared:

- JioFiber.
- JioAirFiber.
- Airtel Xstream Fiber.
- Airtel AirFiber.

The intended locality was:

YOUR_LOCALITY (see the local-only infrastructure note).

Historical budget preference:

Below ₹500 per month.

Main usage:

- Work.
- Self-hosting.
- Servers.
- Remote access.

The owner is particularly concerned about avoiding IP conflicts and preserving access to Proxmox, the Minecraft container, and the management system.

The actual provider, installation date, router model, subnet and current WAN status have not been confirmed in this project checkpoint.

## Existing historical LAN configuration

| Device/service | Historical address |
|---|---|
| Proxmox host | `YOUR_IP_ADDRESS` |
| Minecraft CT100 | `YOUR_IP_ADDRESS` |
| Historical gateway | `YOUR_IP_ADDRESS` |
| Proxmox bridge | `vmbr0` |
| Physical NIC | `nic0` |
| Java Minecraft | TCP `25565` |
| Bedrock/Geyser | UDP `19132` |
| Geyser broadcast port | `18029` |

Historical CT100 MAC:

`YOUR_DEVICE_MAC_ADDRESS`

The Proxmox host MAC address has not been established in the current project notes. Discover it from the live system.

Do not invent MAC addresses.

## ISP migration requirements

Before changing the router or network:

1. Record the current network configuration.
2. Record the current router LAN address.
3. Record the DHCP pool.
4. Identify the Proxmox host MAC address.
5. Identify the CT100 MAC address.
6. Identify the Windows laptop's network interfaces and Tailscale address.
7. Determine whether Proxmox and CT100 use static addresses or DHCP reservations.
8. Check the new ISP router's LAN subnet.
9. Check its DHCP range.
10. Check whether the old `YOUR_IP_ADDRESS` network can be retained.
11. Check for IP conflicts.
12. Plan the transition and rollback.

## Preferred LAN strategy

Prefer retaining:

`YOUR_IP_ADDRESS`

if the new ISP router supports it and its DHCP pool can be configured safely.

Historical addresses to preserve if feasible:

- Proxmox: `YOUR_IP_ADDRESS`
- CT100: `YOUR_IP_ADDRESS`

Use stable DHCP reservations or an appropriately configured static IP strategy.

Do not configure both DHCP reservations and conflicting static assignments.

Check whether the router's DHCP pool overlaps with the chosen static addresses.

## Jio AirFiber-specific concerns

Investigate:

- Whether the service uses CGNAT.
- Whether a public IPv4 address is available.
- Whether inbound connections are possible.
- Whether the router supports LAN subnet configuration.
- Whether DHCP reservations are available.
- Whether bridge mode is available.
- Whether IPv6 is available and useful.
- Whether the router blocks any required traffic.
- Whether local LAN connectivity works independently of internet connectivity.

Do not assume that a Jio AirFiber connection provides a public IPv4 address.

Do not assume port forwarding will work under CGNAT.

The project should not depend on public port forwarding.

## Connectivity strategy after ISP migration

Preferred design:

| Purpose | Preferred method |
|---|---|
| Proxmox administration | Tailscale SSH or LAN SSH |
| LXC administration | Tailscale/LAN SSH or Proxmox host |
| Dashboard | Tailscale Serve |
| Minecraft Java | Tailscale or an appropriate tunnel |
| Minecraft Bedrock | Playit tunnel, if still suitable |
| Public internet exposure | Avoid direct exposure of Proxmox |
| Remote management API | Authenticated Tailscale access |

Re-evaluate the actual setup after ISP installation.

## Post-migration verification checklist

- Proxmox reachable over LAN.
- Proxmox reachable through Tailscale.
- Proxmox web interface reachable.
- CT100 reachable.
- Minecraft service starts.
- Java LAN connection works.
- Bedrock LAN connection works.
- Java remote connection works.
- Bedrock remote tunnel works.
- Dashboard works.
- Management API authentication works.
- Paper bridge communication works.
- DNS resolution works.
- Backup jobs still run.
- Firewall rules remain correct.

Do not change all network components at once. Change and test one layer at a time.

---

# 18. WINDOWS DEVELOPMENT MACHINE AND SSH

The project is developed from Windows.

Main development PC / local repository location:

`D:\mine_project\minecraft-server-platform`

The owner also has a Windows 11 laptop configured for SSH access.

Historical Windows 11 SSH information:

| Property | Value |
|---|---|
| Windows username | `YOUR_WINDOWS_USER` |
| Windows home | `YOUR_WINDOWS_HOME_DIRECTORY` |
| Tailscale IP | `YOUR_IP_ADDRESS` |
| Device name | `YOUR_WINDOWS_DEVICE_NAME` |
| SSH server | OpenSSH Server |
| SSH service | Previously running |
| SSH port | TCP 22 |

Historical SSH command from another device:

`ssh YOUR_WINDOWS_USER@YOUR_WINDOWS_HOST`

The laptop's Tailscale account is separate from another Tailscale account used in the user's other devices.

The owner specifically wanted to avoid allowing the new Windows PC to access the old PC.

Do not alter Tailscale account sharing, ACLs, firewall rules, or SSH access direction without approval.

The owner also uses Termux on an Android phone.

This Windows SSH setup is separate from the Proxmox server. Do not confuse the two Tailscale IP addresses.

---

# 19. SECURITY AND PRIVACY REQUIREMENTS

Security must be considered throughout development.

Never commit:

- Passwords.
- API tokens.
- Bearer tokens.
- Tailscale authentication keys.
- Private SSH keys.
- Private player information.
- Sensitive player identifiers.
- Personal addresses.
- Private infrastructure identifiers where unnecessary.
- Router credentials.
- Private configuration files.

Use:

- `.gitignore`.
- Environment variables.
- Separate secret files.
- File permissions.
- Placeholder configuration examples.
- Secret scanning.
- Secure authentication.
- Input validation.
- Least privilege.
- Firewall restrictions.

## Public documentation

Public documentation should use examples such as:

- `YOUR_IP_ADDRESS`
- `YOUR_IP_ADDRESS`
- `YOUR_IP_ADDRESS`
- `minecraft.example.com`
- `YOUR_TAILSCALE_HOSTNAME`

Do not publish actual private IPs, Tailscale identifiers, personal/player details or live infrastructure information unless the owner explicitly approves.

The existing repository needs a full audit of:

1. Current tracked files.
2. Git history.
3. Configuration examples.
4. Screenshots.
5. Logs.
6. Documentation.
7. Build files.
8. Environment files.

If sensitive information exists in Git history, explain the implications of history rewriting and obtain approval before doing it.

Never print secret values in audit reports. Report file paths, line numbers and categories instead.

---

# 20. PROJECT DOCUMENTATION GOALS

Create professional documentation that separates:

## A. Actual deployment documentation

What is running on the owner's hardware.

## B. Reproduction guide

How another person can independently create a similar setup.

## C. Development documentation

How to build and modify the project's components, subject to the project's copyright policy.

## D. Operations documentation

How to maintain, monitor, back up, troubleshoot and recover the deployment.

## E. Network documentation

How LAN, DHCP, SSH, Tailscale, tunnels, Java and Bedrock connectivity work.

## F. Architecture documentation

How the dashboard, FastAPI backend, Paper bridge and Minecraft server communicate.

Never publish the owner's actual passwords, secrets or unnecessary infrastructure identifiers.

---

# 21. FUTURE DEVELOPMENT ROADMAP

These are goals, not claims of completed functionality.

## Phase 1 — Repository quality and security

- Complete privacy audit.
- Complete Git-history security audit.
- Correct README.
- Correct architecture documentation.
- Add copyright notice.
- Improve `.gitignore`.
- Add Python dependency configuration.
- Recover or reconstruct the actual backend source.
- Add GitHub Actions CI where appropriate.
- Add issue and pull-request templates.
- Improve project structure.
- Create professional screenshots and diagrams.

## Phase 2 — SSD and infrastructure

- Verify new SSD detection.
- Check SMART health.
- Decide storage role.
- Configure only after approval.
- Verify Proxmox storage.
- Verify CT100.
- Document final storage architecture.
- Test backups and restoration.

## Phase 3 — Network migration

- Prepare for Jio AirFiber.
- Inspect router configuration.
- Preserve or safely migrate LAN addresses.
- Set up DHCP reservations.
- Avoid IP conflicts.
- Verify SSH.
- Verify Tailscale.
- Verify Java and Bedrock connectivity.
- Verify dashboard and API.
- Document the new network.

## Phase 4 — Dashboard development

- Complete world-management interface.
- Improve server overview.
- Improve player management.
- Improve whitelist and operator management.
- Improve gamerule controls.
- Add robust error handling.
- Add loading and success states.
- Improve responsive design.
- Improve accessibility.

## Phase 5 — Backend and bridge

- Recover and track FastAPI backend.
- Document API contracts.
- Improve validation.
- Improve authentication.
- Improve error responses.
- Add integration tests.
- Improve Paper bridge reliability.
- Add compatibility checks.

## Phase 6 — Monitoring and administration

Potential future features:

- CPU and RAM monitoring.
- Disk and storage monitoring.
- Minecraft TPS/MSPT monitoring.
- Player activity.
- Server uptime.
- Log viewing.
- Backup status.
- Update notifications.
- Plugin version information.
- Container status.
- Service health.

Do not implement features without checking hardware resource limitations.

## Phase 7 — Discord integration

The broader original project vision included a Discord management component.

Potential future capabilities:

- Discord bot.
- Minecraft server status.
- Player notifications.
- Administrative commands.
- Server announcements.
- Event notifications.
- Role-based administrative access.

No completed Discord bot implementation has been established in the latest repository audit. Treat it as a future development goal.

## Phase 8 — Professional portfolio

- Professional GitHub README.
- Architecture diagrams.
- Screenshots.
- Demonstration video.
- Installation guide.
- API reference.
- Developer guide.
- Operations guide.
- Changelog.
- Release tags.
- CI.
- Testing documentation.

---

# 22. IMPORTANT RESOURCE CONSTRAINTS

The host has historically only 4 GB RAM.

Existing allocation:

- Proxmox host.
- CT100: 2 GB RAM.
- Minecraft Java heap: 1 GB.

Do not assume there is substantial free memory.

Before adding services or increasing allocations, inspect:

- Actual memory usage.
- Swap usage.
- CPU usage.
- Disk I/O.
- Storage health.
- Minecraft TPS/MSPT.
- Container pressure.
- Proxmox host load.

A previous Spark measurement showed approximately:

- 20 TPS.
- MSPT median: 2.53.
- MSPT p95: 6.03.

These are historical performance measurements, not guaranteed current results.

Do not add resource-heavy monitoring stacks or services without evaluating their impact.

---

# 23. IMMEDIATE CONTINUATION PLAN

Continue from the actual state of the project on 30 October 2026.

Do not start with SSD formatting or repository redesign.

Follow this exact sequence.

## STEP 1 — Confirm current development state

On Windows:

- Inspect repository path.
- Inspect branch.
- Inspect working tree.
- Inspect HEAD.
- Fetch remote metadata.
- Compare local and remote branches.
- Inspect recent commits.
- Inspect untracked files.

Do not overwrite or discard local changes.

## STEP 2 — Complete the public repository audit

Inspect:

- Current tracked files.
- Git history.
- Public documentation.
- Personal information.
- Private infrastructure identifiers.
- Credentials and secrets.
- Incorrect architecture claims.
- README inaccuracies.

Do not print secret values.

Do not edit files during the audit.

Return a prioritized report.

## STEP 3 — Apply approved repository corrections

After approval:

- Fix README.
- Correct documentation.
- Add copyright notice.
- Improve repository structure.
- Recover the missing backend source if available.
- Add appropriate project configuration.
- Add tests and CI.
- Update screenshots and architecture diagrams.

Do not select an open-source license.

## STEP 4 — Inspect the SSD on Proxmox

The server is powered on and the SSD is physically installed.

Use read-only commands only.

Identify the SSD using model, capacity and serial number.

Inspect SMART and existing storage.

Do not modify anything.

Return findings and wait for approval.

## STEP 5 — Configure the SSD

Only after explicit approval:

- Apply the selected storage configuration.
- Verify storage health.
- Verify Proxmox storage status.
- Verify CT100.
- Verify Minecraft.
- Verify backups.
- Update infrastructure documentation.

## STEP 6 — Prepare ISP migration

Before changing the internet connection:

- Record current host and container network settings.
- Identify host and container MAC addresses.
- Record DHCP and gateway configuration.
- Plan the new router LAN subnet.
- Check CGNAT.
- Plan IP reservations.
- Plan Tailscale and Playit continuity.
- Prepare rollback.

Wait for the owner to confirm the new ISP/router is installed before making migration changes.

## STEP 7 — Continue dashboard and backend development

Once the infrastructure and documentation are stable:

- Finish the world-management feature plan.
- Improve the existing dashboard.
- Recover and track the FastAPI backend.
- Improve testing.
- Continue the Discord integration roadmap.

---

# 24. COMMAND EXECUTION AND APPROVAL POLICY

You may execute safe read-only commands automatically when the environment permits.

Examples:

- `git status`
- `git log`
- `git diff`
- `git fetch`
- `lsblk`
- `lsblk -f`
- `ls -l /dev/disk/by-id/`
- `pct status 100`
- `pct config 100`
- `systemctl status`
- `ip addr`
- `ip route`
- `df -h`
- `free -h`
- `smartctl` read-only health checks

Use the correct operating environment:

- Windows commands in PowerShell.
- Proxmox commands on the Proxmox host.
- Minecraft/Linux commands inside CT100 when appropriate.

Before any risky operation, explain:

1. What you intend to do.
2. Which machine or container will be affected.
3. Which files, disks or services will change.
4. Why the change is necessary.
5. What could go wrong.
6. How to back up.
7. How to roll back.
8. How success will be verified.

Then wait for explicit approval.

Operations requiring approval include:

- Disk formatting or partitioning.
- Filesystem creation.
- LVM changes.
- Storage migration.
- Container disk changes.
- Proxmox configuration changes.
- Network configuration changes.
- Firewall changes.
- Authentication changes.
- Destructive Minecraft world operations.
- Service replacement.
- Production deployment.
- Git history rewriting.
- Pushing significant changes to GitHub.
- Deleting files or backups.

Never claim an operation has succeeded until its result has been verified.

---

# 25. PRIVATE INFRASTRUCTURE REFERENCE

Actual private IP, MAC, SSH, Tailscale, tunnel, and personal network details are kept only in the ignored local file `docs/private-infrastructure.md`. That file is historical and must be verified before operational use. Never copy it into public documentation. The public guide should use per-reader placeholders.

---

# 26. FINAL INSTRUCTIONS — START HERE

You are now responsible for continuing this project.

First, inspect the local Git repository and confirm whether the previous checkpoint still matches.

Then complete the read-only public repository privacy/security audit.

Next, inspect whether Proxmox is reachable from your available environment.

If it is reachable, perform the read-only SSD inspection.

If SSH access is unavailable, do not pretend to have inspected the server. Tell the owner exactly what access is missing and provide the safest next step.

Do not format or configure the SSD yet.

Do not begin ISP migration yet.

Do not rewrite Git history yet.

Do not choose an open-source license.

Do not make unapproved production changes.

Maintain the project's existing architecture wherever practical. Recover missing source code before replacing it.

The goal is to continue the existing project professionally, safely and incrementally, while making the final GitHub repository an excellent engineering portfolio and a useful independent build guide for other people.

**Begin with Step 1: inspect the current local Git repository and verify the checkpoint. Report the results before proceeding to the next step.**
