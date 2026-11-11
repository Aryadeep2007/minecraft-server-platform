# Troubleshooting

Use these checks to narrow down a failure before changing configuration. Commands are read-only unless marked otherwise. Run each command in the location shown. Do not paste raw logs or configuration publicly; they can include player names, local paths, network details, or secrets.

## Proxmox cannot reach CT100

On the **Proxmox host**:

```bash
pct status 100
pvesm status
```

Expected: CT100 is `running`; required storages are `active`. If CT100 is stopped, review why before starting it. Do not alter its network or storage configuration as a diagnostic shortcut.

## Minecraft or API service is unavailable

Inside **CT100** (run through the Proxmox host):

```bash
pct exec 100 -- systemctl status minecraft.service --no-pager
pct exec 100 -- systemctl status minecraft-management.service --no-pager
pct exec 100 -- journalctl -u minecraft.service -n 80 --no-pager
pct exec 100 -- journalctl -u minecraft-management.service -n 80 --no-pager
```

A service status or journal may contain private values. Inspect locally and redact before sharing. Do not restart Minecraft while players are online. Before a restart, confirm the server is idle and a current backup exists; restart is a state-changing maintenance action.

## API returns HTTP 403

The API requires a trusted `Tailscale-User-Login` header matching one line in the external allowlist. Writes also require an `Origin` exactly matching `MINECRAFT_DASHBOARD_ORIGIN`.

- Confirm the browser is signed into the expected private access proxy.
- Confirm the proxy overwrites the identity header and does not allow direct unauthenticated access to the API.
- Check the allowlist file and environment-file permissions without printing their contents. The API service account must be able to read them.
- For a write-only failure, compare the dashboard origin and configured exact origin privately; do not send either value in logs or screenshots.

A direct `curl http://127.0.0.1:8000/health` without the trusted identity header is expected to return 403; that alone does not mean the service is down.

## API returns HTTP 503 or bridge is unavailable

- Check `minecraft-management.service` and `minecraft.service` status first.
- Verify the bridge plugin loaded from the Paper startup log and that its listener remains on loopback port 25586.
- Check that the bridge token file exists and is readable by the API service account. Never print the token.
- Check that Paper Management Protocol is enabled and its secret matches the server properties file used by the API. Never print that secret.
- For Multiverse-only listing or lifecycle errors, confirm Multiverse-Core is installed and enabled.

## A world action is rejected

- `400`: invalid world name, confirmation mismatch, unsupported setting, or unsafe archive. Use a single ASCII name up to 32 characters and retype it exactly when prompted.
- `404`: the world is not registered, or the bridge returned no such world. For an import whose files were preserved, use the dashboard’s existing-world registration form after reviewing the extracted directory.
- `409`: a state conflict. A world may already be loaded, have players, be the primary world, already exist, or have a conflicting archive. Refresh the world list before retrying.
- `503` or timeout after create/import: the operation may have partially completed. Refresh the world list and inspect CT100 logs before retrying. Do not submit the same create/import repeatedly.

The bridge refuses unloading or archiving the primary world and any world with players. World archive is a reversible move inside the same world filesystem; it is not an independent backup. Permanent deletion is unavailable.

## ZIP import fails

The API accepts `application/zip` up to 256 MiB. The archive must contain one world with a regular `level.dat`. Traversal paths, links/special files, encrypted ZIPs, duplicate paths, extreme compression ratios, over 100,000 entries, expansion above 8 GiB, existing destinations, and insufficient free space are rejected.

If the response says files were preserved but Multiverse registration failed, refresh the world list and verify the folder before using **Register existing world**. Do not upload the same archive again under that name; it will not overwrite the existing directory.

## Backup or restore fails

See [Backup and isolated restore](backup-and-restore.md). Check storage availability and capacity before a backup/restore. Never test restore over CT100; restore to a new stopped CT ID, remove its network interfaces, and leave the original archive intact.

## Related documentation

- [Getting started](getting-started.md)
- [Management API and bridge](management-api.md)
- [World management](world-management.md)
- [Backup and isolated restore](backup-and-restore.md)
- [Proxmox notes](proxmox.md)
