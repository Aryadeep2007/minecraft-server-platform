# Hardware notes

This page records the project host configuration as historical context. It is not a hardware compatibility guarantee or a live inventory; verify component revisions and device health before reproducing the setup.

## Historical host hardware

| Component | Recorded specification |
|---|---|
| Motherboard | Gigabyte H310M S2 2.0 |
| CPU | Intel Core i3-9100F, 4 cores / 4 threads |
| Memory | 4 GB DDR4-2400 |
| Display adapter | NVIDIA GT 710, 2 GB |
| Original system/data disk | Toshiba HDWD110, 1 TB SATA HDD |
| Additional disk | EVM25/256GB SATA SSD, approximately 256 GB |

The host has limited memory. Its historical Minecraft container allocation was 2 GB RAM and two CPU cores, with a 1 GB Java heap. Measure current memory pressure before increasing allocations or adding services.

## Current storage role

The Toshiba HDD hosts the Proxmox installation and the existing LVM-backed container storage. The SSD is formatted as ext4 and registered in Proxmox as backup-only directory storage. The CT100 scheduled backup job was pointed to that SSD and a manual snapshot backup was created and integrity-checked on 10 November 2026.

The SSD is in the same physical host. It can help recover from failure of the Toshiba disk, but it does not protect against loss of the whole machine. Keep another copy away from the host for stronger recovery protection.

The current filesystem UUID, serial numbers, partition/device paths, and physical infrastructure inventory are intentionally kept out of public docs. Use the private local infrastructure notes and verify live details before administration.

## Hardware considerations

- The Core i3-9100F has no integrated graphics; the GT 710 was historically used for local display output.
- Proxmox and Minecraft share a 4 GB host. Avoid resource-heavy stacks and inspect memory, swap, CPU, and disk I/O before changes.
- Storage additions and migrations should follow a verified backup and rollback plan. Do not infer disk identity from `/dev/sdX` alone.
