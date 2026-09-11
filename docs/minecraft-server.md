# Minecraft Server

> PaperMC-based Minecraft Java server running inside a Debian LXC container on Proxmox VE.

---

## 📊 Server Overview

| Component | Configuration |
|---|---|
| Minecraft | 1.21.11 |
| Server Software | PaperMC |
| Paper Build | 132 |
| Java | OpenJDK 21 |
| Container | Proxmox LXC 100 |
| Container RAM | 2 GB |
| CPU | 2 cores |
| Server IP | `192.168.1.200` |
| Minecraft Port | `25565` |
| Server Directory | `/opt/minecraft` |

---

## 🏗️ Architecture

```text
Internet / LAN
      │
      ▼
   Router
      │
      ▼
 Proxmox VE
 192.168.1.250
      │
      ▼
 LXC 100 — minecraft
 192.168.1.200
      │
      ▼
    PaperMC
      │
      ▼
 Minecraft 1.21.11

## Installed Plugins

### CoreProtect

CoreProtect Community Edition 23.2 is installed on the Paper Minecraft server.

- Purpose: server activity logging, block inspection, lookup, rollback, and restore
- Minecraft/Paper compatibility: Minecraft 1.21.11
- Database: SQLite
- Status: Enabled and operational
- Plugin command: `/co`
- Verified commands: `/co status`, `/co inspect`, `/co lookup`

A live test was performed by placing and breaking a dirt block. CoreProtect successfully recorded both actions and returned the player name, action, block type, and world coordinates through `/co lookup`.

CoreProtect was installed manually and verified after restarting the Minecraft systemd service.

## EssentialsX

EssentialsX 2.22.0 is installed and operational on the Paper Minecraft 1.21.11 server.

- Core plugin: `EssentialsX.jar`
- Version: 2.22.0
- Database/economy: EssentialsX built-in economy
- Verified commands: `/bal`, `/sethome`, `/home`, `/setwarp`, `/warp`, `/delwarp`, `/delhome`, `/motd`
- MOTD customization: `plugins/Essentials/motd.txt`
- Dynamic MOTD placeholders verified: `{PLAYER}`, `{ONLINE}`, `{TPS}`, `{UPTIME}`
- Temporary `test` home and `test` warp were created for testing and removed afterward.
- EssentialsX Spawn was not installed; `/spawn` is therefore not currently provided by EssentialsX core.

## Tailscale Remote Access

Tailscale 1.102.4 is installed and authenticated inside Minecraft LXC CT 100.

- Tailscale IPv4: `100.74.236.12`
- Minecraft service: `25565`
- Windows client Tailscale IPv4: `100.106.244.46`
- Tailscale daemon: `tailscaled.service`
- Tailscale starts automatically after CT reboot.
- Minecraft also starts automatically after CT reboot.
- `/dev/net/tun` was passed into the unprivileged LXC to enable normal Tailscale networking.
- LAN and Tailscale connectivity to TCP `25565` were verified successfully.
- Minecraft client successfully connected using `100.74.236.12:25565` before and after a CT reboot.
- The PG-owned upstream router was not modified.
- No public Internet port forwarding is configured.

Tailscale provides the remote-access path without requiring changes to the PG router.
