\# Proxmox VE



\## Proxmox Host



| Item | Value |

|---|---|

| Proxmox VE | 9.2.11 |

| Hostname | pve |

| IP Address | 192.168.1.250 |

| Gateway | 192.168.1.1 |

| Bridge | vmbr0 |

| Physical NIC | nic0 |

| OS Base | Debian 13 (Trixie) |

| Architecture | x86-64 |



\## Storage



The Proxmox host currently uses a 1 TB SATA HDD.



The main storage layout is:



\- EFI partition: \~1 GB

\- Root LV: 96 GB

\- Swap: 4 GB

\- LVM thin pool: \~797.7 GB

\- Free VG space: \~16 GB



The storage is currently sufficient for the initial Minecraft deployment.



\## Network



The Proxmox bridge `vmbr0` provides network connectivity to the host and LXC containers.



The host uses:



\- IP: `192.168.1.250/24`

\- Gateway: `192.168.1.1`

\- DNS: `192.168.1.1`



\## Minecraft Container



Minecraft runs inside:



\- Container ID: `100`

\- Hostname: `minecraft`

\- OS: Debian Trixie

\- RAM: 2048 MB

\- CPU: 2 cores

\- Network: `vmbr0`

\- IP: `192.168.1.200/24`



\## Repositories



Enabled repositories:



\- Debian Trixie

\- Debian Trixie Updates

\- Debian Security

\- Proxmox `pve-no-subscription`



The Proxmox enterprise repository is disabled because this server does not use a Proxmox subscription.



\## Power Recovery



The motherboard BIOS is configured with:



`AC BACK = Always On`



This allows the server to automatically power back on after an electrical outage, provided mains power is restored.



\## Security



Proxmox Web UI is available on port `8006`.



SSH is available on port `22`.



These management services should remain accessible only from the trusted LAN and should not be exposed directly to the public Internet.


## Container Firewall

The Minecraft container has the Proxmox firewall enabled.

Allowed inbound traffic from the trusted LAN (`192.168.1.0/24`):

- SSH: TCP `22`
- Minecraft: TCP `25565`
- ICMP/ping

Inbound traffic not explicitly allowed is dropped.

The Minecraft RCON port (`25575`) is not exposed through the firewall.

## Automatic Startup

Minecraft container `100` is configured to start automatically when Proxmox boots.

Configuration:

- `onboot: 1`
- `startup: order=1,up=30`

The Minecraft systemd service is also enabled:

`minecraft.service`

## Reboot Recovery Test

A complete reboot test was performed successfully:

1. Proxmox host rebooted.
2. LXC container `100` started automatically.
3. `minecraft.service` started automatically.
4. Minecraft port `25565` became reachable.
5. A Minecraft client successfully connected to the server.


## Backup System

The Minecraft LXC (CT 100) is protected by an automated Proxmox backup system.

### Manual Backup

A full LXC backup was successfully created using Proxmox `vzdump`:

```bash
vzdump 100 --storage local --mode snapshot --compress zstd
```

Backup storage:

```text
/var/lib/vz/dump/
```

The verified backup created during testing was approximately 682 MB.

The backup archive was integrity-tested successfully with:

```bash
zstd -t /var/lib/vz/dump/vzdump-lxc-100-2026_09_10-23_10_41.tar.zst
```

### Automatic Backup Schedule

An automatic Proxmox backup job is configured for Minecraft CT 100.

| Setting     | Value          |
| ----------- | -------------- |
| Backup type | LXC (`vzdump`) |
| Container   | CT 100         |
| Node        | pve            |
| Storage     | local          |
| Mode        | snapshot       |
| Compression | zstd           |
| Schedule    | 02:00 daily    |
| Enabled     | Yes            |

The configured retention policy is:

| Retention    | Count |
| ------------ | ----: |
| Keep last    |     3 |
| Keep daily   |     7 |
| Keep weekly  |     4 |
| Keep monthly |     3 |

The backup job is managed by Proxmox and was verified through the Proxmox API.

### Backup Retention Verification

The configured retention policy was tested using a dry run:

```bash
pvesm prune-backups local --vmid 100 --type lxc --keep-last 3 --keep-daily 7 --keep-weekly 4 --keep-monthly 3 --dry-run 1
```

The existing backup was correctly marked to be kept.

### Backup Strategy

The backup system provides protection against accidental configuration changes, server failures, and future maintenance operations.

Before major Minecraft/Paper upgrades or other potentially destructive changes, a fresh backup should be created and its integrity verified.

> **Note:** The current backup storage is located on the same physical HDD as the Proxmox installation. This protects against software/configuration problems but does not protect against physical disk failure. An external or separate backup destination should be added in the future.
