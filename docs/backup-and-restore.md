# Proxmox CT backup and isolated restore guide

This guide uses the verified Proxmox VE 9.2 `vzdump`, `pvesm`, and `pct restore` command syntax. It describes an operator-run procedure; no restore or container cleanup is performed by reading it. Commands marked **Proxmox host** run in a root shell on the Proxmox host. Review all values before execution.

## Recorded restore exercise — 11 November 2026

The latest SSD backup passed `zstd -t` and was restored to a temporary CT on `local-lvm`. The CT remained stopped; its saved network interface was removed. The root filesystem was mounted read-only and contained the Debian OS marker, one `server.properties`, the Minecraft systemd unit, and four `level.dat` world files. The filesystem was unmounted and the temporary CT removed after inspection. The source backup remained present, CT100 remained running, and the restored Minecraft service was not started.

This verifies archive extraction and basic file presence only. It does not prove that Minecraft boots, that every world is usable, or that a recovery will succeed after a host or storage failure.

## Create and verify a CT backup

On the **Proxmox host**, first check target storage and free space:

```bash
pvesm status
pvesm list ssd-backups --content backup
df -h /mnt/pve/ssd-backups
pct status 100
```

Expected: `ssd-backups` is active, CT100 is running, and free space is adequate for another compressed backup. This project’s CT backups are stored on the separate SATA SSD in the same PC; they are not off-host protection.

Create a snapshot backup:

```bash
vzdump 100 --storage ssd-backups --mode snapshot --compress zstd
```

Expected: the job reports successful completion and names a `vzdump-lxc-100-...tar.zst` archive. Keep the exact archive name from command output.

List and integrity-check that archive (replace the placeholder with the exact filename):

```bash
pvesm list ssd-backups --content backup
zstd -t /mnt/pve/ssd-backups/dump/<exact-backup-filename>.tar.zst
```

Expected: the archive is listed under `ssd-backups` and `zstd -t` exits successfully. An integrity check confirms compressed archive readability; it does not prove that a restored Minecraft server will start or that every world is usable.

## Restore to an isolated test CT

Restoration writes a new container disk and Proxmox configuration. Check available storage, choose an unused numeric CT ID (example below: `199`), and never use `--force`:

```bash
pvesm status
pct status 199
```

If CT ID 199 already exists, choose another unused ID. Restore from the verified archive onto `local-lvm`; the default is stopped, and `--unique 1` generates a different virtual NIC MAC address:

```bash
pct restore 199 /mnt/pve/ssd-backups/dump/<exact-backup-filename>.tar.zst --storage local-lvm --unique 1
```

Expected: Proxmox reports a successful restore and CT 199 exists in a **stopped** state. Do not start it yet: the saved container configuration may still contain the original network address and startup settings.

Review the test CT configuration and remove its network interface before starting it:

```bash
pct config 199
pct set 199 --delete net0
pct config 199
```

Confirm the second output has no `net0` entry and the container remains stopped. If there are additional network interfaces (`net1`, etc.), remove those from the test CT too. Do not change CT100.

Start the isolated test only after confirming it has no network interfaces:

```bash
pct start 199
pct status 199
pct exec 199 -- systemctl is-active minecraft.service
pct exec 199 -- journalctl -u minecraft.service -n 60 --no-pager
```

If the Minecraft service is enabled, it may start automatically with the container. Inspect its logs and use a local console only; this disconnected clone cannot accept remote players. A successful systemd state and readable world directories provide stronger evidence than archive integrity alone, but still do not prove gameplay, plugin behavior, or every world’s consistency.

After verification, shut the test CT down and retain it until its result has been reviewed:

```bash
pct shutdown 199
pct status 199
```

Do not run `pct destroy` until the CT ID, its disks, and the need to retain the restore evidence have been reviewed. Never delete the source archive as part of testing.

## Recovery limits

- A restore onto `local-lvm` uses space on the existing HDD-backed thin pool. Check `pvesm status` first.
- A backup on the SSD helps recover from a failure of the Toshiba HDD while the host and SSD survive. It does not protect against loss, theft, power damage, or compromise of the whole PC.
- Maintain a second copy on a separate machine or removable/off-site storage and periodically verify a restore from that copy.
- Do not overwrite or restore over CT100 as a first recovery test. Preserve the original CT and backup archive until the restored system is verified and a recovery plan is reviewed.
- The project’s 10 November 2026 restore exercise used an isolated, stopped, network-disconnected CT and was later removed with owner approval. That exercise checked files/world directories; it did not start Minecraft or prove gameplay.

## Related guides

- [Proxmox storage and host notes](proxmox.md)
- [Minecraft server operations](minecraft-server.md)
- [Management API and bridge](management-api.md)
