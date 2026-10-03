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

## Multiverse-Core

Multiverse-Core 5.5.3 is installed and operational on the Paper Minecraft 1.21.11 server.

- Purpose: multi-world management
- Plugin JAR: `Multiverse-Core.jar`
- Version: 5.5.3
- Paper compatibility: Paper 1.21.11
- Verified command: `/mv version`
- Verified command: `/mv list`
- Verified command: `/mv info world`
- Worlds currently managed:
  - `world` — NORMAL — SURVIVAL
  - `creative` — NORMAL — CREATIVE
  - `world_nether` — NETHER
  - `world_the_end` — THE_END
- `creative` was created with `/mv create creative normal`.
- `creative` was changed to `CREATIVE` using `/mv modify creative set gamemode creative`.
- World teleportation was verified with `/mv tp creative` and `/mv tp world`.
- Per-world gamerule management was verified:
  - `creative` — `minecraft:keep_inventory: true`
  - `world` — `minecraft:keep_inventory: false`
- The main Survival world's `keep_inventory` setting remained unchanged after modifying the Creative world.
- Main world configuration:
  - Game mode: SURVIVAL
  - Difficulty: EASY
  - Environment: NORMAL
  - World type: DEFAULT
  - Generate structures: enabled
  - Auto load: enabled
  - Weather: enabled
  - Flight: disabled
  - Hunger depletion: enabled
  - PvP/FVF: enabled
- A saved Nether spawn location was found unsafe during startup; Multiverse automatically adjusted the Nether spawn to `world_nether:0.50,66.00,9.50`.

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

## Java + Bedrock Crossplay

Java Edition and Bedrock Edition crossplay is enabled through Geyser, Floodgate, and ViaVersion.

### Crossplay Components

| Component | Version / Configuration |
|---|---|
| Geyser-Spigot | 2.11.3 |
| Floodgate | 2.2.5 |
| ViaVersion | 5.11.0 |
| Java server port | TCP `25565` |
| Bedrock server port | UDP `19132` |
| Geyser authentication | `floodgate` |
| Bedrock username prefix | `.` |

### LAN Connection

Bedrock clients on the same LAN can connect using:

```text
Address: 192.168.1.200
Port: 19132
```

Java clients continue to connect using:

```text
Address: 192.168.1.200
Port: 25565
```

### Verified Crossplay

* Bedrock client successfully connected from LAN.
* Floodgate authentication successfully passed the player to the Java server.
* Bedrock player `Aryadeepdeep` successfully entered the world.
* Java player `aryadeep45` successfully connected after Floodgate was enabled.
* Both players are protected by the server whitelist.
* Bedrock whitelist entry is stored as `.Aryadeepdeep`, using Floodgate's configured username prefix.
* Geyser is listening on UDP `19132`.
* Minecraft remains available on TCP `25565`.
* No PG-owned upstream router changes were required for LAN crossplay.

### Current Whitelist Entries

* `aryadeep45`   Java Edition
* `.Aryadeepdeep`   Floodgate Bedrock identity

### Configuration

Geyser authentication is configured in:

```text
/opt/minecraft/plugins/Geyser-Spigot/config.yml
```

Current authentication mode:

```yaml
auth-type: floodgate
```

A pre-change configuration backup was created as:

```text
/opt/minecraft/plugins/Geyser-Spigot/config.yml.before-floodgate
```

### Remote Bedrock Access

Remote Bedrock access is provided through **playit.gg** because the PG-owned upstream router cannot be modified and direct public UDP port forwarding is not available.

The playit agent runs inside Proxmox LXC CT 100 and forwards the public Bedrock connection to the local Geyser listener.

#### playit.gg Configuration

| Component         | Configuration                 |
| ----------------- | ----------------------------- |
| Agent             | `playit`                      |
| Agent package     | `1.0.9-1`                     |
| Agent service     | `playit.service`              |
| Tunnel            | `Minecraft Bedrock`           |
| Tunnel type       | `Minecraft Bedrock`           |
| Network           | Free Network                  |
| Public hostname   | `nicely-fisheries.tun.ply.gg` |
| Public IP         | `147.185.221.214`             |
| Public port       | UDP `18029`                   |
| Local destination | `127.0.0.1:19132`             |
| Proxy Protocol    | `None`                        |

The public Bedrock endpoint is:

```text
nicely-fisheries.tun.ply.gg:18029
```

The public port is **18029**. No router port forwarding is required.

#### Geyser Configuration for playit.gg

Geyser continues to listen locally on UDP port `19132`.

The relevant configuration is:

```yaml
auth-type: floodgate
broadcast-port: 18029
use-haproxy-protocol: false
```

Proxy Protocol is intentionally disabled in the playit.gg tunnel.

Geyser's Bedrock `use-haproxy-protocol` setting must remain `false`. A previous test using Proxy Protocol together with `use-haproxy-protocol: true` caused LAN Bedrock connectivity to fail. Restoring both settings to their current configuration restored both LAN Bedrock and remote playit.gg Bedrock connectivity.

#### Verified Remote Bedrock Test

Remote Bedrock connectivity was successfully tested through the public playit.gg endpoint.

A remote Bedrock player using the username `Mimi17803` successfully reached the Minecraft server through:

```text
nicely-fisheries.tun.ply.gg:18029
```

The player reached the Minecraft server and was rejected only because they were not present on the server whitelist.

This verified the complete remote Bedrock path:

```text
Remote Bedrock Client
        |
        v
playit.gg public endpoint
nicely-fisheries.tun.ply.gg:18029
        |
        v
playit tunnel
        |
        v
127.0.0.1:19132
        |
        v
Geyser
        |
        v
Floodgate
        |
        v
PaperMC
        |
        v
Minecraft Server
```

The successful test confirms:

* Public hostname resolution works.
* Public UDP connectivity works.
* The playit.gg tunnel works.
* Traffic is forwarded to the local Geyser listener.
* Geyser accepts the Bedrock connection.
* Floodgate handles Bedrock authentication.
* Minecraft receives the Bedrock login.
* Server whitelist enforcement works.

No PG-owned upstream router changes were required.

#### Current Remote Endpoints

Java Edition:

```text
100.74.236.12:25565
```

Bedrock Edition:

```text
nicely-fisheries.tun.ply.gg:18029
```

The public Bedrock port is **18029**, not `18829`.


### Crossplay Backup Checkpoint

After successful LAN crossplay testing, a complete CT 100 backup was created and its Zstandard archive integrity was verified.

Backup:

```text
vzdump-lxc-100-2026_09_16-00_09_55.tar.zst
```

Backup mode: snapshot
Backup size: approximately 870 MB
Integrity test: passed

### Multiverse World Management Backup Checkpoint

After successful world-management and per-world gamerule testing, a complete CT 100 backup was created and its Zstandard archive integrity was verified.

Backup:

```text
vzdump-lxc-100-2026_10_03-20_46_11.tar.zst
```
Backup mode: snapshot
Backup size: approximately 884 MB
Integrity test: passed
