# Proxmox deployment and storage notes

This page describes the owner’s Proxmox host as verified on 10 November 2026. It is operational context, not a clean-room installation guide. Use your own host addresses and device identities; the private inventory is intentionally omitted.

## Host and container snapshot

| Component | Verified/recorded state |
|---|---|
| Proxmox VE | 9.2.11, Debian 13 Trixie |
| Host hardware | Intel Core i3-9100F, 4 GiB RAM |
| System/data disk | Toshiba HDWD110, about 1 TB SATA |
| Minecraft container | CT100, hostname `minecraft`, Debian 13 |
| CT100 resources | 2 cores, 2 GiB RAM, 40 GiB root disk |
| CT100 state at last check | Running |

The host has limited memory. Measure current host and guest memory/swap before adding services or increasing allocations.

## Storage layout

The Toshiba HDD continues to host the Proxmox installation and original LVM storage:

- EFI partition about 1 GiB.
- Proxmox root logical volume 96 GiB.
- Swap logical volume 4 GiB.
- LVM thin pool about 797.7 GiB.
- CT100 root disk on `local-lvm`.

The separate EVM25/256GB SATA SSD is formatted ext4 and mounted by UUID at `/mnt/pve/ssd-backups`. Proxmox storage ID `ssd-backups` is active and configured for backup content only. Exact serials and filesystem UUIDs are kept in local private inventory, not in public docs.

Do not identify a disk by `/dev/sdX` alone. Device names can change between boots. Confirm model, serial, capacity, and `/dev/disk/by-id/` before storage operations.

## CT100 backup configuration

The enabled Proxmox backup job for CT100 was verified on 10 November 2026 with:

| Setting | Value |
|---|---|
| Destination | `ssd-backups` |
| Schedule | Daily at 02:00 (host timezone) |
| Mode | Snapshot |
| Compression | Zstandard |
| Retention | Keep last 3, daily 7, weekly 4, monthly 3 |

A manual snapshot backup was created on 10 November 2026. The archive completed successfully and `zstd -t` completed without error. The SSD had roughly 221 GiB free afterward. Verify the live job and free space before relying on these values.

An isolated restore to temporary CT101 verified archive extraction and presence of core Minecraft files/world directories. CT101 was kept stopped and network-disconnected, then deleted after owner approval. CT100 remains the only container in this setup. The restore test did not start Minecraft or prove gameplay operation.

The SSD is inside the same host. It protects against a single-disk failure only when the other disk remains healthy; it does not protect against whole-host loss. Maintain an off-machine backup copy and test restoration.

## Read-only inspection commands

Run these on the **Proxmox host**. These commands inspect state only:

```bash
lsblk -e7 -o NAME,SIZE,MODEL,SERIAL,TRAN,FSTYPE,UUID,MOUNTPOINTS
ls -l /dev/disk/by-id/
pvs -o pv_name,pv_size,pv_free,vg_name
vgs -o vg_name,vg_size,vg_free
lvs -a -o lv_name,vg_name,lv_size,segtype,devices
pvesm status
pct status 100
pvesm list ssd-backups --content backup
```

Before any storage writes, review the exact target disk, impact, backup and rollback plan. Formatting, partitioning, LVM changes, storage edits, and migration require explicit approval.

## CT100 administration

Run Proxmox container commands on the **Proxmox host**:

```bash
pct status 100
pct config 100
pct exec 100 -- systemctl is-active minecraft.service
```

Do not change CT network, memory, disk, boot, or service configuration based only on this historical document. Confirm the live config and take a fresh backup before consequential maintenance.

## Security and network

The actual management address, gateway, DHCP range, MAC addresses, SSH targets, and remote-access identities are intentionally omitted. Keep Proxmox management restricted to trusted administration paths. Do not expose the Proxmox web UI, SSH, or Paper bridge directly to the public internet.

The Minecraft service has historically used Java TCP 25565 and Bedrock/Geyser UDP 19132, with private/tunnel access varying by deployment. Verify firewall and authentication configuration before exposing player endpoints.

## Power and startup

Historical notes record CT100 configured to start on host boot and `minecraft.service` enabled inside the container. The Proxmox host booted successfully during the 10 November SSD checks, and CT100 was running afterward. Treat detailed BIOS/network settings as environment-specific and verify them live.

## Related docs

- [CT backup and isolated restore guide](backup-and-restore.md)
- [Minecraft deployment notes](minecraft-server.md)
- [Hardware and SSD role](hardware.md)
- [Management API and Paper bridge](management-api.md)
